// constants.js -- Enums, configuration, and shared constants
// BIHAR SENTINEL — Security Operations

// Recommendation urgency levels
var URGENCY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// Recommendation action types
var ACTION_TYPES = [
  'DIVERT', 'AVOID_ZONE', 'INCREASE_SPEED', 'INCREASE_WATCH',
  'HOLD_POSITION', 'REDUCE_SPEED', 'PROCEED_CAUTION', 'MONITOR'
];

// Incident lifecycle statuses
var LIFECYCLE_STATUSES = [
  'REPORTED', 'INVESTIGATING', 'CONFIRMED', 'UNCONFIRMED', 'RESOLVED', 'ARCHIVED'
];

// Incident types
var INCIDENT_TYPES = [
  'MISSILE_ATTACK', 'DRONE_ATTACK', 'MINE_THREAT', 'PIRACY',
  'SEIZURE', 'SUSPICIOUS_APPROACH', 'MILITARY_ACTION', 'ADVISORY'
];

// Proximity tiers
var PROXIMITY_TIERS = {
  DANGER: { distance: 10, color: '#e05555' },
  CRITICAL: { distance: 25, color: '#c0392b' },
  WARNING: { distance: 50, color: '#d4a037' },
  WATCH: { distance: 100, color: '#4a9eff' }
};

// Corridor status thresholds
var CORRIDOR_STATUSES = {
  GREEN: { min: 0, color: '#3cb371' },
  AMBER: { min: 1, color: '#d4a037' },
  RED: { min: 4, color: '#e05555' },
  BLACK: { min: 8, color: '#1a1a22' }
};

// Risk level colors
var RISK_COLORS = {
  CRITICAL: '#e05555',
  HIGH: '#c0392b',
  ELEVATED: '#d4a037',
  LOW: '#3cb371'
};

// Port coordinates for destination resolution
var portCoords = {
  'SINGAPORE': { lat: 1.2644, lng: 103.8200, name: 'Singapore', country: 'Singapore' },
  'JEDDAH': { lat: 21.5433, lng: 39.1728, name: 'Jeddah', country: 'Saudi Arabia' },
  'SINES': { lat: 37.9500, lng: -8.8667, name: 'Sines', country: 'Portugal' },
  'DURBAN': { lat: -29.8587, lng: 31.0218, name: 'Durban', country: 'South Africa' },
  'FUJAIRAH': { lat: 25.1288, lng: 56.3264, name: 'Fujairah', country: 'UAE' },
  'DRY DOCK': { lat: 25.3436, lng: 56.3475, name: 'Khor Fakkan', country: 'UAE' },
  'JEBEL ALI': { lat: 25.0066, lng: 55.0580, name: 'Jebel Ali', country: 'UAE' },
  'KANDLA': { lat: 23.0333, lng: 70.2167, name: 'Kandla', country: 'India' },
  'JUBAIL': { lat: 27.0046, lng: 49.6588, name: 'Jubail', country: 'Saudi Arabia' },
  'SHENAO': { lat: 25.1276, lng: 121.8167, name: 'Shenao', country: 'Taiwan' },
  'SUEZ STS': { lat: 29.9668, lng: 32.5498, name: 'Suez', country: 'Egypt' },
  'VENICE': { lat: 45.4408, lng: 12.3155, name: 'Venice', country: 'Italy' },
  'ANTWERP': { lat: 51.2194, lng: 4.4025, name: 'Antwerp', country: 'Belgium' },
  'TANJUNG BURAS': { lat: 2.0333, lng: 104.5833, name: 'Tanjung Buras', country: 'Malaysia' },
  'ORDERS': { lat: 26.2345, lng: 50.1234, name: 'Awaiting Orders', country: 'Saudi Arabia' },
  'SHOAIBA': { lat: 20.6894, lng: 39.5087, name: 'Shoaiba', country: 'Saudi Arabia' },
  'YANBU': { lat: 24.0894, lng: 38.0634, name: 'Yanbu', country: 'Saudi Arabia' },
  'RAS TANURA': { lat: 26.6383, lng: 50.1528, name: 'Ras Tanura', country: 'Saudi Arabia' },
  'PRAI': { lat: 5.3841, lng: 100.3938, name: 'Prai', country: 'Malaysia' },
  'RUWAIS': { lat: 24.1114, lng: 52.7300, name: 'Ruwais', country: 'UAE' }
};

// Trade routes by vessel type
var tradeRoutes = {
  tanker: ['FUJAIRAH', 'JEDDAH', 'SINGAPORE', 'SINES', 'RAS TANURA', 'DURBAN', 'SUEZ STS'],
  lpg: ['JEBEL ALI', 'KANDLA', 'FUJAIRAH', 'SINGAPORE', 'RUWAIS'],
  chemical: ['JUBAIL', 'SINGAPORE', 'SHENAO', 'FUJAIRAH', 'ANTWERP'],
  crude: ['FUJAIRAH', 'SHOAIBA', 'YANBU', 'RAS TANURA', 'JEDDAH', 'SUEZ STS', 'VENICE']
};

// Typical speeds by vessel type (knots)
var typicalSpeeds = {
  tanker: { min: 11, max: 13.5 },
  lpg: { min: 13, max: 15 },
  chemical: { min: 12.5, max: 14.5 },
  crude: { min: 11, max: 13 }
};
