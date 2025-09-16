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
          console.log('Service Worker registrato con successo:', registration);
        } catch (error) {
          console.error('Errore nella registrazione del Service Worker:', error);
        }
      }
    };

    registerServiceWorker();
  }, []);

  useEffect(() => {
    const handleProfileAndGroup = async () => {
      if (!session) return;

      try {
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
        } else if (groupError) {
          console.error('Errore nel trovare il gruppo:', groupError);
          return;
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
        }
      } catch (error) {
        console.error('Errore nella gestione di profilo e gruppo:', error);
      }
    };

    handleProfileAndGroup();
  }, [session]);

  // Funzione per sottoscrivere alle notifiche push
  const requestPushPermission = async () => {
    if (!session) {
      console.warn('Utente non autenticato');
      return;
    }

    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      console.warn('Browser non supporta le notifiche push');
      return;
    }

    try {
      // Richiedi permesso per le notifiche
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('Permesso per le notifiche negato.');
        return;
      }

      // Ottieni la registrazione del Service Worker esistente
      const registration = await navigator.serviceWorker.ready;
      
      const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;
      if (!VAPID_PUBLIC_KEY) {
        console.error('Chiave VAPID pubblica mancante');
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      // Controlla se esiste già una sottoscrizione
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey
        });
      }

      const pushToken = JSON.stringify(subscription);

      // Salva il token nel database
      const { error } = await supabase
        .from('user_devices')
        .upsert(
          { user_id: session.user.id, push_token: pushToken }, 
          { onConflict: 'user_id' }
        );

      if (error) {
        console.error('Errore nel salvare il push token:', error);
      } else {
        console.log('Push token salvato con successo!');
        alert('Notifiche attivate con successo!');
      }
    } catch (err) {
      console.error('Errore nella registrazione o sottoscrizione alle notifiche push:', err);
      alert('Errore nell\'attivazione delle notifiche: ' + err.message);
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
                <button 
                  onClick={requestPushPermission} 
                  style={{ 
                    position: 'fixed', 
                    bottom: 20, 
                    right: 20,
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
              )}
            </>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;