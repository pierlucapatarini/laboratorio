// Importa i moduli necessari
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import webpush from "https://esm.sh/web-push@3.6.6";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*', // Sostituisci con il tuo dominio di produzione
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
};

serve(async (req) => {
    // Gestisce le richieste OPTIONS per CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    // Gestione dell'errore se il metodo non è POST
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
            status: 405,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        // Estrai il messaggio e l'ID del gruppo dal corpo della richiesta
        const { message, group_id } = await req.json();

        // Crea il client Supabase con i permessi di Service Role
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Ottieni i token dei dispositivi per i membri del gruppo
        const { data: userDevices, error: devicesError } = await supabase
            .from('user_devices')
            .select(`push_token`)
            .in('user_id', supabase.from('group_members').select('user_id').eq('group_id', group_id));

        if (devicesError) {
            return new Response(JSON.stringify({ error: devicesError.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
        
        // Verifica se ci sono token da inviare
        if (!userDevices || userDevices.length === 0) {
            return new Response(JSON.stringify({ message: "Nessun dispositivo trovato per questo gruppo." }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        }

        // Imposta le chiavi VAPID dalle variabili d'ambiente
        const vapidKeys = {
            publicKey: Deno.env.get('VAPID_PUBLIC_KEY')!,
            privateKey: Deno.env.get('VAPID_PRIVATE_KEY')!,
        };

        // Prepara il payload della notifica
        const payload = JSON.stringify({
            title: "Nuova Notifica di Gruppo",
            body: message,
            url: "/" // URL da aprire quando si clicca la notifica
        });

        // Invia la notifica push a ogni dispositivo
        const pushPromises = userDevices.map(async (device) => {
            try {
                const subscription = JSON.parse(device.push_token);
                await webpush.sendNotification(subscription, payload, {
                    vapidKeys,
                    // Puoi aggiungere altre opzioni come 'headers' se necessario
                });
            } catch (pushError) {
                console.error('Errore nell\'invio della notifica:', pushError);
            }
        });

        // Attendi che tutte le notifiche vengano inviate
        await Promise.allSettled(pushPromises);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});