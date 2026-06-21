// Supabase Edge Function — sends a push notification via Expo's push API.
// Deploy with: supabase functions deploy send-push
//
// Called from the client as a fire-and-forget call after actions that should
// notify the other party (new message, timer extended, rating received).
// Body: { to: string (Expo push token), title: string, body: string, data?: object }

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, title, body, data } = await req.json();

    if (!to || typeof to !== 'string' || !to.startsWith('ExponentPushToken')) {
      return new Response(JSON.stringify({ error: 'Invalid or missing push token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const message = {
      to,
      sound: 'default',
      title: title || 'Proxie',
      body: body || '',
      data: data || {},
    };

    const expoRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await expoRes.json();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
