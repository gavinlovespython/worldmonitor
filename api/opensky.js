export const config = { runtime: 'edge' };

// Token cache for OAuth2
let tokenCache = { token: null, expiresAt: 0 };

// Fetch with timeout
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAccessToken() {
  const clientId = process.env.OPENSKY_CLIENT_ID;
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  // Return cached token if still valid (with 60s buffer)
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }

  try {
    const response = await fetchWithTimeout('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    }, 5000); // 5s timeout for auth

    if (!response.ok) return null;

    const data = await response.json();
    tokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
    };
    return tokenCache.token;
  } catch {
    return null;
  }
}

export default async function handler(req) {
  const url = new URL(req.url);

  // Build OpenSky API URL with bounding box params
  const params = new URLSearchParams();
  const lamin = url.searchParams.get('lamin');
  const lomin = url.searchParams.get('lomin');
  const lamax = url.searchParams.get('lamax');
  const lomax = url.searchParams.get('lomax');

  if (lamin) params.set('lamin', lamin);
  if (lomin) params.set('lomin', lomin);
  if (lamax) params.set('lamax', lamax);
  if (lomax) params.set('lomax', lomax);

  const openskyUrl = `https://opensky-network.org/api/states/all${params.toString() ? '?' + params.toString() : ''}`;

  try {
    // Get OAuth token if credentials configured
    const token = await getAccessToken();

    const response = await fetchWithTimeout(openskyUrl, {
      headers: {
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    }, 12000); // 12s timeout for data fetch

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: 'Rate limited', time: Date.now(), states: null }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=10',
      },
    });
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    return new Response(JSON.stringify({
      error: isTimeout ? 'Request timeout' : 'Failed to fetch data',
      time: Date.now(),
      states: null
    }), {
      status: isTimeout ? 504 : 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
