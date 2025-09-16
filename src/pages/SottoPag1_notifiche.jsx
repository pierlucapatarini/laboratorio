import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const SottoPag1_notifiche = () => {
  const [message, setMessage] = useState('');
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);

  const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

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

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
  };

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

    try {
      // Controllo chiave VAPID
      if (!VAPID_PUBLIC_KEY) {
        setError('Chiave pubblica VAPID mancante.');
        return;
      }

      // Controllo supporto Service Worker e Push
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setError('Il tuo browser non supporta le notifiche push.');
        return;
      }

      // Richiesta permesso notifiche
      if (Notification.permission !== 'granted') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setError('Permesso per le notifiche negato.');
          return;
        }
      }

      // Registrazione service worker
      const swUrl = '/service-worker.js';
      const response = await fetch(swUrl);
      if (!response.ok) {
        setError('Service Worker non trovato. Verifica che /service-worker.js esista.');
        return;
      }

      const registration = await navigator.serviceWorker.register(swUrl);

      // Creazione subscription push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const pushToken = JSON.stringify(subscription);

      // Salvataggio in Supabase
      const { error: tokenError } = await supabase
        .from('user_devices')
        .upsert(
          { user_id: supabase.auth.getUser().data.user.id, push_token: pushToken },
          { onConflict: ['push_token'] }
        );

      if (tokenError) {
        console.error('Errore nel salvare il push token:', tokenError);
      } else {
        console.log('Push token salvato con successo!');
      }

      // Invio notifica tramite Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('send-notification', {
        body: { message, group_id: group.id },
      });

      if (fnError) {
        console.error('Errore nell\'invio della notifica:', fnError);
        setError('Errore nell\'invio della notifica. Controlla il log della funzione.');
      } else {
        console.log('Notifica inviata con successo!', data);
        setMessage('');
      }
    } catch (err) {
      console.error('Errore nella registrazione alle notifiche push:', err);
      setError('Si è verificato un errore. Controlla la console.');
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
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Invia Notifica
          </button>
        </div>
      </form>
    </div>
  );
};

export default SottoPag1_notifiche;
