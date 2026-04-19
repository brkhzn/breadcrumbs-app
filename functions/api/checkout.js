// Cloudflare Pages Function — Stripe Checkout Session
//
// POST /api/checkout
// Body: { did, tier }  — tier: 'monthly' | 'annual' | 'lifetime'
// Env:  STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL,
//       STRIPE_PRICE_LIFETIME
// Returns: { url }  — Stripe Checkout hosted page URL

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { headers: CORS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { did, tier } = body;
  if (!did || !['monthly', 'annual', 'lifetime'].includes(tier)) {
    return json({ error: 'Missing or invalid did / tier' }, 400);
  }

  const priceId = {
    monthly:  env.STRIPE_PRICE_MONTHLY,
    annual:   env.STRIPE_PRICE_ANNUAL,
    lifetime: env.STRIPE_PRICE_LIFETIME,
  }[tier];

  if (!priceId) {
    return json({ error: `Stripe price ID for "${tier}" is not configured` }, 500);
  }

  // Determine mode: 'subscription' for recurring, 'payment' for lifetime one-time
  const mode = tier === 'lifetime' ? 'payment' : 'subscription';

  const origin = new URL(request.url).origin;

  const params = new URLSearchParams({
    mode,
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    client_reference_id: did,          // used in webhook to tie payment → DID
    'success_url': `${origin}/?sub=success`,
    'cancel_url':  `${origin}/?sub=cancel`,
    // Pre-fill the billing email field if we ever pass it
    // 'customer_email': email,
  });

  // For subscriptions allow promotion codes
  if (mode === 'subscription') {
    params.set('allow_promotion_codes', 'true');
  }

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const session = await resp.json();

  if (!resp.ok) {
    console.error('Stripe error:', session);
    return json({ error: session.error?.message || 'Stripe request failed' }, 502);
  }

  return json({ url: session.url });
}
