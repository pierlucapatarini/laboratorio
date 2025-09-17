import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import { messaging, getToken, onMessage } from './firebase-config';

import Pag_auth from './pages/Pag_auth';
import Pag0_menu from './pages/Pag0_menu';
import SottoPag1_notifiche from './pages/SottoPag1_notifiche';

const ProtectedRoutes = ({ session }) => {
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
      <Route path="/notifiche" element={<SottoPag1_notifiche />} />
    </Routes>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [debugInfo, setDebugInfo] = useState('');
  const [fcmToken, setFcmToken] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState('default');

  const addDebug = (message) => {
    console.log(message);
    setDebugInfo(prev => prev + '\n' + new Date().toLocaleTimeString() + ': ' + message);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  // Configurazione profilo e gruppo (come prima)
  useEffect(() => {
    const handleProfileAndGroup = async () => {
      if (!session) return;

      try {
        let { data: group, error: groupError } = await supabase
          .from('groups')
          .select('id')
          .eq('name', 'famiglia')
          .single();

        if (groupError && groupError.code === 'PGRST116') {
          const { data } = await supabase
            .from('groups')
            .insert({ name: 'famiglia' })
            .select()
            .single();
          group = data;
        } else if (groupError) {
          addDebug('Errore gruppo: ' + groupError.message);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (!profile) {
          await supabase
            .from('profiles')
            .upsert({ id: session.user.id, username: session.user.email });
        }

        const { data: groupMember } = await supabase
          .from('group_members')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('group_id', group.id)
          .single();

        if (!groupMember) {
          await supabase
            .from('group_members')
            .upsert({ group_id: group.id, user_id: session.user.id });
        }

        addDebug('Configurazione utente completata');
      } catch (error) {
        addDebug('Errore setup: ' + error.message);
      }
    };

    handleProfileAndGroup();
  }, [session]);

  // Inizializzazione FCM
  useEffect(() => {
    const initializeFCM = async () => {
      if (!session) return;

      try {
        addDebug('Inizializzazione Firebase Cloud Messaging...');

        // Controlla se Firebase è supportato
        if (!messaging) {
          addDebug('Firebase Messaging non supportato in questo browser');
          return;
        }

        // Richiedi permessi notifiche
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        addDebug('Permesso notifiche: ' + permission);

        if (permission !== 'granted') {
          addDebug('Permessi notifiche negati');
          return;
        }

        // Ottieni FCM token
        const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
          addDebug('Chiave VAPID Firebase mancante nelle variabili ambiente');
          return;
        }

        const token = await getToken(messaging, { vapidKey });
        
        if (token) {
          addDebug('FCM Token ottenuto con successo');
          addDebug('Token length: ' + token.length);
          setFcmToken(token);

          // Salva il token nel database
          const { error } = await supabase
            .from('user_devices')
            .upsert({
              user_id: session.user.id,
              push_token: token,
              platform: 'fcm'
            });

          if (error) {
            addDebug('Errore salvataggio token: ' + error.message);
          } else {
            addDebug('FCM Token salvato nel database');
          }
        } else {
          addDebug('Impossibile ottenere FCM token');
        }

        // Gestisci messaggi in foreground
        const unsubscribe = onMessage(messaging, (payload) => {
          addDebug('Messaggio ricevuto in foreground');
          console.log('Message received: ', payload);
          
          // Mostra notifica personalizzata se l'app è aperta
          if (payload.notification) {
            new Notification(payload.notification.title || 'Nuova Notifica', {
              body: payload.notification.body,
              icon: '/images/icon-192x192.png',
              tag: 'fcm-notification'
            });
          }
        });

        // Cleanup
        return () => {
          if (unsubscribe) unsubscribe();
        };

      } catch (error) {
        addDebug('Errore inizializzazione FCM: ' + error.message);
        console.error('FCM Error:', error);
      }
    };

    initializeFCM();
  }, [session]);

  // Funzione per testare le notifiche
  const testFCMNotification = async () => {
    if (!fcmToken) {
      alert('FCM Token non disponibile. Attiva prima le notifiche.');
      return;
    }

    try {
      addDebug('Test invio notifica FCM...');

      // Trova il gruppo famiglia
      const { data: group } = await supabase
        .from('groups')
        .select('id')
        .eq('name', 'famiglia')
        .single();

      if (!group) {
        addDebug('Gruppo non trovato');
        return;
      }

      // Invia notifica tramite Edge Function
      const { data, error } = await supabase.functions.invoke('send-fcm-notification', {
        body: {
          message: 'Test notifica FCM funzionante!',
          group_id: group.id
        }
      });

      if (error) {
        addDebug('Errore invio notifica: ' + error.message);
      } else {
        addDebug('Notifica inviata con successo!');
      }
    } catch (error) {
      addDebug('Errore test notifica: ' + error.message);
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Pag_auth />} />
        <Route
          path="/*"
          element={
            <>
              <ProtectedRoutes session={session} />
              {session && (
                <div style={{ 
                  position: 'fixed', 
                  bottom: 20, 
                  right: 20, 
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {/* Status FCM */}
                  <div style={{
                    padding: '8px 12px',
                    backgroundColor: fcmToken ? '#28a745' : '#dc3545',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '12px',
                    textAlign: 'center'
                  }}>
                    FCM: {fcmToken ? 'Attivo' : 'Non attivo'}
                  </div>

                  {/* Bottone test notifica */}
                  <button 
                    onClick={testFCMNotification}
                    disabled={!fcmToken}
                    style={{ 
                      padding: '12px 16px',
                      backgroundColor: fcmToken ? '#007bff' : '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: fcmToken ? 'pointer' : 'not-allowed',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    Test FCM
                  </button>
                  
                  {/* Debug Info */}
                  <button 
                    onClick={() => {
                      const debugWindow = window.open('', '_blank', 'width=700,height=500,scrollbars=yes');
                      debugWindow.document.write(`
                        <html>
                          <head><title>Debug FCM</title></head>
                          <body style="font-family: monospace; font-size: 12px; padding: 15px;">
                            <h3>Firebase Cloud Messaging Debug</h3>
                            <p><strong>FCM Token:</strong> ${fcmToken ? 'Presente' : 'Assente'}</p>
                            <p><strong>Permessi:</strong> ${notificationPermission}</p>
                            <p><strong>Browser:</strong> ${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Altri'}</p>
                            <hr>
                            <h4>Log Dettagliato:</h4>
                            <pre style="background: #f5f5f5; padding: 10px; border: 1px solid #ddd; white-space: pre-wrap;">${debugInfo}</pre>
                          </body>
                        </html>
                      `);
                    }}
                    style={{ 
                      padding: '6px 10px',
                      backgroundColor: '#17a2b8',
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