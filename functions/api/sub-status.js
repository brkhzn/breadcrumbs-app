// Cloudflare Pages Function — Subscription Status Check
//
// GET /api/sub-status?did=did:plc:...
// Env: BC_SUBS (KV namespace)
// Returns: { active: bool, tier: 'monthly'|'annual'|'lifetime'|null }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function onRequestGet(context) {
  const { request, env } = context;

  const did = new URL(request.url).searchParams.get('did');
  if (!did) return json({ active: false, tier: null });

  const kv = env.BC_SUBS;
  if (!kv) return json({ active: false, tier: null });

  const raw = await kv.get(`sub:${did}`);
  if (!raw) return json({ active: false, tier: null });

  let sub;
  try {
    sub = JSON.parse(raw);
  } catch {
    return json({ active: false, tier: null });
  }

  // Lifetime never expires
  if (sub.tier === 'lifetime') return json({ active: true, tier: 'lifetime' });

  // Check if a cancelled/expired subscription has passed its end date
  if (sub.expiresAt && new Date(sub.expiresAt) < new Date()) {
    await kv.delete(`sub:${did}`);
    return json({ active: false, tier: null });
  }

  const active = sub.status === 'active';
  return json({ active, tier: active ? sub.tier : null });
}
