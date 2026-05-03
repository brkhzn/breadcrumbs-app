// Cloudflare Pages Function - Bug Report Submission
//
// POST /api/report-bug
// Body: { title, body, ua, viewport, version, palette, mode }
// Env:  GITHUB_TOKEN (fine-scoped PAT with Issues: Write on the repo),
//       GITHUB_REPO  (e.g. "brkhzn/breadcrumbs-app"),
//       BC_RATELIMIT (KV namespace, optional)
//
// Files a tagged issue on the configured GitHub repo.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function clip(s, n) {
  if (!s) return '';
  s = String(s);
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return json({ error: 'Bug reporting is not configured on this deploy.' }, 503);
  }

  // Per-IP rate limit if KV is bound: 1 report / 60s, 10 / 24h.
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (env.BC_RATELIMIT) {
    const minuteKey = `rb:m:${ip}`;
    const dayKey = `rb:d:${ip}`;
    const recent = await env.BC_RATELIMIT.get(minuteKey);
    if (recent) {
      return json({ error: 'Slow down. Try again in a minute.' }, 429);
    }
    const dayCount = parseInt(await env.BC_RATELIMIT.get(dayKey) || '0', 10);
    if (dayCount >= 10) {
      return json({ error: 'Too many reports today. Try again tomorrow.' }, 429);
    }
    // Set after we've decided to proceed (writes happen post-success below).
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const titleRaw = clip(body.title, 120).trim();
  const bodyRaw = clip(body.body, 4000).trim();
  if (!titleRaw || !bodyRaw) {
    return json({ error: 'Title and description are required.' }, 400);
  }

  const ua       = clip(body.ua, 300);
  const viewport = clip(body.viewport, 30);
  const version  = clip(body.version, 30);
  const palette  = clip(body.palette, 30);
  const mode     = clip(body.mode, 10);
  const submittedAt = new Date().toISOString();

  const issueBody = [
    bodyRaw,
    '',
    '---',
    '',
    '*Submitted via in-app bug report.*',
    '',
    '| Field       | Value |',
    '|-------------|-------|',
    `| App version | \`${version || 'unknown'}\` |`,
    `| Palette     | \`${palette || 'unknown'}\` |`,
    `| Mode        | \`${mode || 'unknown'}\` |`,
    `| Viewport    | \`${viewport || 'unknown'}\` |`,
    `| User agent  | \`${ua || 'unknown'}\` |`,
    `| Submitted   | \`${submittedAt}\` |`,
  ].join('\n');

  const ghRes = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'breadcrumbs-app-report-bug',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: titleRaw,
      body: issueBody,
      labels: ['user-report'],
    }),
  });

  let ghData;
  try { ghData = await ghRes.json(); } catch { ghData = {}; }

  if (!ghRes.ok) {
    console.error('GitHub issue create failed:', ghRes.status, ghData);
    return json({ error: 'Could not file the report. Please try again later.' }, 502);
  }

  // Record the rate-limit hit only after success.
  if (env.BC_RATELIMIT) {
    const minuteKey = `rb:m:${ip}`;
    const dayKey = `rb:d:${ip}`;
    const dayCount = parseInt(await env.BC_RATELIMIT.get(dayKey) || '0', 10);
    await Promise.all([
      env.BC_RATELIMIT.put(minuteKey, '1', { expirationTtl: 60 }),
      env.BC_RATELIMIT.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 }),
    ]);
  }

  return json({
    ok: true,
    number: ghData.number,
    url: ghData.html_url,
  });
}
