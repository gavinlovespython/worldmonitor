export interface Feed {
  name: string;
  url: string;
  type?: string;
  region?: string;
}

export interface NewsItem {
  source: string;
  title: string;
  link: string;
  pubDate: Date;
  isAlert: boolean;
  monitorColor?: string;
  tier?: number;
}

export type VelocityLevel = 'normal' | 'elevated' | 'spike';
export type SentimentType = 'negative' | 'neutral' | 'positive';
export type DeviationLevel = 'normal' | 'elevated' | 'spike' | 'quiet';

export interface VelocityMetrics {
  sourcesPerHour: number;
  level: VelocityLevel;
  trend: 'rising' | 'stable' | 'falling';
  sentiment: SentimentType;
  sentimentScore: number;
}

export interface ClusteredEvent {
  id: string;
  primaryTitle: string;
  primarySource: string;
  primaryLink: string;
  sourceCount: number;
  topSources: Array<{ name: string; tier: number; url: string }>;
  allItems: NewsItem[];
  firstSeen: Date;
  lastUpdated: Date;
  isAlert: boolean;
  monitorColor?: string;
  velocity?: VelocityMetrics;
}

export type AssetType = 'pipeline' | 'cable' | 'datacenter' | 'base' | 'nuclear';

export interface RelatedAsset {
  id: string;
  name: string;
  type: AssetType;
  distanceKm: number;
}

export interface RelatedAssetContext {
  origin: { label: string; lat: number; lon: number };
  types: AssetType[];
  assets: RelatedAsset[];
}

export interface Sector {
  symbol: string;
  name: string;
}

export interface Commodity {
  symbol: string;
  name: string;
  display: string;
}

export interface MarketSymbol {
  symbol: string;
  name: string;
  display: string;
}

export interface MarketData {
  symbol: string;
  name: string;
  display: string;
  price: number | null;
  change: number | null;
}

export interface CryptoData {
  name: string;
  symbol: string;
  price: number;
  change: number;
}

export interface Hotspot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  keywords: string[];
  subtext?: string;
  agencies?: string[];
  level?: 'low' | 'elevated' | 'high';
  description?: string;
  status?: string;
}

export interface StrategicWaterway {
  id: string;
  name: string;
  lat: number;
  lon: number;
  description?: string;
}

export type AisDisruptionType = 'gap_spike' | 'chokepoint_congestion';

export interface AisDisruptionEvent {
  id: string;
  name: string;
  type: AisDisruptionType;
  lat: number;
  lon: number;
  severity: 'low' | 'elevated' | 'high';
  changePct: number;
  windowHours: number;
  darkShips?: number;
  vesselCount?: number;
  region?: string;
  description: string;
}

export interface AisDensityZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
  intensity: number;
  deltaPct: number;
  shipsPerDay?: number;
  note?: string;
}

export interface APTGroup {
  id: string;
  name: string;
  aka: string;
  sponsor: string;
  lat: number;
  lon: number;
}

export interface ConflictZone {
  id: string;
  name: string;
  coords: [number, number][];
  center: [number, number];
  intensity?: 'high' | 'medium' | 'low';
  parties?: string[];
  casualties?: string;
  displaced?: string;
  keywords?: string[];
  startDate?: string;
  location?: string;
  description?: string;
  keyDevelopments?: string[];
}

// Military base operator types
export type MilitaryBaseType =
  | 'us-nato'      // United States and NATO allies
  | 'china'        // People's Republic of China
  | 'russia'       // Russian Federation
  | 'uk'           // United Kingdom (non-US NATO)
  | 'france'       // France (non-US NATO)
  | 'india'        // India
  | 'italy'        // Italy
  | 'uae'          // United Arab Emirates
  | 'turkey'       // Turkey
  | 'japan'        // Japan Self-Defense Forces
  | 'other';       // Other nations

export interface MilitaryBase {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: MilitaryBaseType;
  description?: string;
  country?: string;           // Host country
  arm?: string;               // Armed forces branch (Navy, Air Force, Army, etc.)
  status?: 'active' | 'planned' | 'controversial' | 'closed';
  source?: string;            // Reference URL
}

export interface UnderseaCable {
  id: string;
  name: string;
  points: [number, number][];
  major?: boolean;
}

export type CableAdvisorySeverity = 'fault' | 'degraded';

export interface CableAdvisory {
  id: string;
  cableId: string;
  title: string;
  severity: CableAdvisorySeverity;
  description: string;
  reported: Date;
  lat: number;
  lon: number;
  impact: string;
  repairEta?: string;
}

export type RepairShipStatus = 'enroute' | 'on-station';

export interface RepairShip {
  id: string;
  name: string;
  cableId: string;
  status: RepairShipStatus;
  lat: number;
  lon: number;
  eta: string;
  operator?: string;
  note?: string;
}

export interface ShippingChokepoint {
  id: string;
  name: string;
  lat: number;
  lon: number;
  desc: string;
}

export interface CyberRegion {
  id: string;
  group: string;
  aka: string;
  sponsor: string;
}

// Nuclear facility types
export type NuclearFacilityType =
  | 'plant'        // Power reactors
  | 'enrichment'   // Uranium enrichment
  | 'reprocessing' // Plutonium reprocessing
  | 'weapons'      // Weapons design/assembly
  | 'ssbn'         // Submarine base (nuclear deterrent)
  | 'test-site'    // Nuclear test site
  | 'icbm'         // ICBM silo fields
  | 'research';    // Research reactors

export interface NuclearFacility {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type: NuclearFacilityType;
  status: 'active' | 'contested' | 'inactive' | 'decommissioned' | 'construction';
  operator?: string;  // Operating country
}

export interface GammaIrradiator {
  id: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  organization?: string;
}

export type PipelineType = 'oil' | 'gas' | 'products';
export type PipelineStatus = 'operating' | 'construction';

export interface Pipeline {
  id: string;
  name: string;
  type: PipelineType;
  status: PipelineStatus;
  points: [number, number][];  // [lon, lat] pairs
  capacity?: string;           // e.g., "1.2 million bpd"
  length?: string;             // e.g., "1,768 km"
  operator?: string;
  countries?: string[];
}

export interface Earthquake {
  id: string;
  place: string;
  magnitude: number;
  lat: number;
  lon: number;
  depth: number;
  time: Date;
  url: string;
}

export interface Monitor {
  id: string;
  keywords: string[];
  color: string;
  name?: string;
  lat?: number;
  lon?: number;
}

export interface PanelConfig {
  name: string;
  enabled: boolean;
  priority?: number;
}

export interface MapLayers {
  conflicts: boolean;
  bases: boolean;
  cables: boolean;
  pipelines: boolean;
  hotspots: boolean;
  ais: boolean;
  nuclear: boolean;
  irradiators: boolean;
  sanctions: boolean;
  earthquakes: boolean;
  weather: boolean;
  economic: boolean;
  countries: boolean;
  waterways: boolean;
  outages: boolean;
  datacenters: boolean;
  protests: boolean;
  flights: boolean;
  militaryFlights: boolean;
  militaryVessels: boolean;
}

export interface AIDataCenter {
  id: string;
  name: string;
  owner: string;
  country: string;
  lat: number;
  lon: number;
  status: 'existing' | 'planned' | 'decommissioned';
  chipType: string;
  chipCount: number;
  powerMW?: number;
  h100Equivalent?: number;
  sector?: string;
  note?: string;
}

export interface InternetOutage {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: Date;
  country: string;
  region?: string;
  lat: number;
  lon: number;
  severity: 'partial' | 'major' | 'total';
  categories: string[];
  cause?: string;
  outageType?: string;
  endDate?: Date;
}

export type EconomicCenterType = 'exchange' | 'central-bank' | 'financial-hub';

export interface EconomicCenter {
  id: string;
  name: string;
  type: EconomicCenterType;
  lat: number;
  lon: number;
  country: string;
  marketHours?: { open: string; close: string; timezone: string };
  description?: string;
}

export interface PredictionMarket {
  title: string;
  yesPrice: number;
  volume?: number;
}

export interface AppState {
  currentView: 'global' | 'us';
  mapZoom: number;
  mapPan: { x: number; y: number };
  mapLayers: MapLayers;
  panels: Record<string, PanelConfig>;
  monitors: Monitor[];
  allNews: NewsItem[];
  isLoading: boolean;
}

export type FeedCategory = 'politics' | 'tech' | 'finance' | 'gov' | 'intel';

// Social Unrest / Protest Types
export type ProtestSeverity = 'low' | 'medium' | 'high';
export type ProtestSource = 'acled' | 'gdelt' | 'rss';
export type ProtestEventType = 'protest' | 'riot' | 'strike' | 'demonstration' | 'civil_unrest';

export interface SocialUnrestEvent {
  id: string;
  title: string;
  summary?: string;
  eventType: ProtestEventType;
  city?: string;
  country: string;
  region?: string;
  lat: number;
  lon: number;
  time: Date;
  severity: ProtestSeverity;
  fatalities?: number;
  sources: string[];
  sourceType: ProtestSource;
  tags?: string[];
  actors?: string[];
  relatedHotspots?: string[];
  confidence: 'high' | 'medium' | 'low';
  validated: boolean;
  imageUrl?: string;
  sentiment?: 'angry' | 'peaceful' | 'mixed';
}

export interface ProtestCluster {
  id: string;
  country: string;
  region?: string;
  eventCount: number;
  events: SocialUnrestEvent[];
  severity: ProtestSeverity;
  startDate: Date;
  endDate: Date;
  primaryCause?: string;
}

// Flight Delay Types
export type FlightDelaySource = 'faa' | 'eurocontrol' | 'computed';
export type FlightDelaySeverity = 'normal' | 'minor' | 'moderate' | 'major' | 'severe';
export type FlightDelayType = 'ground_stop' | 'ground_delay' | 'departure_delay' | 'arrival_delay' | 'general';
export type AirportRegion = 'americas' | 'europe' | 'apac' | 'mena' | 'africa';

export interface AirportDelayAlert {
  id: string;
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  region: AirportRegion;
  delayType: FlightDelayType;
  severity: FlightDelaySeverity;
  avgDelayMinutes: number;
  delayedFlightsPct?: number;
  cancelledFlights?: number;
  totalFlights?: number;
  reason?: string;
  source: FlightDelaySource;
  updatedAt: Date;
}

export interface MonitoredAirport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  region: AirportRegion;
}

// Military Flight Tracking Types
export type MilitaryAircraftType =
  | 'fighter'           // F-15, F-16, F-22, F-35, Su-27, etc.
  | 'bomber'            // B-52, B-1, B-2, Tu-95, etc.
  | 'transport'         // C-130, C-17, Il-76, A400M, etc.
  | 'tanker'            // KC-135, KC-10, KC-46, etc.
  | 'awacs'             // E-3, E-7, A-50, etc.
  | 'reconnaissance'    // RC-135, U-2, EP-3, etc.
  | 'helicopter'        // UH-60, CH-47, Mi-8, etc.
  | 'drone'             // RQ-4, MQ-9, etc.
  | 'patrol'            // P-8, P-3, etc.
  | 'special_ops'       // MC-130, CV-22, etc.
  | 'vip'               // Government/executive transport
  | 'unknown';

export type MilitaryOperator =
  | 'usaf'              // US Air Force
  | 'usn'               // US Navy
  | 'usmc'              // US Marine Corps
  | 'usa'               // US Army
  | 'raf'               // Royal Air Force (UK)
  | 'rn'                // Royal Navy (UK)
  | 'faf'               // French Air Force
  | 'gaf'               // German Air Force
  | 'plaaf'             // PLA Air Force (China)
  | 'plan'              // PLA Navy (China)
  | 'vks'               // Russian Aerospace Forces
  | 'iaf'               // Israeli Air Force
  | 'nato'              // NATO joint operations
  | 'other';

export interface MilitaryFlight {
  id: string;
  callsign: string;
  hexCode: string;             // ICAO 24-bit address
  registration?: string;
  aircraftType: MilitaryAircraftType;
  aircraftModel?: string;      // E.g., "F-35A", "C-17A"
  operator: MilitaryOperator;
  operatorCountry: string;
  lat: number;
  lon: number;
  altitude: number;            // feet
  heading: number;             // degrees
  speed: number;               // knots
  verticalRate?: number;       // feet/min
  onGround: boolean;
  squawk?: string;             // Transponder code
  origin?: string;             // ICAO airport code
  destination?: string;        // ICAO airport code
  lastSeen: Date;
  firstSeen?: Date;
  track?: [number, number][];  // Historical positions for trail
  confidence: 'high' | 'medium' | 'low';
  isInteresting?: boolean;     // Flagged for unusual activity
  note?: string;
}

export interface MilitaryFlightCluster {
  id: string;
  name: string;
  lat: number;
  lon: number;
  flightCount: number;
  flights: MilitaryFlight[];
  dominantOperator?: MilitaryOperator;
  activityType?: 'exercise' | 'patrol' | 'transport' | 'unknown';
}

// Military/Special Vessel Tracking Types
export type MilitaryVesselType =
  | 'carrier'           // Aircraft carrier
  | 'destroyer'         // Destroyer/Cruiser
  | 'frigate'           // Frigate/Corvette
  | 'submarine'         // Submarine (when surfaced/detected)
  | 'amphibious'        // LHD, LPD, LST
  | 'patrol'            // Coast guard, patrol boats
  | 'auxiliary'         // Supply ships, tankers
  | 'research'          // Intelligence gathering, research vessels
  | 'icebreaker'        // Military icebreakers
  | 'special'           // Special mission vessels
  | 'unknown';

export interface MilitaryVessel {
  id: string;
  mmsi: string;
  name: string;
  vesselType: MilitaryVesselType;
  hullNumber?: string;         // E.g., "DDG-51", "CVN-78"
  operator: MilitaryOperator | 'other';
  operatorCountry: string;
  lat: number;
  lon: number;
  heading: number;
  speed: number;               // knots
  course?: number;
  destination?: string;
  lastAisUpdate: Date;
  aisGapMinutes?: number;      // Time since last AIS signal
  isDark?: boolean;            // AIS disabled/suspicious
  nearChokepoint?: string;     // If near strategic waterway
  nearBase?: string;           // If near known naval base
  track?: [number, number][];  // Historical positions
  confidence: 'high' | 'medium' | 'low';
  isInteresting?: boolean;
  note?: string;
}

export interface MilitaryVesselCluster {
  id: string;
  name: string;
  lat: number;
  lon: number;
  vesselCount: number;
  vessels: MilitaryVessel[];
  region?: string;
  activityType?: 'exercise' | 'deployment' | 'transit' | 'unknown';
}

// Combined military activity summary
export interface MilitaryActivitySummary {
  flights: MilitaryFlight[];
  vessels: MilitaryVessel[];
  flightClusters: MilitaryFlightCluster[];
  vesselClusters: MilitaryVesselCluster[];
  activeOperations: number;
  lastUpdate: Date;
}
