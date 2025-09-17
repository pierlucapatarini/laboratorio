import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { create as createJwt, getNumericDate, parse as parseJwt } from "jwt";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
let accessTokenCache: { token: string; expires: number } | null = null;

// Funzione per generare il token di accesso JWT
const getAccessToken = async () => {
  if (accessTokenCache && accessTokenCache.expires > Date.now()) {
    return accessTokenCache.token;
  }

  try {
    const serviceAccountJson = Deno.env.get("FCM_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      throw new Error("FCM_SERVICE_ACCOUNT environment variable not found.");
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const { private_key, client_email } = serviceAccount;

    const header = {
      alg: "RS256",
      typ: "JWT"
    };

    const now = getNumericDate(0);
    const payload = {
      iss: client_email,
      scope: FCM_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: getNumericDate(now + 3600), // Scade tra un'ora
    };

    const jwtToken = await createJwt(header, payload, private_key);

    const authResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwtToken,
      }),
    });

    if (!authResponse.ok) {
      throw new Error(`Failed to get access token: ${authResponse.statusText}`);
    }

    const authData = await authResponse.json();
    accessTokenCache = {
      token: authData.access_token,
      expires: Date.now() + (authData.expires_in - 300) * 1000, // Rinnova 5 minuti prima
    };

    return accessTokenCache.token;

  } catch (err) {
    console.error("Errore generazione token di accesso:", err);
    throw err;
  }
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 200 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { message, group_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userDevices, error: devicesError } = await supabase
      .from("user_devices")
      .select("push_token")
      .in(
        "user_id",
        supabase.from("group_members").select("user_id").eq("group_id", group_id)
      );

    if (devicesError) throw devicesError;

    if (!userDevices || userDevices.length === 0) {
      return new Response(JSON.stringify({ message: "Nessun dispositivo trovato." }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const accessToken = await getAccessToken();
    const projectId = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT")!).project_id;
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    
    await Promise.all(
      userDevices.map(async (device) => {
        try {
          const { fcmToken } = JSON.parse(device.push_token);
          
          const fcmPayload = {
            message: {
              token: fcmToken,
              notification: {
                title: "Nuova Notifica di Gruppo",
                body: message,
              },
              data: {
                url: "/",
              },
            },
          };

          const response = await fetch(fcmEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
            },
            body: JSON.stringify(fcmPayload),
          });
          
          if (!response.ok) {
            console.error(`Errore API FCM: ${response.status} - ${await response.text()}`);
          } else {
            console.log("Notifica FCM inviata con successo!");
          }
        } catch (pushError) {
          console.error("Errore invio notifica FCM:", pushError);
        }
      })
    );

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});