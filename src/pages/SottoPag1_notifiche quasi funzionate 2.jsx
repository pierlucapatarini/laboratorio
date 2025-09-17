import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

// Accetta `isSubscribed` come prop
const SottoPag1_notifiche = ({ isSubscribed }) => {
  const [message, setMessage] = useState('');
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Rimuovi queste righe duplicate e non più necessarie
  // const [isSubscribed, setIsSubscribed] = useState(false);
  // const checkFCMSubscriptionStatus = async () => { ... }
  
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
    
    fetchGroup();
  }, []);

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!group) {
      setError('Gruppo non trovato. Impossibile inviare la notifica.');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Invia la notifica a tutti i membri del gruppo
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: { 
          groupId: group.id, 
          message 
        },
      });

      if (error) {
        console.error('Errore invocazione funzione:', error);
        setError('Errore durante l\'invio della notifica. Riprova più tardi.');
      } else {
        console.log('Notifica inviata con successo:', data);
        alert('Notifica inviata con successo!');
        setMessage(''); // Resetta il campo di testo
      }
    } catch (err) {
      console.error('Errore generale:', err);
      setError('Si è verificato un errore inaspettato.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Invia Notifica di Gruppo</h1>
        <form onSubmit={handleSendNotification} className="space-y-4">
          <div className="flex flex-col">
            <label htmlFor="message" className="text-sm font-medium text-gray-700 mb-1">
              Testo del Messaggio
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Inserisci qui il messaggio da inviare..."
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              rows="4"
              required
            ></textarea>
          </div>
          <button
            type="submit"
            disabled={loading || !isSubscribed}
            className={`w-full flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white transition-all duration-300 ease-in-out ${
              loading || !isSubscribed
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform active:scale-95 shadow-lg hover:scale-105'
            }`}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Invio in corso...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <span>🚀</span>
                <span>Invia Notifica FCM</span>
              </div>
            )}
          </button>
        </form>

        <div className="mt-6 text-center p-4 bg-gray-50 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">
            📡 Stato Notifiche FCM:
          </p>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
            isSubscribed
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}>
            <span>{isSubscribed ? '✅' : '❌'}</span>
            <span>{isSubscribed ? 'Attive e funzionanti' : 'Non attive'}</span>
          </div>

          {isSubscribed && (
            <p className="text-xs text-gray-500 mt-2">
              Il tuo dispositivo è correttamente sottoscritto.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SottoPag1_notifiche;