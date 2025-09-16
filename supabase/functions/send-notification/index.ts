import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import webpush from "https://esm.sh/web-push@3.6.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
  // Gestisce le richieste OPTIONS per CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const { message, group_id } = await req.json();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: userDevices, error: devicesError } = await supabase
      .from('user_devices')
      .select('push_token')
      .in('user_id', supabase.from('group_members').select('user_id').eq('group_id', group_id));

    if (devicesError) {
      return new Response(JSON.stringify({ error: devicesError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!userDevices || userDevices.length === 0) {
      return new Response(JSON.stringify({ message: "Nessun dispositivo trovato per questo gruppo." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const vapidKeys = {
      publicKey: Deno.env.get('VAPID_PUBLIC_KEY'),
      privateKey: Deno.env.get('VAPID_PRIVATE_KEY')
    };

    const payload = JSON.stringify({ title: "Nuova Notifica di Gruppo", body: message, url: "/" });

    const pushPromises = userDevices.map(async (device) => {
      try {
        const subscription = JSON.parse(device.push_token);
        await webpush.sendNotification(subscription, payload, { vapidKeys });
      } catch (pushError) {
        console.error('Errore nell\'invio della notifica:', pushError);
      }
    });

    await Promise.allSettled(pushPromises);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
