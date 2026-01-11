import type { MilitaryFlight, MilitaryFlightCluster, MilitaryAircraftType, MilitaryOperator } from '@/types';
import { createCircuitBreaker } from '@/utils';
import {
  identifyByCallsign,
  identifyByAircraftType,
  isKnownMilitaryHex,
  getNearbyHotspot,
  MILITARY_HOTSPOTS,
} from '@/config/military';

// OpenSky Network API - free tier allows anonymous requests with rate limits
const OPENSKY_BASE_URL = '/api/opensky';
const ADSB_EXCHANGE_URL = '/api/adsb-exchange';

// Cache configuration
const CACHE_TTL = 2 * 60 * 1000; // 2 minutes
let flightCache: { data: MilitaryFlight[]; timestamp: number } | null = null;

// Track flight history for trails
const flightHistory = new Map<string, { positions: [number, number][]; lastUpdate: number }>();
const HISTORY_MAX_POINTS = 20;
const HISTORY_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Circuit breaker for API calls
const breaker = createCircuitBreaker<{ flights: MilitaryFlight[]; clusters: MilitaryFlightCluster[] }>({
  name: 'Military Flight Tracking',
  maxFailures: 3,
  cooldownMs: 5 * 60 * 1000, // 5 minute cooldown
  cacheTtlMs: 2 * 60 * 1000, // 2 minute cache
});

// OpenSky API returns arrays in this order:
// [0] icao24, [1] callsign, [2] origin_country, [3] time_position, [4] last_contact,
// [5] longitude, [6] latitude, [7] baro_altitude, [8] on_ground, [9] velocity,
// [10] true_track, [11] vertical_rate, [12] sensors, [13] geo_altitude, [14] squawk,
// [15] spi, [16] position_source
type OpenSkyStateArray = [
  string,       // 0: icao24
  string | null,// 1: callsign
  string,       // 2: origin_country
  number | null,// 3: time_position
  number,       // 4: last_contact
  number | null,// 5: longitude
  number | null,// 6: latitude
  number | null,// 7: baro_altitude (meters)
  boolean,      // 8: on_ground
  number | null,// 9: velocity (m/s)
  number | null,// 10: true_track (degrees)
  number | null,// 11: vertical_rate (m/s)
  number[] | null, // 12: sensors
  number | null,// 13: geo_altitude
  string | null,// 14: squawk
  boolean,      // 15: spi
  number        // 16: position_source
];

interface OpenSkyResponse {
  time: number;
  states: OpenSkyStateArray[] | null;
}

/**
 * Determine aircraft type based on callsign, type code, or hex
 */
function determineAircraftInfo(
  callsign: string,
  icao24: string,
  _typeCode?: string
): { type: MilitaryAircraftType; operator: MilitaryOperator; country: string; confidence: 'high' | 'medium' | 'low' } {
  // Check callsign first (highest confidence)
  const callsignMatch = identifyByCallsign(callsign);
  if (callsignMatch) {
    return {
      type: callsignMatch.aircraftType || 'unknown',
      operator: callsignMatch.operator,
      country: getCountryFromOperator(callsignMatch.operator),
      confidence: 'high',
    };
  }

  // Check hex code range
  const hexMatch = isKnownMilitaryHex(icao24);
  if (hexMatch) {
    return {
      type: 'unknown',
      operator: hexMatch.operator,
      country: hexMatch.country,
      confidence: 'medium',
    };
  }

  // Default for unknown military
  return {
    type: 'unknown',
    operator: 'other',
    country: 'Unknown',
    confidence: 'low',
  };
}

function getCountryFromOperator(operator: MilitaryOperator): string {
  const countryMap: Record<MilitaryOperator, string> = {
    usaf: 'USA',
    usn: 'USA',
    usmc: 'USA',
    usa: 'USA',
    raf: 'UK',
    rn: 'UK',
    faf: 'France',
    gaf: 'Germany',
    plaaf: 'China',
    plan: 'China',
    vks: 'Russia',
    iaf: 'Israel',
    nato: 'NATO',
    other: 'Unknown',
  };
  return countryMap[operator];
}

/**
 * Check if a flight looks like a military aircraft
 */
function isMilitaryFlight(state: OpenSkyStateArray): boolean {
  const callsign = (state[1] || '').trim();
  const icao24 = state[0];
  const originCountry = state[2];
  const squawk = state[14];

  // Check for known military callsigns
  if (callsign && identifyByCallsign(callsign)) {
    return true;
  }

  // Check for military hex code ranges
  if (isKnownMilitaryHex(icao24)) {
    return true;
  }

  // Check for military squawk codes
  const militarySquawks = ['7777', '7600', '7700', '7500', '0000', '1200', '1277'];
  if (squawk && militarySquawks.includes(squawk)) {
    // These could be military but need further validation
    // Not returning true here to avoid false positives
  }

  // Some countries have recognizable military patterns
  const militaryCountries = ['United States', 'United Kingdom', 'France', 'Germany', 'Israel'];
  if (militaryCountries.includes(originCountry)) {
    // Check for common military callsign patterns
    if (callsign && /^(RCH|REACH|DUKE|KING|GOLD|NAVY|ARMY|MARINE|NATO|RAF|GAF|FAF)/.test(callsign)) {
      return true;
    }
  }

  return false;
}

/**
 * Parse OpenSky response into MilitaryFlight objects
 */
function parseOpenSkyResponse(data: OpenSkyResponse): MilitaryFlight[] {
  if (!data.states) return [];

  const flights: MilitaryFlight[] = [];
  const now = new Date();

  for (const state of data.states) {
    if (!isMilitaryFlight(state)) continue;

    const icao24 = state[0];
    const callsign = (state[1] || '').trim();
    const lat = state[6];
    const lon = state[5];

    if (lat === null || lon === null) continue;

    const info = determineAircraftInfo(callsign, icao24);

    // Update flight history for trails
    const historyKey = icao24;
    let history = flightHistory.get(historyKey);
    if (!history) {
      history = { positions: [], lastUpdate: Date.now() };
      flightHistory.set(historyKey, history);
    }

    // Add position to history
    history.positions.push([lat, lon]);
    if (history.positions.length > HISTORY_MAX_POINTS) {
      history.positions.shift();
    }
    history.lastUpdate = Date.now();

    // Check if near interesting hotspot
    const nearbyHotspot = getNearbyHotspot(lat, lon);
    const isInteresting = nearbyHotspot?.priority === 'high' ||
      info.type === 'bomber' ||
      info.type === 'reconnaissance' ||
      info.type === 'awacs';

    const baroAlt = state[7];
    const velocity = state[9];
    const track = state[10];
    const vertRate = state[11];

    const flight: MilitaryFlight = {
      id: `opensky-${icao24}`,
      callsign: callsign || `UNKN-${icao24.substring(0, 4).toUpperCase()}`,
      hexCode: icao24.toUpperCase(),
      aircraftType: info.type,
      operator: info.operator,
      operatorCountry: info.country,
      lat,
      lon,
      altitude: baroAlt ? Math.round(baroAlt * 3.28084) : 0, // Convert m to ft
      heading: track || 0,
      speed: velocity ? Math.round(velocity * 1.94384) : 0, // Convert m/s to knots
      verticalRate: vertRate ? Math.round(vertRate * 196.85) : undefined, // Convert m/s to ft/min
      onGround: state[8],
      squawk: state[14] || undefined,
      lastSeen: now,
      track: history.positions.length > 1 ? [...history.positions] : undefined,
      confidence: info.confidence,
      isInteresting,
      note: nearbyHotspot ? `Near ${nearbyHotspot.name}` : undefined,
    };

    flights.push(flight);
  }

  return flights;
}

/**
 * Fetch military flights from OpenSky Network
 */
async function fetchFromOpenSky(): Promise<MilitaryFlight[]> {
  try {
    // OpenSky API - fetch all states (global)
    // Rate limit: Anonymous users can make up to 400 requests per day
    const response = await fetch(`${OPENSKY_BASE_URL}/states/all`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Military Flights] OpenSky API error: ${response.status}`);
      return [];
    }

    const data: OpenSkyResponse = await response.json();
    const flights = parseOpenSkyResponse(data);

    console.log(`[Military Flights] Found ${flights.length} military aircraft from OpenSky`);
    return flights;
  } catch (error) {
    console.error('[Military Flights] OpenSky fetch error:', error);
    return [];
  }
}

/**
 * Fetch from ADS-B Exchange as backup/supplement
 * Note: Requires API key for full access
 */
async function fetchFromADSBExchange(): Promise<MilitaryFlight[]> {
  try {
    // Try military-specific endpoint if available
    const response = await fetch(`${ADSB_EXCHANGE_URL}/v2/mil`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Fallback to main feed is handled by returning empty
      return [];
    }

    const data = await response.json();

    // Parse ADS-B Exchange format (different from OpenSky)
    if (!data.ac) return [];

    const flights: MilitaryFlight[] = [];
    const now = new Date();

    for (const ac of data.ac) {
      if (!ac.lat || !ac.lon) continue;

      const callsign = (ac.flight || ac.r || '').trim();
      const info = determineAircraftInfo(callsign, ac.hex || '', ac.t);

      // Get aircraft type info if available
      const typeInfo = ac.t ? identifyByAircraftType(ac.t) : undefined;

      const flight: MilitaryFlight = {
        id: `adsb-${ac.hex}`,
        callsign: callsign || `UNKN-${(ac.hex || '').substring(0, 4).toUpperCase()}`,
        hexCode: (ac.hex || '').toUpperCase(),
        registration: ac.r,
        aircraftType: typeInfo?.type || info.type,
        aircraftModel: typeInfo?.name || ac.t,
        operator: info.operator,
        operatorCountry: info.country,
        lat: ac.lat,
        lon: ac.lon,
        altitude: ac.alt_baro || ac.alt_geom || 0,
        heading: ac.track || 0,
        speed: ac.gs || 0,
        verticalRate: ac.baro_rate,
        onGround: ac.alt_baro === 'ground',
        squawk: ac.squawk,
        lastSeen: now,
        confidence: info.confidence,
      };

      flights.push(flight);
    }

    console.log(`[Military Flights] Found ${flights.length} military aircraft from ADS-B Exchange`);
    return flights;
  } catch {
    // ADS-B Exchange is a supplementary source, don't log errors heavily
    return [];
  }
}

/**
 * Cluster nearby flights for map display
 */
function clusterFlights(flights: MilitaryFlight[]): MilitaryFlightCluster[] {
  const clusters: MilitaryFlightCluster[] = [];
  const processed = new Set<string>();

  // Check each hotspot for clusters
  for (const hotspot of MILITARY_HOTSPOTS) {
    const nearbyFlights = flights.filter((f) => {
      if (processed.has(f.id)) return false;
      const distance = Math.sqrt(Math.pow(f.lat - hotspot.lat, 2) + Math.pow(f.lon - hotspot.lon, 2));
      return distance <= hotspot.radius;
    });

    if (nearbyFlights.length >= 2) {
      // Mark as processed
      nearbyFlights.forEach((f) => processed.add(f.id));

      // Calculate cluster center
      const avgLat = nearbyFlights.reduce((sum, f) => sum + f.lat, 0) / nearbyFlights.length;
      const avgLon = nearbyFlights.reduce((sum, f) => sum + f.lon, 0) / nearbyFlights.length;

      // Determine dominant operator
      const operatorCounts = new Map<MilitaryOperator, number>();
      for (const f of nearbyFlights) {
        operatorCounts.set(f.operator, (operatorCounts.get(f.operator) || 0) + 1);
      }
      let dominantOperator: MilitaryOperator | undefined;
      let maxCount = 0;
      for (const [op, count] of operatorCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominantOperator = op;
        }
      }

      // Determine activity type
      const hasTransport = nearbyFlights.some((f) => f.aircraftType === 'transport' || f.aircraftType === 'tanker');
      const hasFighters = nearbyFlights.some((f) => f.aircraftType === 'fighter');
      const hasRecon = nearbyFlights.some((f) => f.aircraftType === 'reconnaissance' || f.aircraftType === 'awacs');

      let activityType: 'exercise' | 'patrol' | 'transport' | 'unknown' = 'unknown';
      if (hasFighters && hasRecon) activityType = 'exercise';
      else if (hasFighters || hasRecon) activityType = 'patrol';
      else if (hasTransport) activityType = 'transport';

      clusters.push({
        id: `cluster-${hotspot.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: `${hotspot.name} Activity`,
        lat: avgLat,
        lon: avgLon,
        flightCount: nearbyFlights.length,
        flights: nearbyFlights,
        dominantOperator,
        activityType,
      });
    }
  }

  return clusters;
}

/**
 * Clean up old flight history entries
 */
function cleanupFlightHistory(): void {
  const cutoff = Date.now() - HISTORY_CLEANUP_INTERVAL;
  for (const [key, history] of flightHistory) {
    if (history.lastUpdate < cutoff) {
      flightHistory.delete(key);
    }
  }
}

// Set up periodic cleanup
if (typeof window !== 'undefined') {
  setInterval(cleanupFlightHistory, HISTORY_CLEANUP_INTERVAL);
}

/**
 * Main function to fetch military flights
 */
export async function fetchMilitaryFlights(): Promise<{
  flights: MilitaryFlight[];
  clusters: MilitaryFlightCluster[];
}> {
  return breaker.execute(async () => {
    // Check cache
    if (flightCache && Date.now() - flightCache.timestamp < CACHE_TTL) {
      const clusters = clusterFlights(flightCache.data);
      return { flights: flightCache.data, clusters };
    }

    // Fetch from multiple sources
    const [openskyFlights, adsbFlights] = await Promise.all([
      fetchFromOpenSky(),
      fetchFromADSBExchange(),
    ]);

    // Merge and deduplicate
    const flightMap = new Map<string, MilitaryFlight>();

    // OpenSky first (primary source)
    for (const flight of openskyFlights) {
      flightMap.set(flight.hexCode, flight);
    }

    // Add ADSB Exchange flights that aren't duplicates
    for (const flight of adsbFlights) {
      if (!flightMap.has(flight.hexCode)) {
        flightMap.set(flight.hexCode, flight);
      }
    }

    const flights = Array.from(flightMap.values());

    // Update cache
    flightCache = { data: flights, timestamp: Date.now() };

    // Generate clusters
    const clusters = clusterFlights(flights);

    console.log(`[Military Flights] Total: ${flights.length} flights, ${clusters.length} clusters`);
    return { flights, clusters };
  }, { flights: [], clusters: [] });
}

/**
 * Get status of military flights tracking
 */
export function getMilitaryFlightsStatus(): string {
  return breaker.getStatus();
}

/**
 * Get flight by hex code
 */
export function getFlightByHex(hexCode: string): MilitaryFlight | undefined {
  if (!flightCache) return undefined;
  return flightCache.data.find((f) => f.hexCode === hexCode.toUpperCase());
}

/**
 * Get flights by operator
 */
export function getFlightsByOperator(operator: MilitaryOperator): MilitaryFlight[] {
  if (!flightCache) return [];
  return flightCache.data.filter((f) => f.operator === operator);
}

/**
 * Get interesting flights (near hotspots, special types)
 */
export function getInterestingFlights(): MilitaryFlight[] {
  if (!flightCache) return [];
  return flightCache.data.filter((f) => f.isInteresting);
}
