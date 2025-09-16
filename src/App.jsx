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
      if (!newSession) {
        navigate('/auth');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  if (!session) {
    return null; 
  }

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleProfileAndGroup = async () => {
      if (session) {
        // Trova o crea il gruppo "famiglia"
        let { data: group, error: groupError } = await supabase
          .from('groups')
          .select('id')
          .eq('name', 'famiglia')
          .single();

        if (groupError && groupError.code === 'PGRST116') {
          console.log("Il gruppo 'famiglia' non esiste. Lo sto creando...");
          const { data, error } = await supabase
            .from('groups')
            .insert({ name: 'famiglia' })
            .select()
            .single();

          if (error) {
            console.error('Errore nella creazione del gruppo:', error);
            return;
          }
          group = data;
        } else if (groupError) {
          console.error('Errore nel trovare il gruppo:', groupError);
          return;
        }

        // 1. Trova il profilo dell'utente
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Errore nel trovare il profilo utente:', profileError);
            return;
        }
        
        // 2. Se il profilo non esiste, lo creiamo
        if (!profile) {
            console.log("Creazione del profilo...");
            const { error: insertProfileError } = await supabase
                .from('profiles')
                .upsert({ id: session.user.id, username: session.user.email });
            
            if (insertProfileError) {
                console.error('Errore nell\'inserimento del profilo:', insertProfileError);
                return;
            }
        }

        // 3. Verifica se l'utente è già un membro del gruppo
        const { data: groupMember, error: memberError } = await supabase
            .from('group_members')
            .select('*')
            .eq('user_id', session.user.id)
            .eq('group_id', group.id)
            .single();
            
        if (memberError && memberError.code !== 'PGRST116') {
            console.error('Errore nel trovare il membro del gruppo:', memberError);
            return;
        }

        // 4. Se l'utente non è ancora un membro del gruppo, lo aggiungiamo
        if (!groupMember) {
            console.log("Aggiunta dell'utente al gruppo 'famiglia'...");
            const { error: insertMemberError } = await supabase
                .from('group_members')
                .upsert({ group_id: group.id, user_id: session.user.id });
            
            if (insertMemberError) {
                console.error('Errore nell\'aggiunta del membro al gruppo:', insertMemberError);
            }
        }
        
        // Nuova funzione per richiedere e salvare il token delle notifiche push
        requestPushPermission(session);
      }
    };
    handleProfileAndGroup();
  }, [session]);

  const requestPushPermission = async (session) => {
    if (!('Notification' in window)) {
        console.warn('Questo browser non supporta le notifiche push.');
        return;
    }
    
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        console.warn('Permesso per le notifiche negato.');
        return;
    }
    
    try {
        const serviceWorkerRegistration = await navigator.serviceWorker.register('/service-worker.js');
        
        const VAPID_PUBLIC_KEY = "BNWTXLfrRP7MdKXRc5sczlsJdFuWpDRs5CEFnp413D3-KEGCIF5zWT_4g_pdT7RUrf4-AcugJdF4PenK620829U";
        
        const subscription = await serviceWorkerRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: VAPID_PUBLIC_KEY
        });
        
        const pushToken = JSON.stringify(subscription);
        
        const { error } = await supabase
            .from('user_devices')
            .upsert({ user_id: session.user.id, push_token: pushToken }, { onConflict: ['push_token'] });
            
        if (error) {
            console.error('Errore nel salvare il push token:', error);
        } else {
            console.log('Push token salvato con successo!');
        }
    } catch (error) {
        console.error('Errore nella registrazione o sottoscrizione alle notifiche push:', error);
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<Pag_auth />} />
        <Route path="/*" element={<ProtectedRoutes session={session} />} />
      </Routes>
    </Router>
  );
}

export default App;