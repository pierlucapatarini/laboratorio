import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const SottoPag1_notifiche = () => {
    const [message, setMessage] = useState('');
    const [group, setGroup] = useState(null);
    const [error, setError] = useState(null);

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

    const handleSendNotification = async (e) => {
        e.preventDefault();
        setError(null);

        if (!message || message.trim() === '') {
            setError('Il messaggio non può essere vuoto.');
            return;
        }

        if (!group) {
            setError('Impossibile trovare il gruppo. Riprova più tardi.');
            return;
        }

        try {
            // Chiama la tua Edge Function su Supabase per inviare la notifica
            const { data, error } = await supabase.functions.invoke('send-notification', {
                body: {
                    message: message,
                    group_id: group.id,
                },
            });

            if (error) {
                console.error('Errore nell\'invio della notifica:', error);
                setError('Errore nell\'invio della notifica. Controlla il log della funzione.');
            } else {
                console.log('Notifica inviata con successo!', data);
                setMessage(''); // Pulisci il campo del messaggio
            }
        } catch (err) {
            console.error('Errore di rete o di invocazione:', err);
            setError('Si è verificato un errore inaspettato. Controlla la console.');
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