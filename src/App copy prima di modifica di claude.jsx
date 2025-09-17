import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { supabase } from './utils/supabaseClient';
import { messaging } from './utils/firebase-config'; // Importa la configurazione di Firebase
import { getToken } from 'firebase/messaging'; // Importa getToken da firebase/messaging

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

  // Debug delle variabili d'ambiente all'avvi   o
  useEffect(() => {
    const debugEnv = () => {
      addDebug('🔧 DEBUG AMBIENTE ALL\'AVVIO:');
      addDebug('- Ambiente: ' + (process.env.NODE_ENV || 'sconosciuto'));
      addDebug('- Host: ' + window.location.host);
      addDebug('- Protocol: ' + window.location.protocol);
      
      // Controlla se siamo in produzione Vercel
      if (window.location.host.includes('vercel.app')) {
        addDebug('- Piattaforma: Vercel (produzione)');
      } else if (window.location.host.includes('localhost')) {
        addDebug('- Piattaforma: Locale (sviluppo)');
      }
      
      // Debug variabili d'ambiente
      if (typeof process !== 'undefined' && process.env) {
        const allReactVars = Object.keys(process.env)
          .filter(key => key.startsWith('REACT_APP_'))
          .map(key => `${key}: ${process.env[key] ? 'PRESENTE' : 'VUOTA'}`);
        addDebug('- Variabili REACT_APP: ' + (allReactVars.length > 0 ? allReactVars.join(', ') : 'NESSUNA'));
      } else {
        addDebug('- process.env non disponibile (normale in produzione ottimizzata)');
      }
    };
    
    debugEnv();
  }, []);

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
          // Nota: la registrazione del SW di Firebase ora è in index.js
          const registration = await navigator.serviceWorker.ready;
          addDebug('✅ Service Worker registrato e pronto');
          
          // Verifica lo stato del service worker
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
      addDebug('🔄 Inizio processo attivazione notifiche FCM...');
      
      if (!session) {
        addDebug('❌ Utente non autenticato');
        return;
      }
      
      // Controlli supporto browser
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        addDebug('❌ Browser non supporta le API necessarie per le notifiche push.');
        return;
      }

      // Richiedi permesso per le notifiche
      addDebug('🔄 Richiesta permesso notifiche...');
      const permission = await Notification.requestPermission();
      addDebug('📋 Permesso ricevuto: ' + permission);
      
      if (permission !== 'granted') {
        addDebug('❌ Permesso per le notifiche negato');
        return;
      }

      // Ottieni il token di registrazione FCM
      const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;
      if (!VAPID_PUBLIC_KEY) {
        addDebug('❌ Chiave VAPID pubblica mancante');
        return;
      }

      addDebug('🔄 Ottenimento token di registrazione FCM...');
      const fcmToken = await getToken(messaging, {
        vapidKey: VAPID_PUBLIC_KEY
      });

      if (!fcmToken) {
        throw new Error('Impossibile ottenere il token di registrazione FCM.');
      }
      
      addDebug('✅ Token FCM ottenuto: ' + fcmToken);

      // Salva il token nel database.
      const { error } = await supabase
        .from('user_devices')
        .upsert(
          { user_id: session.user.id, push_token: JSON.stringify({ fcmToken }) },
          { onConflict: 'user_id' }
        );

      if (error) {
        addDebug('❌ Errore salvataggio token: ' + error.message);
        throw error;
      } else {
        addDebug('✅ Token FCM salvato nel database con successo!');
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