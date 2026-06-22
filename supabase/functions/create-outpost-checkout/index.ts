// Supabase Edge Function — creates a Stripe Checkout Session for the Outpost
// posting fee and returns its hosted URL. The client opens that URL in the
// system browser (Linking.openURL) — never an embedded WebView — so this
// qualifies as an "external purchase link" under Apple's US storefront rules
// (App Store Review Guidelines 3.1.1(a) / 3.1.3) rather than requiring IAP.
//
// Deploy: supabase functions deploy create-outpost-checkout
// Secrets required: STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
//
// Body: { listing_id: string }
// Returns: { url: string }

import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { listing_id } = await req.json();
    if (!listing_id) {
      return new Response(JSON.stringify({ error: 'listing_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the listing belongs to this seller and is actually an Outpost listing
    const { data: listing, error: listingError } = await supabaseAdmin
      .from('listings')
      .select('id, title, seller_id, is_outpost, outpost_fee_paid')
      .eq('id', listing_id)
      .single();

    if (listingError || !listing) {
      return new Response(JSON.stringify({ error: 'Listing not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.seller_id !== user.id || !listing.is_outpost) {
      return new Response(JSON.stringify({ error: 'Not authorized for this listing' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (listing.outpost_fee_paid) {
      return new Response(JSON.stringify({ error: 'Fee already paid' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fee amount is read from app_config, never hardcoded — Stripe needs cents.
    const { data: config } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', 'outpost_fee_usd')
      .single();
    const feeUsd = Number(config?.value ?? 5.99);
    const feeCents = Math.round(feeUsd * 100);

    const siteUrl = Deno.env.get('SITE_URL') ?? 'https://proxie-garage-sale.netlify.app';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Outpost listing fee — "${listing.title}"` },
          unit_amount: feeCents,
        },
        quantity: 1,
      }],
      client_reference_id: listing_id,
      metadata: { listing_id, seller_id: user.id },
      success_url: `${siteUrl}/outpost-success?listing_id=${listing_id}`,
      cancel_url: `${siteUrl}/outpost-cancel?listing_id=${listing_id}`,
    });

    // Record the fee amount that was actually charged for this listing
    await supabaseAdmin
      .from('listings')
      .update({ outpost_fee_amount: feeUsd })
      .eq('id', listing_id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
