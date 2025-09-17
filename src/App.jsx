import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import { messaging } from './utils/firebase-config';
import { getToken, onMessage } from 'firebase/messaging';

import Pag_auth from './pages/Pag_auth';
import Pag0_menu from './pages/Pag0_menu';
import SottoPag1_notifiche from './pages/SottoPag1_notifiche';

// Modifica ProtectedRoutes per accettare le props
const ProtectedRoutes = ({ session, isSubscribed, setIsSubscribed, debugInfo, addDebug, requestForToken }) => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!newSession) navigate('/auth');
    });
    return () => authListener.subscription.unsubscribe();
  }, [navigate]);

  if (!session) return null;

  return (
    <Routes>
      <Route path="/" element={<Pag0_menu />} />
      <Route path="/menu" element={<Pag0_menu />} />
      {/* Passa `isSubscribed` al componente figlio */}
      <Route path="/notifiche" element={<SottoPag1_notifiche isSubscribed={isSubscribed} />} />
    </Routes>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const addDebug = (message) => {
    console.log(message);
    setDebugInfo(prev => prev + '\n' + new Date().toLocaleTimeString() + ': ' + message);
  };

  const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

  const requestForToken = async () => {
    addDebug('🔄 Inizio processo attivazione notifiche FCM...');
    try {
        addDebug('🔄 Richiesta permesso notifiche...');
        const permission = await Notification.requestPermission();
        addDebug(`📋 Permesso ricevuto: ${permission}`);
        if (permission === 'granted') {
            addDebug('🔄 Attesa Service Worker ready...');
            await navigator.serviceWorker.ready;
            addDebug('✅ Service Worker pronto');

            addDebug('🔄 Ottenimento token FCM...');
            const currentToken = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY });
            if (currentToken) {
                addDebug('✅ Token FCM ottenuto. Salvataggio in corso...');
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    // Cerca il device esistente
                    const { data: existingDevice, error: fetchError } = await supabase
                        .from('user_devices')
                        .select('push_token')
                        .eq('user_id', user.id)
                        .eq('push_token', JSON.stringify({ fcmToken: currentToken }))
                        .single();

                    if (existingDevice) {
                        addDebug('✅ Token già presente nel database. Non serve salvare.');
                        setIsSubscribed(true);
                    } else {
                        // Aggiorna o crea un nuovo record se non esiste
                        const { data, error } = await supabase
                            .from('user_devices')
                            .insert([{
                                user_id: user.id,
                                push_token: JSON.stringify({ fcmToken: currentToken }),
                                created_at: new Date()
                            }])
                            .select();

                        if (error) {
                            console.error('Errore durante il salvataggio del token:', error);
                            addDebug(`❌ Errore salvataggio token: ${error.message}`);
                            setIsSubscribed(false);
                        } else {
                            addDebug('✅ Token salvato con successo!');
                            setIsSubscribed(true);
                        }
                    }
                }
                
            } else {
                addDebug('ℹ️ Non è stato possibile ottenere il token FCM.');
                setIsSubscribed(false);
            }
        } else {
            addDebug('❌ Permesso di notifica negato.');
            setIsSubscribed(false);
        }
    } catch (err) {
        addDebug(`❌ ERRORE FCM: ${err.name} - ${err.message}`);
        setIsSubscribed(false);
    }
  };

  const onMessageListener = () =>
    new Promise((resolve) => {
      onMessage(messaging, (payload) => {
        resolve(payload);
      });
    });

  const checkFCMSubscriptionStatus = async () => {
    addDebug('🔄 Configurazione profilo e gruppo...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    addDebug('✅ Profilo utente trovato');

    try {
        const { data: groupData, error: groupError } = await supabase
            .from('groups')
            .select('id')
            .eq('name', 'famiglia')
            .single();

        if (groupError) {
            console.error('Errore nel caricare il gruppo:', groupError);
            addDebug('❌ Errore nel caricare il gruppo');
            return;
        }

        addDebug('✅ Gruppo "famiglia" trovato');

        // Controlla se l'utente è già nel gruppo
        const { data: userGroupData, error: userGroupError } = await supabase
            .from('group_members')
            .select('*')
            .eq('user_id', user.id)
            .eq('group_id', groupData.id);

        if (userGroupData && userGroupData.length > 0) {
            addDebug('✅ Utente già nel gruppo');
        } else {
            addDebug('ℹ️ Utente non nel gruppo, aggiunta in corso...');
            const { error: insertError } = await supabase
                .from('group_members')
                .insert([{ user_id: user.id, group_id: groupData.id }]);

            if (insertError) {
                console.error('Errore nell\'aggiungere l\'utente al gruppo:', insertError);
                addDebug('❌ Errore nell\'aggiungere l\'utente al gruppo');
            } else {
                addDebug('✅ Utente aggiunto al gruppo!');
            }
        }

        // Cerca la sottoscrizione FCM dell'utente
        const { data: deviceData, error: deviceError } = await supabase
            .from('user_devices')
            .select('push_token')
            .eq('user_id', user.id);

        if (deviceError || !deviceData || deviceData.length === 0) {
            addDebug('ℹ️ Nessuna sottoscrizione FCM trovata');
            setIsSubscribed(false);
        } else {
            addDebug('✅ Sottoscrizione FCM trovata');
            setIsSubscribed(true);
        }

    } catch (err) {
        console.error('Errore generale nella configurazione:', err);
        addDebug(`❌ Errore configurazione: ${err.message}`);
        setIsSubscribed(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        checkFCMSubscriptionStatus();
      }
    });

    // Ascolta i messaggi FCM in foreground
    onMessageListener().then((payload) => {
        addDebug('🔔 Messaggio FCM ricevuto in primo piano!');
        // Potresti voler visualizzare una notifica in-app qui
        console.log('Messaggio ricevuto:', payload);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Pag_auth />} />
        <Route path="/*" element={
            <>
              {/* Passa le props necessarie a ProtectedRoutes */}
              <ProtectedRoutes session={session} isSubscribed={isSubscribed} />
              {session && (
                <div style={{ position: 'fixed', bottom: '20px', right: '20px', zIndex: 1000 }}>
                  <button
                    onClick={requestForToken}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: isSubscribed ? '#6c757d' : '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                    disabled={isSubscribed}
                  >
                    {isSubscribed ? 'Notifiche FCM ATTIVE' : 'Attiva Notifiche FCM'}
                  </button>
                  <button
                    onClick={() => {
                      const newWindow = window.open('', '_blank', 'width=600,height=800,scrollbars=yes,resizable=yes');
                      newWindow.document.write(`
                        <html>
                          <head>
                            <title>Debug FCM</title>
                            <style>
                              body { font-family: Arial, sans-serif; margin: 20px; }
                              pre { background: #f5f5f5; padding: 15px; border-radius: 5px; font-size: 12px; overflow-x: auto; }
                              .status { color: ${isSubscribed ? 'green' : 'red'}; font-weight: bold; }
                            </style>
                          </head>
                          <body>
                            <h2>🔍 Debug Notifiche FCM</h2>
                            <p>Stato notifiche: <span class="status">${isSubscribed ? '✅ ATTIVE' : '❌ NON ATTIVE'}</span></p>
                            <pre>${debugInfo}</pre>
                          </body>
                        </html>
                      `);
                    }}
                    style={{ 
                      display: 'block',
                      padding: '5px 10px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Debug FCM
                  </button>
                </div>
              )}
            </>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;