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
  const rawData = atob(base64String);
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

  useEffect(() => {
    const handleProfileAndGroup = async () => {
      if (!session) return;

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

      // Aggiungi l’utente al gruppo se non presente
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
    };

    handleProfileAndGroup();
  }, [session]);

  // Funzione per registrare SW e sottoscrivere push
  const requestPushPermission = async () => {
    if (!session) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Permesso per le notifiche negato.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');

      // Attendi che il SW sia attivo
      if (registration.installing) {
        await new Promise(resolve => {
          registration.installing.addEventListener('statechange', e => {
            if (e.target.state === 'activated') resolve();
          });
        });
      }

      const VAPID_PUBLIC_KEY = "BNWTXLfrRP7MdKXRc5sczlsJdFuWpDRs5CEFnp413D3-KEGCIF5zWT_4g_pdT7RUrf4-AcugJdF4PenK620829U";
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      const pushToken = JSON.stringify(subscription);

      const { error } = await supabase
        .from('user_devices')
        .upsert({ user_id: session.user.id, push_token: pushToken }, { onConflict: ['push_token'] });

      if (error) console.error('Errore nel salvare il push token:', error);
      else console.log('Push token salvato con successo!');
    } catch (err) {
      console.error('Errore nella registrazione o sottoscrizione alle notifiche push:', err);
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
                <button onClick={requestPushPermission} style={{ position: 'fixed', bottom: 20, right: 20 }}>
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
