import type { MilitaryVessel, MilitaryVesselCluster, MilitaryVesselType, MilitaryOperator } from '@/types';
import { createCircuitBreaker } from '@/utils';
import {
  KNOWN_NAVAL_VESSELS,
  MILITARY_VESSEL_PATTERNS,
  getNearbyHotspot,
  MILITARY_HOTSPOTS,
} from '@/config/military';

// WebSocket relay for live vessel tracking (same as AIS service)
const AISSTREAM_URL = import.meta.env.VITE_WS_RELAY_URL || 'ws://localhost:3004';

// Check if AIS is configured
const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const aisConfigured = Boolean(import.meta.env.VITE_WS_RELAY_URL) || isLocalhost;

// Cache for API responses
let vesselCache: { data: MilitaryVessel[]; timestamp: number } | null = null;

// In-memory vessel tracking
const trackedVessels = new Map<string, MilitaryVessel>();
const vesselHistory = new Map<string, { positions: [number, number][]; lastUpdate: number }>();
const HISTORY_MAX_POINTS = 30;
const HISTORY_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
const VESSEL_STALE_TIME = 60 * 60 * 1000; // 1 hour - consider vessel stale

// WebSocket connection
let socket: WebSocket | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isConnected = false;
let messageCount = 0;

// Circuit breaker
const breaker = createCircuitBreaker<{ vessels: MilitaryVessel[]; clusters: MilitaryVesselCluster[] }>({
  name: 'Military Vessel Tracking',
  maxFailures: 3,
  cooldownMs: 5 * 60 * 1000,
  cacheTtlMs: 5 * 60 * 1000,
});

// Strategic chokepoints for naval monitoring
const NAVAL_CHOKEPOINTS = [
  { name: 'Strait of Hormuz', lat: 26.5, lon: 56.5, radius: 2 },
  { name: 'Suez Canal', lat: 30.0, lon: 32.5, radius: 1 },
  { name: 'Strait of Malacca', lat: 2.5, lon: 101.5, radius: 2 },
  { name: 'Bab el-Mandeb', lat: 12.5, lon: 43.5, radius: 1.5 },
  { name: 'Panama Canal', lat: 9.0, lon: -79.5, radius: 1 },
  { name: 'Taiwan Strait', lat: 24.5, lon: 119.5, radius: 2 },
  { name: 'South China Sea', lat: 15.0, lon: 115.0, radius: 5 },
  { name: 'Black Sea', lat: 43.5, lon: 34.0, radius: 3 },
  { name: 'Baltic Sea', lat: 58.0, lon: 20.0, radius: 4 },
  { name: 'Sea of Japan', lat: 40.0, lon: 135.0, radius: 4 },
  { name: 'Persian Gulf', lat: 26.5, lon: 52.0, radius: 4 },
  { name: 'Eastern Mediterranean', lat: 34.5, lon: 33.0, radius: 3 },
];

// Naval base locations for proximity detection
const NAVAL_BASES = [
  { name: 'Norfolk Naval Station', lat: 36.95, lon: -76.30, country: 'USA' },
  { name: 'San Diego Naval Base', lat: 32.68, lon: -117.15, country: 'USA' },
  { name: 'Pearl Harbor', lat: 21.35, lon: -157.95, country: 'USA' },
  { name: 'Yokosuka Naval Base', lat: 35.29, lon: 139.67, country: 'Japan' },
  { name: 'Qingdao Naval Base', lat: 36.07, lon: 120.38, country: 'China' },
  { name: 'Sevastopol', lat: 44.62, lon: 33.53, country: 'Russia' },
  { name: 'Portsmouth Naval Base', lat: 50.80, lon: -1.10, country: 'UK' },
  { name: 'Toulon Naval Base', lat: 43.12, lon: 5.93, country: 'France' },
  { name: 'Tartus Naval Base', lat: 34.89, lon: 35.87, country: 'Syria' },
  { name: 'Zhanjiang Naval Base', lat: 21.20, lon: 110.40, country: 'China' },
  { name: 'Vladivostok', lat: 43.12, lon: 131.90, country: 'Russia' },
  { name: 'Diego Garcia', lat: -7.32, lon: 72.42, country: 'UK/USA' },
];

/**
 * MMSI number analysis for military/government vessels
 * MMSI format: MIDXXXXXX where MID = Maritime Identification Digits
 * Ship type is indicated by AIS message, but MMSI can hint at special vessels
 */
function analyzeMmsi(mmsi: string): { isPotentialMilitary: boolean; country?: string } {
  if (!mmsi || mmsi.length < 9) return { isPotentialMilitary: false };

  const mid = mmsi.substring(0, 3);

  // MIDs for countries with significant navies
  const militaryMids: Record<string, string> = {
    '201': 'Albania', '202': 'Andorra', '203': 'Austria',
    '211': 'Germany', '212': 'Cyprus', '213': 'Georgia',
    '214': 'Moldova', '215': 'Malta', '216': 'Armenia',
    '218': 'Germany', '219': 'Denmark', '220': 'Denmark',
    '224': 'Spain', '225': 'Spain', '226': 'France',
    '227': 'France', '228': 'France', '229': 'Malta',
    '230': 'Finland', '231': 'Faroe', '232': 'UK',
    '233': 'UK', '234': 'UK', '235': 'UK',
    '236': 'Gibraltar', '237': 'Greece', '238': 'Croatia',
    '239': 'Greece', '240': 'Greece', '241': 'Greece',
    '242': 'Morocco', '243': 'Hungary', '244': 'Netherlands',
    '245': 'Netherlands', '246': 'Netherlands', '247': 'Italy',
    '248': 'Malta', '249': 'Malta', '250': 'Ireland',
    '255': 'Portugal', '256': 'Malta', '257': 'Norway',
    '258': 'Norway', '259': 'Norway', '261': 'Poland',
    '263': 'Portugal', '264': 'Romania', '265': 'Sweden',
    '266': 'Sweden', '267': 'Slovakia', '268': 'San Marino',
    '269': 'Switzerland', '270': 'Czechia', '271': 'Turkey',
    '272': 'Ukraine', '273': 'Russia', '274': 'North Macedonia',
    '275': 'Latvia', '276': 'Estonia', '277': 'Lithuania',
    '278': 'Slovenia', '279': 'Serbia',
    '301': 'Anguilla', '303': 'Alaska',
    '304': 'Antigua', '305': 'Antigua', '306': 'Sint Maarten',
    '307': 'Aruba', '308': 'Bahamas', '309': 'Bahamas',
    '310': 'Bermuda', '311': 'Bahamas', '312': 'Belize',
    '314': 'Barbados', '316': 'Canada',
    '319': 'Cayman', '321': 'Costa Rica', '323': 'Cuba',
    '325': 'Dominica', '327': 'Dominican Rep', '329': 'Guadeloupe',
    '330': 'Grenada', '331': 'Greenland', '332': 'Guatemala',
    '334': 'Honduras', '336': 'Haiti', '338': 'USA',
    '339': 'Jamaica', '341': 'St Kitts', '343': 'St Lucia',
    '345': 'Mexico', '347': 'Martinique', '348': 'Montserrat',
    '350': 'Nicaragua', '351': 'Panama', '352': 'Panama',
    '353': 'Panama', '354': 'Panama', '355': 'Panama',
    '356': 'Panama', '357': 'Panama', '358': 'Puerto Rico',
    '359': 'El Salvador', '361': 'St Pierre', '362': 'Trinidad',
    '364': 'Turks Caicos', '366': 'USA', '367': 'USA',
    '368': 'USA', '369': 'USA', '370': 'Panama',
    '371': 'Panama', '372': 'Panama', '373': 'Panama',
    '374': 'Panama', '375': 'St Vincent', '376': 'St Vincent',
    '377': 'St Vincent', '378': 'BVI', '379': 'USVI',
    '401': 'Afghanistan', '403': 'Saudi Arabia', '405': 'Bangladesh',
    '408': 'Bahrain', '410': 'Bhutan', '412': 'China',
    '413': 'China', '414': 'China', '416': 'Taiwan',
    '417': 'Sri Lanka', '419': 'India', '422': 'Iran',
    '423': 'Azerbaijan', '425': 'Iraq', '428': 'Israel',
    '431': 'Japan', '432': 'Japan', '434': 'Turkmenistan',
    '436': 'Kazakhstan', '437': 'Uzbekistan', '438': 'Jordan',
    '440': 'South Korea', '441': 'South Korea', '443': 'Palestine',
    '445': 'North Korea', '447': 'Kuwait', '450': 'Lebanon',
    '451': 'Kyrgyzstan', '453': 'Macau', '455': 'Maldives',
    '457': 'Mongolia', '459': 'Nepal', '461': 'Oman',
    '463': 'Pakistan', '466': 'Qatar', '468': 'Syria',
    '470': 'UAE', '472': 'Tajikistan', '473': 'Yemen',
    '475': 'Yemen', '477': 'Hong Kong',
    '501': 'France Adelie', '503': 'Australia',
    '506': 'Myanmar', '508': 'Brunei', '510': 'Micronesia',
    '511': 'Palau', '512': 'New Zealand', '514': 'Cambodia',
    '515': 'Cambodia', '516': 'Christmas Is', '518': 'Cook Is',
    '520': 'Fiji', '523': 'Cocos', '525': 'Indonesia',
    '529': 'Kiribati', '531': 'Laos', '533': 'Malaysia',
    '536': 'N Mariana', '538': 'Marshall Is', '540': 'New Caledonia',
    '542': 'Niue', '544': 'Nauru', '546': 'French Polynesia',
    '548': 'Philippines', '553': 'Papua NG', '555': 'Pitcairn',
    '557': 'Solomon Is', '559': 'Am Samoa', '561': 'Samoa',
    '563': 'Singapore', '564': 'Singapore', '565': 'Singapore',
    '566': 'Singapore', '567': 'Thailand', '570': 'Tonga',
    '572': 'Tuvalu', '574': 'Vietnam', '576': 'Vanuatu',
    '577': 'Vanuatu', '578': 'Wallis',
  };

  const country = militaryMids[mid];

  // Check for military vessel patterns
  for (const pattern of MILITARY_VESSEL_PATTERNS) {
    if (pattern.mmsiPrefix && mmsi.startsWith(pattern.mmsiPrefix)) {
      return { isPotentialMilitary: true, country: pattern.country };
    }
  }

  // Check last digits - some patterns indicate warships
  // Government vessels often have specific MMSI patterns
  const suffix = mmsi.substring(3);
  if (suffix.startsWith('00') || suffix.startsWith('99')) {
    return { isPotentialMilitary: true, country };
  }

  return { isPotentialMilitary: false, country };
}

/**
 * Match vessel name against known military vessels
 */
function matchKnownVessel(name: string): typeof KNOWN_NAVAL_VESSELS[number] | undefined {
  if (!name) return undefined;

  const normalized = name.toUpperCase().trim();

  for (const vessel of KNOWN_NAVAL_VESSELS) {
    if (normalized.includes(vessel.name.toUpperCase()) ||
        (vessel.hullNumber && normalized.includes(vessel.hullNumber))) {
      return vessel;
    }
  }

  // Check for common naval prefixes
  const navalPrefixes = ['USS', 'HMS', 'HMCS', 'HMAS', 'INS', 'JS', 'ROKS', 'TCG'];
  for (const prefix of navalPrefixes) {
    if (normalized.startsWith(prefix + ' ')) {
      // Known pattern but not in our database
      return undefined;
    }
  }

  return undefined;
}

/**
 * Determine vessel type from AIS ship type code
 */
function getVesselTypeFromAis(shipType: number): MilitaryVesselType | undefined {
  // AIS ship type codes
  // 35 = Military ops
  // 50-59 = Special craft
  // 55 = Law enforcement

  if (shipType === 35) return 'destroyer'; // Generic military
  if (shipType === 55) return 'patrol'; // Law enforcement/coast guard
  if (shipType >= 50 && shipType <= 59) return 'special';

  return undefined;
}

/**
 * Check if vessel is near a naval base
 */
function getNearbyBase(lat: number, lon: number): string | undefined {
  for (const base of NAVAL_BASES) {
    const distance = Math.sqrt(Math.pow(lat - base.lat, 2) + Math.pow(lon - base.lon, 2));
    if (distance <= 0.5) { // Within ~50km
      return base.name;
    }
  }
  return undefined;
}

/**
 * Check if vessel is near a chokepoint
 */
function getNearbyChokepoint(lat: number, lon: number): string | undefined {
  for (const chokepoint of NAVAL_CHOKEPOINTS) {
    const distance = Math.sqrt(Math.pow(lat - chokepoint.lat, 2) + Math.pow(lon - chokepoint.lon, 2));
    if (distance <= chokepoint.radius) {
      return chokepoint.name;
    }
  }
  return undefined;
}

/**
 * Process incoming AIS position report for military vessel detection
 */
function processPositionReport(data: {
  MetaData: { MMSI: number; ShipName: string; latitude: number; longitude: number; time_utc: string; ShipType?: number };
  Message: { PositionReport?: { Latitude: number; Longitude: number; Cog?: number; Sog?: number; TrueHeading?: number } };
}): void {
  const meta = data.MetaData;
  const pos = data.Message.PositionReport;

  if (!meta || !pos) return;

  const mmsi = String(meta.MMSI);
  const name = meta.ShipName || '';
  const lat = pos.Latitude ?? meta.latitude;
  const lon = pos.Longitude ?? meta.longitude;
  const now = Date.now();

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

  // Check if this is a military/government vessel
  const mmsiAnalysis = analyzeMmsi(mmsi);
  const knownVessel = matchKnownVessel(name);
  const aisType = meta.ShipType ? getVesselTypeFromAis(meta.ShipType) : undefined;

  // Determine if we should track this vessel
  const isMilitary = knownVessel || mmsiAnalysis.isPotentialMilitary || aisType;

  if (!isMilitary) return;

  messageCount++;

  // Check proximity to strategic locations
  const nearChokepoint = getNearbyChokepoint(lat, lon);
  const nearBase = getNearbyBase(lat, lon);
  const nearHotspot = getNearbyHotspot(lat, lon);

  // Update vessel history for trails
  let history = vesselHistory.get(mmsi);
  if (!history) {
    history = { positions: [], lastUpdate: now };
    vesselHistory.set(mmsi, history);
  }
  history.positions.push([lat, lon]);
  if (history.positions.length > HISTORY_MAX_POINTS) {
    history.positions.shift();
  }
  history.lastUpdate = now;

  // Determine operator
  let operator: MilitaryOperator | 'other' = 'other';
  let operatorCountry = mmsiAnalysis.country || 'Unknown';

  if (knownVessel) {
    operator = knownVessel.operator;
    operatorCountry = knownVessel.country;
  }

  // Check for AIS gap (dark ship detection)
  const existingVessel = trackedVessels.get(mmsi);
  let aisGapMinutes: number | undefined;
  let isDark = false;

  if (existingVessel) {
    const timeSinceLastUpdate = now - existingVessel.lastAisUpdate.getTime();
    aisGapMinutes = Math.round(timeSinceLastUpdate / (60 * 1000));
    isDark = aisGapMinutes > 60; // 1 hour gap
  }

  // Create/update vessel record
  const vessel: MilitaryVessel = {
    id: `ais-${mmsi}`,
    mmsi,
    name: name || (knownVessel?.name || `Vessel ${mmsi}`),
    vesselType: knownVessel?.vesselType || aisType || 'unknown',
    hullNumber: knownVessel?.hullNumber,
    operator,
    operatorCountry,
    lat,
    lon,
    heading: pos.TrueHeading || pos.Cog || 0,
    speed: pos.Sog || 0,
    course: pos.Cog,
    lastAisUpdate: new Date(now),
    aisGapMinutes,
    isDark,
    nearChokepoint,
    nearBase,
    track: history.positions.length > 1 ? [...history.positions] : undefined,
    confidence: knownVessel ? 'high' : mmsiAnalysis.isPotentialMilitary ? 'medium' : 'low',
    isInteresting: Boolean(nearHotspot?.priority === 'high' || isDark || nearChokepoint),
    note: isDark ? 'Returned after AIS silence' : (nearChokepoint ? `Near ${nearChokepoint}` : undefined),
  };

  trackedVessels.set(mmsi, vessel);

  if (messageCount % 50 === 0) {
    console.log(`[Military Vessels] Tracking ${trackedVessels.size} military/gov vessels`);
  }
}

/**
 * Handle incoming WebSocket message
 */
function handleMessage(event: MessageEvent): void {
  try {
    const data = JSON.parse(event.data);

    if (data.MessageType === 'PositionReport') {
      processPositionReport(data);
    }
  } catch {
    // Ignore parse errors
  }
}

/**
 * Connect to AIS WebSocket stream
 */
function connect(): void {
  if (socket?.readyState === WebSocket.OPEN) return;
  if (!aisConfigured) {
    console.log('[Military Vessels] AIS not configured, skipping WebSocket');
    return;
  }

  console.log('[Military Vessels] Connecting to AIS stream...');
  try {
    socket = new WebSocket(AISSTREAM_URL);

    socket.onopen = () => {
      console.log('[Military Vessels] Connected to AIS relay');
      isConnected = true;
    };

    socket.onmessage = handleMessage;

    socket.onclose = (event) => {
      console.log('[Military Vessels] Disconnected:', event.code);
      isConnected = false;
      scheduleReconnect();
    };

    socket.onerror = () => {
      isConnected = false;
    };
  } catch (e) {
    console.error('[Military Vessels] Connection error:', e);
    scheduleReconnect();
  }
}

/**
 * Schedule reconnection
 */
function scheduleReconnect(): void {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connect();
  }, 30000);
}

/**
 * Clean up stale vessels and old history
 */
function cleanup(): void {
  const now = Date.now();
  const staleCutoff = now - VESSEL_STALE_TIME;

  // Remove stale vessels
  for (const [mmsi, vessel] of trackedVessels) {
    if (vessel.lastAisUpdate.getTime() < staleCutoff) {
      trackedVessels.delete(mmsi);
      vesselHistory.delete(mmsi);
    }
  }

  // Clean up orphaned history entries
  for (const [mmsi, history] of vesselHistory) {
    if (history.lastUpdate < staleCutoff) {
      vesselHistory.delete(mmsi);
    }
  }
}

/**
 * Cluster nearby vessels
 */
function clusterVessels(vessels: MilitaryVessel[]): MilitaryVesselCluster[] {
  const clusters: MilitaryVesselCluster[] = [];
  const processed = new Set<string>();

  for (const hotspot of MILITARY_HOTSPOTS) {
    const nearbyVessels = vessels.filter((v) => {
      if (processed.has(v.id)) return false;
      const distance = Math.sqrt(Math.pow(v.lat - hotspot.lat, 2) + Math.pow(v.lon - hotspot.lon, 2));
      return distance <= hotspot.radius;
    });

    if (nearbyVessels.length >= 2) {
      nearbyVessels.forEach((v) => processed.add(v.id));

      const avgLat = nearbyVessels.reduce((sum, v) => sum + v.lat, 0) / nearbyVessels.length;
      const avgLon = nearbyVessels.reduce((sum, v) => sum + v.lon, 0) / nearbyVessels.length;

      // Determine activity type
      const hasCarrier = nearbyVessels.some((v) => v.vesselType === 'carrier');
      const hasCombatants = nearbyVessels.some((v) =>
        v.vesselType === 'destroyer' || v.vesselType === 'frigate'
      );

      let activityType: 'exercise' | 'deployment' | 'transit' | 'unknown' = 'unknown';
      if (hasCarrier || nearbyVessels.length >= 5) activityType = 'deployment';
      else if (hasCombatants) activityType = 'exercise';
      else activityType = 'transit';

      clusters.push({
        id: `vessel-cluster-${hotspot.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: `${hotspot.name} Naval Activity`,
        lat: avgLat,
        lon: avgLon,
        vesselCount: nearbyVessels.length,
        vessels: nearbyVessels,
        region: hotspot.name,
        activityType,
      });
    }
  }

  return clusters;
}

// Initialize cleanup interval
if (typeof window !== 'undefined') {
  setInterval(cleanup, HISTORY_CLEANUP_INTERVAL);
}

/**
 * Initialize military vessel tracking
 */
export function initMilitaryVesselStream(): void {
  console.log('[Military Vessels] Initializing tracking...');
  connect();
}

/**
 * Disconnect from vessel stream
 */
export function disconnectMilitaryVesselStream(): void {
  if (socket) {
    socket.close();
    socket = null;
  }
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  isConnected = false;
}

/**
 * Get current tracking status
 */
export function getMilitaryVesselStatus(): { connected: boolean; vessels: number; messages: number } {
  return {
    connected: isConnected,
    vessels: trackedVessels.size,
    messages: messageCount,
  };
}

// Cache TTL
const CACHE_TTL = 30 * 1000; // 30 seconds

/**
 * Main function to get military vessels
 */
export async function fetchMilitaryVessels(): Promise<{
  vessels: MilitaryVessel[];
  clusters: MilitaryVesselCluster[];
}> {
  return breaker.execute(async () => {
    // Check cache first
    if (vesselCache && Date.now() - vesselCache.timestamp < CACHE_TTL) {
      const clusters = clusterVessels(vesselCache.data);
      return { vessels: vesselCache.data, clusters };
    }

    // Initialize stream if not running
    if (!socket && aisConfigured) {
      connect();
    }

    // Clean up old data
    cleanup();

    // Convert tracked vessels to array
    const vessels = Array.from(trackedVessels.values());

    // Update cache
    vesselCache = { data: vessels, timestamp: Date.now() };

    // Generate clusters
    const clusters = clusterVessels(vessels);

    return { vessels, clusters };
  }, { vessels: [], clusters: [] });
}

/**
 * Get status string for circuit breaker
 */
export function getMilitaryVesselsStatus(): string {
  return breaker.getStatus();
}

/**
 * Get vessel by MMSI
 */
export function getVesselByMmsi(mmsi: string): MilitaryVessel | undefined {
  return trackedVessels.get(mmsi);
}

/**
 * Get vessels near a specific location
 */
export function getVesselsNearLocation(lat: number, lon: number, radiusDeg: number = 2): MilitaryVessel[] {
  const result: MilitaryVessel[] = [];
  for (const vessel of trackedVessels.values()) {
    const distance = Math.sqrt(Math.pow(vessel.lat - lat, 2) + Math.pow(vessel.lon - lon, 2));
    if (distance <= radiusDeg) {
      result.push(vessel);
    }
  }
  return result;
}

/**
 * Get dark (AIS-disabled) vessels
 */
export function getDarkVessels(): MilitaryVessel[] {
  return Array.from(trackedVessels.values()).filter((v) => v.isDark);
}

/**
 * Check if AIS stream is configured
 */
export function isMilitaryVesselTrackingConfigured(): boolean {
  return aisConfigured;
}
