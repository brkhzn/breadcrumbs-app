// Cloudflare Pages Function — Stripe Billing Portal
//
// POST /api/billing-portal
// Body: { did }
// Env:  STRIPE_SECRET_KEY, BC_SUBS (KV namespace)
// Returns: { url }  — Stripe Customer Portal URL

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
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const { did } = body;
  if (!did) return json({ error: 'Missing did' }, 400);

  const kv = env.BC_SUBS;
  const raw = kv ? await kv.get(`sub:${did}`) : null;
  if (!raw) return json({ error: 'No subscription found for this account' }, 404);

  const sub = JSON.parse(raw);
  if (!sub.stripeCustomerId) return json({ error: 'No Stripe customer on record' }, 404);

  const origin = new URL(request.url).origin;

  const resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/?tab=settings`,
    }).toString(),
  });

  const portal = await resp.json();
  if (!resp.ok) return json({ error: portal.error?.message || 'Stripe error' }, 502);

  return json({ url: portal.url });
}
