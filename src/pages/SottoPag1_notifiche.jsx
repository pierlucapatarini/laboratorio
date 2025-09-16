import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const SottoPag1_notifiche = () => {
  const [message, setMessage] = useState('');
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
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
      } catch (err) {
        console.error('Errore fetch gruppo:', err);
        setError('Errore nel caricare il gruppo.');
      }
    };

    const checkSubscriptionStatus = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (err) {
          console.error('Errore nel controllare lo stato della sottoscrizione:', err);
        }
      }
    };

    fetchGroup();
    checkSubscriptionStatus();
  }, []);

  const handleSendNotification = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!message.trim()) {
        throw new Error('Il messaggio non può essere vuoto.');
      }

      if (!group) {
        throw new Error('Impossibile trovare il gruppo. Riprova più tardi.');
      }

      // Controlla se l'utente è sottoscritto alle notifiche
      if (!isSubscribed) {
        throw new Error('Devi prima attivare le notifiche usando il bottone in basso a destra.');
      }

      // Ottieni l'utente corrente
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Utente non autenticato.');
      }

      // Invio notifica tramite Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('send-notification', {
        body: { message: message.trim(), group_id: group.id },
      });

      if (fnError) {
        console.error('Errore nell\'invio della notifica:', fnError);
        throw new Error(`Errore nell'invio: ${fnError.message || 'Errore sconosciuto'}`);
      }

      console.log('Notifica inviata con successo!', data);
      setMessage('');
      
      // Mostra feedback positivo
      const successDiv = document.createElement('div');
      successDiv.textContent = 'Notifica inviata con successo!';
      successDiv.style.cssText = 'position:fixed;top:20px;right:20px;background:green;color:white;padding:10px;border-radius:5px;z-index:1000';
      document.body.appendChild(successDiv);
      setTimeout(() => document.body.removeChild(successDiv), 3000);

    } catch (err) {
      console.error('Errore nell\'invio della notifica:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
          Invia una Notifica
        </h1>
        
        {!isSubscribed && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded">
            <p className="text-yellow-700 text-sm">
              ⚠️ Attiva prima le notifiche usando il bottone in basso a destra
            </p>
          </div>
        )}

        <form onSubmit={handleSendNotification} className="space-y-4">
          <div>
            <label htmlFor="message" className="block text-gray-700 font-medium mb-2">
              Messaggio:
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Scrivi il tuo messaggio..."
              rows="4"
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 rounded">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !isSubscribed}
            className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${
              loading || !isSubscribed
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {loading ? 'Invio in corso...' : 'Invia Notifica'}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            Stato notifiche: 
            <span className={`ml-1 font-medium ${isSubscribed ? 'text-green-600' : 'text-red-600'}`}>
              {isSubscribed ? '✅ Attive' : '❌ Non attive'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SottoPag1_notifiche;