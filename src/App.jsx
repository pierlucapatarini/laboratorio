import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';

import Pag_auth from './pages/Pag_auth';
import Pag0_menu from './pages/Pag0_menu';
import SottoPag1_notifiche from './pages/SottoPag1_notifiche';

// Funzione helper per convertire la chiave VAPID
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

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

  // Registrazione del Service Worker all'avvio dell'app
  useEffect(() => {
    const registerServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          addDebug('✅ Service Worker registrato con successo');
          
          // Verifica lo stato del service worker
          if (registration.installing) {
            addDebug('🔄 Service Worker in installazione...');
          } else if (registration.waiting) {
            addDebug('⏳ Service Worker in attesa...');
          } else if (registration.active) {
            addDebug('✅ Service Worker attivo');
          }
        } catch (error) {
          addDebug('❌ Errore registrazione SW: ' + error.message);
        }
      } else {
        addDebug('❌ Service Worker non supportato');
      }
    };

    registerServiceWorker();
  }, []);

  useEffect(() => {
    const handleProfileAndGroup = async () => {
      if (!session) return;

      try {
        addDebug('🔄 Configurazione profilo e gruppo...');
        
        // Trova o crea il gruppo "famiglia"
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

        // Trova o crea il profilo utente
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

        // Aggiungi l'utente al gruppo se non presente
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

  // Funzione per sottoscrivere alle notifiche push (con debug dettagliato)
  const requestPushPermission = async () => {
    try {
      addDebug('🔄 Inizio processo attivazione notifiche...');
      
      if (!session) {
        addDebug('❌ Utente non autenticato');
        return;
      }

      // Controlli supporto browser
      if (!('Notification' in window)) {
        addDebug('❌ Browser non supporta Notification API');
        return;
      }

      if (!('serviceWorker' in navigator)) {
        addDebug('❌ Browser non supporta Service Worker');
        return;
      }

      if (!('PushManager' in window)) {
        addDebug('❌ Browser non supporta Push API');
        return;
      }

      // Controllo chiave VAPID
      const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;
      if (!VAPID_PUBLIC_KEY) {
        addDebug('❌ Chiave VAPID pubblica mancante');
        addDebug('Variabili disponibili: ' + Object.keys(process.env).filter(k => k.startsWith('REACT_APP_')).join(', '));
        return;
      }
      addDebug('✅ Chiave VAPID trovata: ' + VAPID_PUBLIC_KEY.substring(0, 10) + '...');

      // Richiedi permesso per le notifiche
      addDebug('🔄 Richiesta permesso notifiche...');
      const permission = await Notification.requestPermission();
      addDebug('📋 Permesso ricevuto: ' + permission);
      
      if (permission !== 'granted') {
        addDebug('❌ Permesso per le notifiche negato');
        return;
      }

      // Ottieni la registrazione del Service Worker
      addDebug('🔄 Attesa Service Worker ready...');
      const registration = await navigator.serviceWorker.ready;
      addDebug('✅ Service Worker pronto');

      // Controlla sottoscrizione esistente
      addDebug('🔄 Controllo sottoscrizione esistente...');
      let subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        addDebug('✅ Sottoscrizione esistente trovata');
      } else {
        addDebug('🔄 Creazione nuova sottoscrizione...');
        
        try {
          const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
          addDebug('✅ Chiave VAPID convertita');
          
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });
          addDebug('✅ Sottoscrizione creata con successo');
        } catch (subscribeError) {
          addDebug('❌ Errore creazione sottoscrizione: ' + subscribeError.name + ' - ' + subscribeError.message);
          
          // Informazioni aggiuntive per debug
          if (subscribeError.name === 'NotSupportedError') {
            addDebug('💡 Il browser potrebbe non supportare push con questa configurazione');
          } else if (subscribeError.name === 'NotAllowedError') {
            addDebug('💡 L\'utente ha negato il permesso o la pagina non è sicura');
          } else if (subscribeError.name === 'AbortError') {
            addDebug('💡 Errore del servizio push - controlla la chiave VAPID');
          }
          
          throw subscribeError;
        }
      }

      const pushToken = JSON.stringify(subscription);
      addDebug('✅ Token generato (lunghezza: ' + pushToken.length + ')');

      // Salva il token nel database
      addDebug('🔄 Salvataggio token nel database...');
      const { error } = await supabase
        .from('user_devices')
        .upsert(
          { user_id: session.user.id, push_token: pushToken }, 
          { onConflict: 'user_id' }
        );

      if (error) {
        addDebug('❌ Errore salvataggio token: ' + error.message);
        throw error;
      } else {
        addDebug('✅ Token salvato nel database con successo!');
        alert('🎉 Notifiche attivate con successo!');
      }
    } catch (err) {
      addDebug('❌ ERRORE GENERALE: ' + err.name + ' - ' + err.message);
      alert('❌ Errore nell\'attivazione delle notifiche. Controlla la console per i dettagli.');
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
              {/* Bottone per attivare notifiche */}
              {session && (
                <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
                  <button 
                    onClick={requestPushPermission} 
                    style={{ 
                      display: 'block',
                      marginBottom: '10px',
                      padding: '10px 15px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '5px',
                      cursor: 'pointer'
                    }}
                  >
                    Attiva Notifiche
                  </button>
                  
                  {/* Bottone per mostrare debug */}
                  <button 
                    onClick={() => {
                      const debugWindow = window.open('', '_blank', 'width=600,height=400');
                      debugWindow.document.write(`
                        <html>
                          <head><title>Debug Info</title></head>
                          <body>
                            <h2>Debug Notifiche Push</h2>
                            <pre style="font-family: monospace; font-size: 12px; background: #f5f5f5; padding: 10px; border: 1px solid #ddd;">${debugInfo}</pre>
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
                    Debug Info
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