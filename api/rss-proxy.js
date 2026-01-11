export const config = { runtime: 'edge' };

// Fetch with timeout
async function fetchWithTimeout(url, options, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// Allowed RSS feed domains for security
const ALLOWED_DOMAINS = [
  'feeds.bbci.co.uk',
  'www.theguardian.com',
  'feeds.npr.org',
  'news.google.com',
  'www.aljazeera.com',
  'rss.cnn.com',
  'hnrss.org',
  'feeds.arstechnica.com',
  'www.theverge.com',
  'www.cnbc.com',
  'feeds.marketwatch.com',
  'www.defenseone.com',
  'breakingdefense.com',
  'www.bellingcat.com',
  'techcrunch.com',
  'huggingface.co',
  'www.technologyreview.com',
  'rss.arxiv.org',
  'export.arxiv.org',
  'www.federalreserve.gov',
  'www.sec.gov',
  'www.whitehouse.gov',
  'www.state.gov',
  'www.defense.gov',
  'home.treasury.gov',
  'www.justice.gov',
  'tools.cdc.gov',
  'www.fema.gov',
  'www.dhs.gov',
  'www.thedrive.com',
  'krebsonsecurity.com',
  'finance.yahoo.com',
  'thediplomat.com',
  'venturebeat.com',
  'foreignpolicy.com',
  'www.ft.com',
  'openai.com',
  'www.reutersagency.com',
  'feeds.reuters.com',
  'rsshub.app',
];

export default async function handler(req) {
  const requestUrl = new URL(req.url);
  const feedUrl = requestUrl.searchParams.get('url');

  if (!feedUrl) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  try {
    const parsedUrl = new URL(feedUrl);

    // Security: Check if domain is allowed
    if (!ALLOWED_DOMAINS.includes(parsedUrl.hostname)) {
      return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const response = await fetchWithTimeout(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; WorldMonitor/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
    }, 8000); // 8s timeout

    const data = await response.text();
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/xml',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    return new Response(JSON.stringify({ error: isTimeout ? 'Feed timeout' : 'Failed to fetch feed' }), {
      status: isTimeout ? 504 : 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }
}
