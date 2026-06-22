// Supabase Edge Function — fires when an Outpost listing flips to confirmed.
// Called server-side by the on_outpost_confirmed Postgres trigger (via pg_net),
// not by the client — this is what makes delivery reliable even if the
// seller's app isn't open at the moment of confirmation.
//
// Deploy: supabase functions deploy notify-outpost-confirmed --no-verify-jwt
// (must be --no-verify-jwt: the DB trigger calls this server-to-server, with
// no user JWT to verify)
//
// Secrets required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Body (from the trigger): { listing_id: string }

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const { listing_id } = await req.json();
    if (!listing_id) {
      return new Response(JSON.stringify({ error: 'listing_id is required' }), { status: 400 });
    }

    const { data: listing } = await supabaseAdmin
      .from('listings')
      .select('title, seller:profiles!seller_id(display_name)')
      .eq('id', listing_id)
      .single();

    const sellerName = listing?.seller?.display_name || 'A seller';

    const { data: savers } = await supabaseAdmin
      .from('listing_saves')
      .select('user_id, profiles!user_id(push_token)')
      .eq('listing_id', listing_id);

    const tokens = (savers || [])
      .map((s: any) => s.profiles?.push_token)
      .filter((t: string | null) => !!t && t.startsWith('ExponentPushToken'));

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { 'Content-Type': 'application/json' } });
    }

    const messages = tokens.map((to: string) => ({
      to,
      sound: 'default',
      title: 'Outpost just went live',
      body: `${sellerName}'s outpost near you just went live${listing?.title ? ` — "${listing.title}"` : ''}`,
      data: { listingId: listing_id, type: 'outpost_confirmed' },
    }));

    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    return new Response(JSON.stringify({ sent: tokens.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
