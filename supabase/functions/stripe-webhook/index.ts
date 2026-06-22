// Supabase Edge Function — Stripe webhook receiver for the Outpost fee.
// Listens for checkout.session.completed and sets outpost_fee_paid = true
// on the matching listing.
//
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
// (must be --no-verify-jwt: Stripe calls this directly, with no Supabase JWT —
// it's authenticated instead by the Stripe-Signature header below)
//
// Secrets required: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
//                    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// After deploying, register this function's URL as a webhook endpoint in the
// Stripe Dashboard for the checkout.session.completed event, then copy the
// signing secret it gives you into STRIPE_WEBHOOK_SECRET.

import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${e.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const listingId = session.client_reference_id || session.metadata?.listing_id;

    if (listingId) {
      await supabaseAdmin
        .from('listings')
        .update({ outpost_fee_paid: true })
        .eq('id', listingId);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
