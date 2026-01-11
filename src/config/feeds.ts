import type { Feed } from '@/types';

// Helper to create RSS proxy URL
const rss = (url: string) => `/api/rss-proxy?url=${encodeURIComponent(url)}`;

// Source tier system for prioritization (lower = more authoritative)
// Tier 1: Wire services - fastest, most reliable breaking news
// Tier 2: Major outlets - high-quality journalism
// Tier 3: Specialty sources - domain expertise
// Tier 4: Aggregators & blogs - useful but less authoritative
export const SOURCE_TIERS: Record<string, number> = {
  // Tier 1 - Wire Services
  'Reuters': 1,
  'AP News': 1,
  'AFP': 1,
  'Bloomberg': 1,

  // Tier 2 - Major Outlets
  'BBC World': 2,
  'BBC Middle East': 2,
  'Guardian World': 2,
  'Guardian ME': 2,
  'NPR News': 2,
  'CNN Middle East': 2,
  'CNBC': 2,
  'MarketWatch': 2,
  'Al Jazeera': 2,
  'Financial Times': 2,
  'Reuters World': 1,
  'Reuters Business': 1,
  'OpenAI News': 3,

  // Tier 1.5 - Official Government Sources
  'White House': 1,
  'State Dept': 1,
  'Pentagon': 1,
  'Treasury': 2,
  'DOJ': 2,
  'DHS': 2,
  'CDC': 2,
  'FEMA': 2,

  // Tier 3 - Specialty
  'Defense One': 3,
  'Breaking Defense': 3,
  'The War Zone': 3,
  'Foreign Policy': 3,
  'The Diplomat': 3,
  'Bellingcat': 3,
  'Krebs Security': 3,
  'Federal Reserve': 3,
  'SEC': 3,
  'MIT Tech Review': 3,
  'Ars Technica': 3,

  // Tier 4 - Aggregators
  'Hacker News': 4,
  'The Verge': 4,
  'VentureBeat AI': 4,
  'Yahoo Finance': 4,
  'TechCrunch Layoffs': 4,
  'Hugging Face': 4,
  'ArXiv AI': 4,
};

export function getSourceTier(sourceName: string): number {
  return SOURCE_TIERS[sourceName] ?? 4; // Default to tier 4 if unknown
}

export type SourceType = 'wire' | 'gov' | 'intel' | 'mainstream' | 'market' | 'tech' | 'other';

export const SOURCE_TYPES: Record<string, SourceType> = {
  // Wire services - fastest, most authoritative
  'Reuters': 'wire', 'Reuters World': 'wire', 'Reuters Business': 'wire',
  'AP News': 'wire', 'AFP': 'wire', 'Bloomberg': 'wire',

  // Government sources
  'White House': 'gov', 'State Dept': 'gov', 'Pentagon': 'gov',
  'Treasury': 'gov', 'DOJ': 'gov', 'DHS': 'gov', 'CDC': 'gov',
  'FEMA': 'gov', 'Federal Reserve': 'gov', 'SEC': 'gov',

  // Intel/Defense specialty
  'Defense One': 'intel', 'Breaking Defense': 'intel', 'The War Zone': 'intel',
  'Defense News': 'intel', 'Bellingcat': 'intel', 'Krebs Security': 'intel',
  'Foreign Policy': 'intel', 'The Diplomat': 'intel',

  // Mainstream outlets
  'BBC World': 'mainstream', 'BBC Middle East': 'mainstream',
  'Guardian World': 'mainstream', 'Guardian ME': 'mainstream',
  'NPR News': 'mainstream', 'Al Jazeera': 'mainstream',
  'CNN Middle East': 'mainstream',

  // Market/Finance
  'CNBC': 'market', 'MarketWatch': 'market', 'Yahoo Finance': 'market',
  'Financial Times': 'market',

  // Tech
  'Hacker News': 'tech', 'Ars Technica': 'tech', 'The Verge': 'tech',
  'MIT Tech Review': 'tech', 'TechCrunch Layoffs': 'tech',
  'AI News': 'tech', 'Hugging Face': 'tech', 'ArXiv AI': 'tech',
  'VentureBeat AI': 'tech', 'OpenAI News': 'tech',
};

export function getSourceType(sourceName: string): SourceType {
  return SOURCE_TYPES[sourceName] ?? 'other';
}

export const FEEDS: Record<string, Feed[]> = {
  politics: [
    { name: 'BBC World', url: rss('https://feeds.bbci.co.uk/news/world/rss.xml') },
    { name: 'NPR News', url: rss('https://feeds.npr.org/1001/rss.xml') },
    { name: 'Guardian World', url: rss('https://www.theguardian.com/world/rss') },
    { name: 'AP News', url: rss('https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en') },
    { name: 'The Diplomat', url: rss('https://thediplomat.com/feed/') },
    { name: 'Reuters World', url: rss('https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en') },
  ],
  middleeast: [
    { name: 'BBC Middle East', url: rss('https://feeds.bbci.co.uk/news/world/middle_east/rss.xml') },
    { name: 'Al Jazeera', url: rss('https://www.aljazeera.com/xml/rss/all.xml') },
    { name: 'Guardian ME', url: rss('https://www.theguardian.com/world/middleeast/rss') },
    { name: 'CNN Middle East', url: rss('https://rss.cnn.com/rss/edition_meast.rss') },
  ],
  tech: [
    { name: 'Hacker News', url: rss('https://hnrss.org/frontpage') },
    { name: 'Ars Technica', url: rss('https://feeds.arstechnica.com/arstechnica/technology-lab') },
    { name: 'The Verge', url: rss('https://www.theverge.com/rss/index.xml') },
    { name: 'MIT Tech Review', url: rss('https://www.technologyreview.com/feed/') },
  ],
  ai: [
    { name: 'AI News', url: rss('https://news.google.com/rss/search?q=artificial+intelligence+AI+news&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Hugging Face', url: rss('https://huggingface.co/blog/feed.xml') },
    { name: 'ArXiv AI', url: rss('https://export.arxiv.org/rss/cs.AI') },
    { name: 'VentureBeat AI', url: rss('https://venturebeat.com/feed/') },
    // OpenAI blocks proxied requests, use Google News instead
    { name: 'OpenAI News', url: rss('https://news.google.com/rss/search?q=site:openai.com&hl=en-US&gl=US&ceid=US:en') },
  ],
  finance: [
    { name: 'CNBC', url: rss('https://www.cnbc.com/id/100003114/device/rss/rss.html') },
    { name: 'MarketWatch', url: rss('https://feeds.marketwatch.com/marketwatch/topstories') },
    { name: 'Yahoo Finance', url: rss('https://finance.yahoo.com/news/rssindex') },
    { name: 'Financial Times', url: rss('https://www.ft.com/rss/home') },
    { name: 'Reuters Business', url: rss('https://news.google.com/rss/search?q=site:reuters.com+business+markets&hl=en-US&gl=US&ceid=US:en') },
  ],
  gov: [
    { name: 'White House', url: rss('https://news.google.com/rss/search?q=site:whitehouse.gov&hl=en-US&gl=US&ceid=US:en') },
    { name: 'State Dept', url: rss('https://news.google.com/rss/search?q=site:state.gov+OR+"State+Department"&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Pentagon', url: rss('https://news.google.com/rss/search?q=site:defense.gov+OR+Pentagon&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Treasury', url: rss('https://news.google.com/rss/search?q=site:treasury.gov+OR+"Treasury+Department"&hl=en-US&gl=US&ceid=US:en') },
    { name: 'DOJ', url: rss('https://news.google.com/rss/search?q=site:justice.gov+OR+"Justice+Department"+DOJ&hl=en-US&gl=US&ceid=US:en') },
    { name: 'Federal Reserve', url: rss('https://www.federalreserve.gov/feeds/press_all.xml') },
    { name: 'SEC', url: rss('https://www.sec.gov/news/pressreleases.rss') },
    { name: 'CDC', url: rss('https://news.google.com/rss/search?q=site:cdc.gov+OR+CDC+health&hl=en-US&gl=US&ceid=US:en') },
    { name: 'FEMA', url: rss('https://news.google.com/rss/search?q=site:fema.gov+OR+FEMA+emergency&hl=en-US&gl=US&ceid=US:en') },
    { name: 'DHS', url: rss('https://news.google.com/rss/search?q=site:dhs.gov+OR+"Homeland+Security"&hl=en-US&gl=US&ceid=US:en') },
  ],
  layoffs: [
    { name: 'TechCrunch Layoffs', url: rss('https://techcrunch.com/tag/layoffs/feed/') },
    { name: 'Layoffs News', url: rss('https://news.google.com/rss/search?q=tech+layoffs+2026+job+cuts&hl=en-US&gl=US&ceid=US:en') },
  ],
  congress: [
    { name: 'Congress Trades', url: rss('https://news.google.com/rss/search?q=congress+stock+trading+pelosi+tuberville&hl=en-US&gl=US&ceid=US:en') },
  ],
  thinktanks: [
    { name: 'Foreign Policy', url: rss('https://foreignpolicy.com/feed/') },
    { name: 'Think Tank News', url: rss('https://news.google.com/rss/search?q=brookings+CSIS+CFR+analysis&hl=en-US&gl=US&ceid=US:en') },
  ],
};

export const INTEL_SOURCES: Feed[] = [
  { name: 'Defense One', url: rss('https://www.defenseone.com/rss/all/'), type: 'defense' },
  { name: 'Breaking Defense', url: rss('https://breakingdefense.com/feed/'), type: 'defense' },
  { name: 'The War Zone', url: rss('https://news.google.com/rss/search?q=site:thedrive.com/the-war-zone&hl=en-US&gl=US&ceid=US:en'), type: 'defense' },
  { name: 'Defense News', url: rss('https://news.google.com/rss/search?q=defense+military+pentagon&hl=en-US&gl=US&ceid=US:en'), type: 'defense' },
  { name: 'Bellingcat', url: rss('https://www.bellingcat.com/feed/'), type: 'osint' },
  { name: 'Krebs Security', url: rss('https://krebsonsecurity.com/feed/'), type: 'cyber' },
];

export const ALERT_KEYWORDS = [
  'war', 'invasion', 'military', 'nuclear', 'sanctions', 'missile',
  'attack', 'troops', 'conflict', 'strike', 'bomb', 'casualties',
  'ceasefire', 'treaty', 'nato', 'coup', 'martial law', 'emergency',
  'assassination', 'terrorist', 'hostage', 'evacuation', 'breaking',
];
