import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const SottoPag1_notifiche = () => {
  const [message, setMessage] = useState('');
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // 1️⃣ Recupera il gruppo "famiglia"
  useEffect(() => {
    const fetchGroup = async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id')
        .eq('name', 'famiglia')
        .single();

      if (error) {
        console.error('Errore nel caricare il gruppo:', error);
        setError('Errore nel caricare il gruppo. Riprova più tardi.');
      } else {
        setGroup(data);
      }
    };

    fetchGroup();
  }, []);

  // 2️⃣ Registrazione push token
  useEffect(() => {
    const registerPush = async () => {
      if (!group) return;

      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push notifications non supportate in questo browser.');
        return;
      }

      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('Permesso per le notifiche negato.');
          return;
        }

        const registration = await navigator.serviceWorker.register('/service-worker.js');

        const VAPID_PUBLIC_KEY = import.meta.env.REACT_APP_VAPID_PUBLIC_KEY;

        function urlBase64ToUint8Array(base64String) {
          const padding = '='.repeat((4 - base64String.length % 4) % 4);
          const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
          const rawData = atob(base64);
          return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        const pushToken = JSON.stringify(subscription);

        const { error } = await supabase
          .from('user_devices')
          .upsert({ user_id: supabase.auth.getUser().data.user.id, push_token: pushToken }, { onConflict: ['push_token'] });

        if (error) {
          console.error('Errore nel salvare il push token:', error);
        } else {
          console.log('Push token salvato con successo!');
        }
      } catch (err) {
        console.error('Errore nella registrazione alle notifiche push:', err);
      }
    };

    registerPush();
  }, [group]);

  // 3️⃣ Invio della notifica tramite Edge Function
  const handleSendNotification = async (e) => {
    e.preventDefault();
    setError(null);

    if (!message.trim()) {
      setError('Il messaggio non può essere vuoto.');
      return;
    }

    if (!group) {
      setError('Impossibile trovare il gruppo. Riprova più tardi.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        'https://upqfjtqubuzutnkplbde.supabase.co/functions/v1/send-notification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY
          },
          body: JSON.stringify({
            message,
            group_id: group.id
          })
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Errore HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();
      console.log('Notifica inviata con successo!', data);
      setMessage('');
    } catch (err) {
      console.error('Errore nell\'invio della notifica:', err);
      setError('Si è verificato un errore. Controlla la console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">Invia una Notifica</h1>
      <form onSubmit={handleSendNotification} className="w-full max-w-sm">
        <div className="mb-4">
          <label htmlFor="message" className="block text-gray-700 font-bold mb-2">
            Messaggio:
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            placeholder="Scrivi il tuo messaggio..."
            rows="4"
          ></textarea>
        </div>
        {error && <p className="text-red-500 text-xs italic mb-4">{error}</p>}
        <div className="flex items-center justify-between">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
          >
            {loading ? 'Invio...' : 'Invia Notifica'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SottoPag1_notifiche;
