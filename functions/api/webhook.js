// Cloudflare Pages Function — Stripe Webhook Handler
//
// POST /api/webhook
// Env:  STRIPE_WEBHOOK_SECRET, BC_SUBS (KV namespace)
//
// Handles:
//   checkout.session.completed        → activate subscription or lifetime
//   customer.subscription.updated     → sync status changes (paused, etc.)
//   customer.subscription.deleted     → deactivate
//   invoice.payment_failed            → deactivate after Stripe retries give up

async function verifyStripeSignature(body, sigHeader, secret) {
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    acc[k] = v;
    return acc;
  }, {});

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  // Reject payloads older than 5 minutes
  if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computed === signature;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const rawBody = await request.text();
  const sigHeader = request.headers.get('stripe-signature');

  if (!sigHeader || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const valid = await verifyStripeSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const kv = env.BC_SUBS;
  if (!kv) {
    console.error('BC_SUBS KV namespace not bound');
    return new Response('KV not configured', { status: 500 });
  }

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object;
        const did = session.client_reference_id;
        if (!did) break;

        // Determine tier from mode
        if (session.mode === 'payment') {
          // Lifetime one-time purchase
          await kv.put(`sub:${did}`, JSON.stringify({
            tier: 'lifetime',
            status: 'active',
            stripeCustomerId: session.customer,
            expiresAt: null,
            activatedAt: new Date().toISOString(),
          }));
        } else {
          // Subscription — get tier from the price ID via line items
          const priceId = session.amount_subtotal !== undefined
            ? await getPriceFromSession(session.id, env.STRIPE_SECRET_KEY)
            : null;
          const tier = tierFromPriceId(priceId, env);
          await kv.put(`sub:${did}`, JSON.stringify({
            tier: tier || 'monthly',
            status: 'active',
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
            expiresAt: null,
            activatedAt: new Date().toISOString(),
          }));
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const did = await didFromCustomer(sub.customer, kv);
        if (!did) break;

        const existing = JSON.parse(await kv.get(`sub:${did}`) || '{}');
        const active = ['active', 'trialing'].includes(sub.status);
        await kv.put(`sub:${did}`, JSON.stringify({
          ...existing,
          status: active ? 'active' : sub.status,
          stripeSubscriptionId: sub.id,
          expiresAt: active ? null : new Date(sub.current_period_end * 1000).toISOString(),
        }));
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const did = await didFromCustomer(sub.customer, kv);
        if (!did) break;
        await kv.delete(`sub:${did}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.next_payment_attempt !== null) break; // still retrying
        const did = await didFromCustomer(invoice.customer, kv);
        if (!did) break;
        await kv.delete(`sub:${did}`);
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}

// ── Helpers ───────────────────────────────────────────────────

async function getPriceFromSession(sessionId, secretKey) {
  try {
    const resp = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${sessionId}/line_items`,
      { headers: { 'Authorization': `Bearer ${secretKey}` } }
    );
    const data = await resp.json();
    return data.data?.[0]?.price?.id || null;
  } catch {
    return null;
  }
}

function tierFromPriceId(priceId, env) {
  if (!priceId) return 'monthly';
  if (priceId === env.STRIPE_PRICE_ANNUAL)   return 'annual';
  if (priceId === env.STRIPE_PRICE_LIFETIME) return 'lifetime';
  return 'monthly';
}

// Scan KV for an entry whose stripeCustomerId matches.
// In production you'd maintain a reverse index; for low volume this is fine.
async function didFromCustomer(customerId, kv) {
  if (!customerId) return null;
  // Stripe subscription updated/deleted events don't carry client_reference_id,
  // so we look up by customer ID stored when the checkout completed.
  const list = await kv.list({ prefix: 'sub:' });
  for (const key of list.keys) {
    const raw = await kv.get(key.name);
    if (!raw) continue;
    const val = JSON.parse(raw);
    if (val.stripeCustomerId === customerId) return key.name.replace('sub:', '');
  }
  return null;
}
