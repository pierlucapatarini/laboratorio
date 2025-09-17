import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';

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
  const [notificationMode, setNotificationMode] = useState('push'); // 'push' o 'fallback'

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

  // Service Worker con fallback
  useEffect(() => {
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          addDebug('✅ Service Worker registrato con successo');
          
          if (registration.installing) {
            addDebug('🔄 Service Worker in installazione...');
          } else if (registration.waiting) {
            addDebug('⏳ Service Worker in attesa...');
          } else if (registration.active) {
            addDebug('✅ Service Worker attivo');
          }
        } catch (error) {
          addDebug('❌ Errore registrazione SW: ' + error.message);
          addDebug('🔄 Passaggio a modalità fallback...');
          setNotificationMode('fallback');
        }
      } else {
        addDebug('❌ Service Worker non supportato - modalità fallback');
        setNotificationMode('fallback');
      }
    };

    registerServiceWorker();
  }, []);

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

  // Modalità Push tradizionale (con VAPID)
  const requestPushPermission = async () => {
    try {
      addDebug('🔄 Tentativo modalità Push...');
      
      if (!session) {
        addDebug('❌ Utente non autenticato');
        return;
      }

      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        addDebug('❌ Browser non supporta push - passaggio a fallback');
        setNotificationMode('fallback');
        return requestFallbackNotifications();
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        addDebug('❌ Permesso notifiche negato');
        return;
      }

      // Prova SENZA VAPID (solo per test)
      addDebug('🔄 Tentativo sottoscrizione SENZA VAPID...');
      const registration = await navigator.serviceWorker.ready;
      
      try {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true
          // Rimuoviamo applicationServerKey per testare
        });

        const pushToken = JSON.stringify(subscription);
        addDebug('✅ Sottoscrizione creata SENZA VAPID!');

        const { error } = await supabase
          .from('user_devices')
          .upsert(
            { user_id: session.user.id, push_token: pushToken }
          );

        if (error) {
          addDebug('❌ Errore salvataggio token: ' + error.message);
        } else {
          addDebug('✅ Token salvato - notifiche attivate!');
          alert('🎉 Notifiche attivate (modalità senza VAPID)!');
        }
      } catch (pushError) {
        addDebug('❌ Anche senza VAPID fallisce: ' + pushError.message);
        setNotificationMode('fallback');
        return requestFallbackNotifications();
      }

    } catch (err) {
      addDebug('❌ ERRORE Push: ' + err.message);
      setNotificationMode('fallback');
      return requestFallbackNotifications();
    }
  };

  // Modalità Fallback (notifiche browser semplici)
  const requestFallbackNotifications = async () => {
    try {
      addDebug('🔄 Attivazione modalità Fallback...');

      if (!('Notification' in window)) {
        addDebug('❌ Browser non supporta nemmeno notifiche base');
        alert('Il tuo browser non supporta le notifiche');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        addDebug('❌ Permesso notifiche negato');
        return;
      }

      const { error } = await supabase
        .from('user_devices')
        .upsert(
          { 
            user_id: session.user.id, 
            push_token: 'fallback-mode'
          }
        );

      if (error) {
        addDebug('❌ Errore salvataggio: ' + error.message);
      } else {
        addDebug('✅ Modalità fallback attivata!');
        
        // Test notifica immediata
        new Notification('🎉 Notifiche Attivate!', {
          body: 'Modalità fallback funzionante. Le notifiche saranno inviate tramite browser.',
          icon: '/images/icon-192x192.png'
        });
        
        alert('✅ Modalità Fallback attivata! Le notifiche funzioneranno via browser.');
      }

    } catch (err) {
      addDebug('❌ ERRORE Fallback: ' + err.message);
      alert('❌ Impossibile attivare le notifiche');
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
                  {/* Bottone principale */}
                  <button 
                    onClick={notificationMode === 'push' ? requestPushPermission : requestFallbackNotifications}
                    style={{ 
                      display: 'block',
                      marginBottom: '10px',
                      padding: '12px 16px',
                      backgroundColor: notificationMode === 'push' ? '#007bff' : '#ff6b35',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}
                  >
                    {notificationMode === 'push' ? '🚀 Attiva Push' : '🔔 Attiva Fallback'}
                  </button>
                  
                  {/* Bottone per cambiare modalità */}
                  <button 
                    onClick={() => setNotificationMode(notificationMode === 'push' ? 'fallback' : 'push')}
                    style={{ 
                      display: 'block',
                      marginBottom: '5px',
                      padding: '8px 12px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Cambia → {notificationMode === 'push' ? 'Fallback' : 'Push'}
                  </button>
                  
                  {/* Debug Info */}
                  <button 
                    onClick={() => {
                      const debugWindow = window.open('', '_blank', 'width=600,height=400,scrollbars=yes');
                      debugWindow.document.write(`
                        <html>
                          <head><title>Debug Notifiche</title></head>
                          <body style="font-family: monospace; font-size: 12px; padding: 10px;">
                            <h3>🔧 Debug Log</h3>
                            <p><strong>Modalità attuale:</strong> ${notificationMode}</p>
                            <pre style="background: #f5f5f5; padding: 10px; border: 1px solid #ddd; white-space: pre-wrap;">${debugInfo}</pre>
                          </body>
                        </html>
                      `);
                    }}
                    style={{ 
                      display: 'block',
                      padding: '5px 8px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    Debug
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