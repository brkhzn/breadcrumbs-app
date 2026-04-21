// Cloudflare Pages Function - RAWG Game Detail Proxy
// Returns description_raw for a single game by ID
//
// Route: GET /api/rawg-detail?id=<game-id>
// Env: RAWG_API_KEY

export async function onRequestGet(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id || !/^\d+$/.test(id)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawgUrl = `https://api.rawg.io/api/games/${id}?key=${env.RAWG_API_KEY}`;
    const response = await fetch(rawgUrl);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: 'RAWG API error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify({ description_raw: data.description_raw || '' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch game details' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
