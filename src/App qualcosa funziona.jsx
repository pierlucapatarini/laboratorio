import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import { messaging } from './utils/firebase-config';
import { getToken, onMessage } from 'firebase/messaging';

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
  const [isSubscribed, setIsSubscribed] = useState(false);

  const addDebug = (message) => {
    console.log(message);
    setDebugInfo(prev => prev + '\n' + new Date().toLocaleTimeString() + ': ' + message);
  };

  useEffect(() => {
    const debugEnv = () => {
      addDebug('🔧 DEBUG AMBIENTE ALL\'AVVIO:');
      addDebug('- Ambiente: ' + (process.env.NODE_ENV || 'sconosciuto'));
      addDebug('- Host: ' + window.location.host);
      addDebug('- Protocol: ' + window.location.protocol);
      
      if (window.location.host.includes('vercel.app')) {
        addDebug('- Piattaforma: Vercel (produzione)');
      } else if (window.location.host.includes('localhost')) {
        addDebug('- Piattaforma: Locale (sviluppo)');
      }
    };
    
    debugEnv();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  // Registrazione del Service Worker
  useEffect(() => {
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          addDebug('✅ Service Worker registrato e pronto');
          
          if (registration.installing) {
            addDebug('🔄 Service Worker in installazione...');
          } else if (registration.waiting) {
            addDebug('⏳ Service Worker in attesa...');
          } else if (registration.active) {
            addDebug('✅ Service Worker attivo');
          }
        } catch (error) {
          addDebug('❌ Errore nella verifica dello stato SW: ' + error.message);
        }
      } else {
        addDebug('❌ Service Worker non supportato');
      }
    };

    registerServiceWorker();
  }, []);

  // Gestione profilo e gruppo
  useEffect(() => {
    const handleProfileAndGroup = async () => {
      if (!session) return;

      try {
        addDebug('🔄 Configurazione profilo e gruppo...');
        
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
          addDebug('✅ Gruppo "famiglia" creato');
        } else if (groupError) {
          addDebug('❌ Errore gruppo: ' + groupError.message);
          return;
        } else {
          addDebug('✅ Gruppo "famiglia" trovato');
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
          addDebug('✅ Profilo utente creato');
        } else {
          addDebug('✅ Profilo utente trovato');
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
          addDebug('✅ Utente aggiunto al gruppo');
        } else {
          addDebug('✅ Utente già nel gruppo');
        }
      } catch (error) {
        addDebug('❌ Errore setup: ' + error.message);
      }
    };

    handleProfileAndGroup();
  }, [session]);

  // Gestione messaggi FCM in foreground
  useEffect(() => {
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      addDebug('📨 Messaggio FCM ricevuto in foreground');
      console.log('Messaggio in foreground:', payload);
      
      // Mostra notifica personalizzata
      if (payload.notification) {
        new Notification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/images/icon-192x192.png'
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Controllo stato sottoscrizione FCM
  useEffect(() => {
    const checkFCMSubscription = async () => {
      if (!session) return;
      
      try {
        const { data: deviceData } = await supabase
          .from('user_devices')
          .select('push_token')
          .eq('user_id', session.user.id)
          .single();
        
        if (deviceData && deviceData.push_token) {
          const tokenData = JSON.parse(deviceData.push_token);
          setIsSubscribed(!!tokenData.fcmToken);
          addDebug('✅ Stato sottoscrizione FCM controllato: ' + (!!tokenData.fcmToken ? 'ATTIVA' : 'INATTIVA'));
        }
      } catch (error) {
        addDebug('ℹ️ Nessuna sottoscrizione FCM trovata');
      }
    };

    checkFCMSubscription();
  }, [session]);

  // Funzione per attivare notifiche FCM (senza VAPID)
  const requestFCMPermission = async () => {
    try {
      addDebug('🔄 Inizio processo attivazione notifiche FCM...');
      
      if (!session) {
        addDebug('❌ Utente non autenticato');
        return;
      }
      
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        addDebug('❌ Browser non supporta le notifiche');
        return;
      }

      // Richiedi permesso per le notifiche
      addDebug('🔄 Richiesta permesso notifiche...');
      const permission = await Notification.requestPermission();
      addDebug('📋 Permesso ricevuto: ' + permission);
      
      if (permission !== 'granted') {
        addDebug('❌ Permesso per le notifiche negato');
        alert('❌ Permesso per le notifiche negato');
        return;
      }

      // Attendi che il service worker sia pronto
      addDebug('🔄 Attesa Service Worker ready...');
      await navigator.serviceWorker.ready;
      addDebug('✅ Service Worker pronto');

      // Ottieni token FCM (senza VAPID key)
      addDebug('🔄 Ottenimento token FCM...');
      const fcmToken = await getToken(messaging);

      if (!fcmToken) {
        throw new Error('Impossibile ottenere il token FCM');
      }
      
      addDebug('✅ Token FCM ottenuto: ' + fcmToken.substring(0, 20) + '...');

      // Salva il token nel database
      const { error } = await supabase
        .from('user_devices')
        .upsert(
          { user_id: session.user.id, push_token: JSON.stringify({ fcmToken }) },
          { onConflict: 'user_id' }
        );

      if (error) {
        addDebug('❌ Errore salvataggio token: ' + error.message);
        throw error;
      }

      addDebug('✅ Token FCM salvato nel database con successo!');
      setIsSubscribed(true);
      alert('🎉 Notifiche FCM attivate con successo!');

    } catch (err) {
      addDebug('❌ ERRORE FCM: ' + err.name + ' - ' + err.message);
      console.error('Errore dettagliato FCM:', err);
      alert('❌ Errore nell\'attivazione delle notifiche FCM: ' + err.message);
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
                <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
                  <button 
                    onClick={requestFCMPermission} 
                    style={{ 
                      display: 'block',
                      marginBottom: '10px',
                      padding: '10px 15px',
                      backgroundColor: isSubscribed ? '#28a745' : '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    {isSubscribed ? '✅ Notifiche Attive' : 'Attiva Notifiche FCM'}
                  </button>
                  
                  <button 
                    onClick={() => {
                      const debugWindow = window.open('', '_blank', 'width=700,height=500');
                      debugWindow.document.write(`
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