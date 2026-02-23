// Cloudflare Pages Function - TMDB Search Proxy
// Keeps TMDB API key server-side, away from client code
//
// Route: GET /api/tmdb?query=<search>&type=<tv|movie>
// Env: TMDB_API_KEY (JWT Bearer token)

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
    const type = url.searchParams.get('type');

    if (!query || !type || !['tv', 'movie'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid query/type parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tmdbUrl = `https://api.themoviedb.org/3/search/${type}?query=${encodeURIComponent(query)}`;
    const response = await fetch(tmdbUrl, {
      headers: { Authorization: 'Bearer ' + env.TMDB_API_KEY }
    });

    if (!response.ok) {
      console.error('TMDB API error:', response.status);
      return new Response(
        JSON.stringify({ error: 'TMDB API error' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('TMDB proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to search TMDB' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
