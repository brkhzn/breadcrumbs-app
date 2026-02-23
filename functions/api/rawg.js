// Cloudflare Pages Function - RAWG Game Search Proxy
// Keeps RAWG API key server-side, away from client code
//
// Route: GET /api/rawg?query=<search>
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
    const query = url.searchParams.get('query');

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Missing query parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rawgUrl = `https://api.rawg.io/api/games?search=${encodeURIComponent(query)}&page_size=6&key=${env.RAWG_API_KEY}`;
    const response = await fetch(rawgUrl);

    if (!response.ok) {
      console.error('RAWG API error:', response.status);
      return new Response(
        JSON.stringify({ error: 'RAWG API error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('RAWG proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to search games' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
