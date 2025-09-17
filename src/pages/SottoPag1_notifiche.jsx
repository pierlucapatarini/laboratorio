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

    const checkFCMSubscriptionStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: deviceData } = await supabase
          .from('user_devices')
          .select('push_token')
          .eq('user_id', user.id)
          .single();
        
        if (deviceData && deviceData.push_token) {
          const tokenData = JSON.parse(deviceData.push_token);
          setIsSubscribed(!!tokenData.fcmToken);
        }
      } catch (err) {
        console.log('Nessuna sottoscrizione FCM trovata');
        setIsSubscribed(false);
      }
    };

    fetchGroup();
    checkFCMSubscriptionStatus();
    
    // Controlla periodicamente lo stato della sottoscrizione
    const interval = setInterval(checkFCMSubscriptionStatus, 3000);
    return () => clearInterval(interval);
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

      if (!isSubscribed) {
        throw new Error('Devi prima attivare le notifiche FCM usando il bottone in basso a destra.');
      }

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error('Utente non autenticato.');
      }

      console.log('Invio notifica FCM...');
      const { data, error: fnError } = await supabase.functions.invoke('send-notification', {
        body: { message: message.trim(), group_id: group.id },
      });

      if (fnError) {
        console.error('Errore nell\'invio della notifica FCM:', fnError);
        throw new Error(`Errore nell'invio FCM: ${fnError.message || 'Errore sconosciuto'}`);
      }

      console.log('Notifica FCM inviata con successo!', data);
      setMessage('');
      
      // Feedback visivo migliorato
      const successDiv = document.createElement('div');
      successDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 20px;">🚀</span>
          <span>Notifica FCM inviata con successo!</span>
        </div>
      `;
      successDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #4CAF50, #45a049);
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-family: Arial, sans-serif;
        animation: slideIn 0.3s ease-out;
      `;
      
      // Aggiungi animazione CSS
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
      
      document.body.appendChild(successDiv);
      setTimeout(() => {
        if (document.body.contains(successDiv)) {
          document.body.removeChild(successDiv);
        }
        if (document.head.contains(style)) {
          document.head.removeChild(style);
        }
      }, 4000);

    } catch (err) {
      console.error('Errore nell\'invio della notifica FCM:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📢 Notifiche FCM
          </h1>
          <p className="text-gray-600 text-sm">
            Invia notifiche push al gruppo famiglia
          </p>
        </div>
        
        {!isSubscribed && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-amber-800 font-medium text-sm">
                  Notifiche FCM non attive
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  Usa il bottone "Attiva Notifiche FCM" in basso a destra
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSendNotification} className="space-y-6">
          <div>
            <label htmlFor="message" className="block text-gray-700 font-medium mb-2">
              💬 Messaggio:
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
              placeholder="Scrivi il tuo messaggio per il gruppo famiglia..."
              rows="4"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">
              {message.length}/500 caratteri
            </p>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-red-500">❌</span>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}
          
          <button
            type="submit"
            disabled={loading || !isSubscribed || !message.trim()}
            className={`w-full py-3 px-6 rounded-lg font-medium transition-all transform ${
              loading || !isSubscribed || !message.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed scale-100'
                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg hover:scale-105'
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
              🎯 Pronto per inviare notifiche push al gruppo famiglia
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SottoPag1_notifiche;