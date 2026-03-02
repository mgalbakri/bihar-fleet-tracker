// utils.js -- Shared helpers, navigation math, formatting
// BIHAR SENTINEL
// This file MUST load before all view scripts

// Haversine distance in nautical miles
function haversineNm(lat1, lng1, lat2, lng2) {
    var R = 3440.065; // Earth radius in nm
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Calculate true bearing from point 1 to point 2
function trueBearing(lat1, lng1, lat2, lng2) {
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var lat1r = lat1 * Math.PI / 180;
    var lat2r = lat2 * Math.PI / 180;
    var y = Math.sin(dLng) * Math.cos(lat2r);
    var x = Math.cos(lat1r) * Math.sin(lat2r) - Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dLng);
    var brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

// Format ETA from hours remaining
function formatEta(hoursRemaining) {
    var arrival = new Date(Date.now() + hoursRemaining * 3600000);
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return arrival.getDate() + ' ' + months[arrival.getMonth()] + ' ' +
           String(arrival.getHours()).padStart(2,'0') + ':' + String(arrival.getMinutes()).padStart(2,'0');
}

// ========== SHARED HELPERS (used across all views) ==========

// Auth headers for API calls
function _authHeaders() {
  var h = {};
  var token = sessionStorage.getItem('sentinel_access_token');
  if (token) h['Authorization'] = 'Bearer ' + token;
  return h;
}

// Handle 401/403 -> redirect to login
function _handleAuth(r) {
  if (r.status === 401 || r.status === 403) { window.location.href = '/'; throw new Error('Auth expired'); }
  return r.json();
}

// Set text content by ID
function _setText(id, val) { var el = document.getElementById(id); if (el) el.textContent = val; }

// XSS-safe escape
function _esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// Relative time (e.g. "5m ago")
function _timeAgo(ts) {
  if (!ts) return '--';
  var diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return Math.floor(diff) + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

// Format timestamp for display (e.g. "02 Mar 14:30")
function _formatTime(ts) {
  if (!ts) return '--';
  var d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// Try to parse JSON, return original on failure
function _tryParse(s) { try { return JSON.parse(s); } catch(e) { return s; } }

// ========== SOURCE TIER HELPERS ==========

// NATO-style source classification
var SOURCE_TIERS = {
  UKMTO:       { tier: 1, label: 'OFFICIAL', color: '#4fc3f7' },
  MARAD:       { tier: 1, label: 'OFFICIAL', color: '#4fc3f7' },
  CENTCOM:     { tier: 1, label: 'OFFICIAL', color: '#4fc3f7' },
  ACLED:       { tier: 2, label: 'VERIFIED', color: '#81c784' },
  MANUAL:      { tier: 2, label: 'VERIFIED', color: '#81c784' },
  GOOGLE_NEWS: { tier: 3, label: 'NEWS', color: '#aaa' },
  NEWS_INTEL:  { tier: 3, label: 'NEWS', color: '#aaa' }
};

function _sourceTier(source) {
  return SOURCE_TIERS[source] || { tier: 3, label: 'NEWS', color: '#aaa' };
}

// Render source badge HTML (for use in innerHTML contexts)
function _sourceBadgeHtml(source) {
  var t = _sourceTier(source);
  return '<span class="source-tier-badge tier-' + t.tier + '" style="font-size:8px;font-family:var(--font-mono);letter-spacing:0.5px;padding:1px 4px;border-radius:2px;border:1px solid ' + t.color + ';color:' + t.color + ';white-space:nowrap;">' + t.label + '</span>';
}

// ========== MAP MARKER HELPERS ==========

// Risk level → color mapping (shared across all maps)
var RISK_COLORS = { CRITICAL: '#e05555', HIGH: '#c0392b', ELEVATED: '#d4a037', LOW: '#3cb371' };

// Port coordinates lookup for journey lines
var PORT_COORDS = {
  'SINGAPORE': [1.26, 103.84], 'JEDDAH': [21.49, 39.17], 'SINES': [37.95, -8.87],
  'DURBAN': [-29.87, 31.03], 'FUJAIRAH': [25.12, 56.33], 'JEBEL ALI': [25.01, 55.06],
  'KANDLA': [23.03, 70.22], 'JUBAIL': [27.01, 49.66], 'SHENAO': [25.12, 121.80],
  'SUEZ': [29.97, 32.55], 'SUEZ STS': [29.97, 32.55], 'VENICE': [45.44, 12.33],
  'ANTWERP': [51.22, 4.40], 'TANJUNG BURAS': [2.05, 102.44],
  'SHOAIBA': [20.68, 39.50], 'YANBU': [24.09, 38.06], 'RAS TANURA': [26.64, 50.15],
  'PRAI': [5.38, 100.39], 'BUSAN': [35.10, 129.03], 'MUMBAI': [18.95, 72.84],
  'DRY DOCK': null, 'ORDERS': null
};

// Create a triangle-shaped Leaflet divIcon for vessel markers
// Triangle points in direction of travel (rotated by heading/course)
function _vesselIcon(riskLevel, opts) {
  var color = RISK_COLORS[riskLevel] || RISK_COLORS.LOW;
  var size = (opts && opts.size) || 12;
  var half = size / 2;
  var heading = (opts && opts.heading != null) ? opts.heading : 0;
  var filter = (riskLevel === 'CRITICAL') ? 'filter:drop-shadow(0 0 3px ' + color + ');' : '';
  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [half, half],
    html: '<svg width="' + size + '" height="' + size + '" viewBox="0 0 12 12" ' +
      'style="transform:rotate(' + heading + 'deg);' + filter + '">' +
      '<polygon points="6,1 11,11 1,11" fill="' + color + '" stroke="rgba(255,255,255,0.6)" stroke-width="0.8"/>' +
    '</svg>'
  });
}

// Create a vessel marker (triangle) at given coords
// opts.heading: rotation in degrees (0=north, 90=east)
function _createVesselMarker(map, lat, lng, riskLevel, tooltipText, opts) {
  var icon = _vesselIcon(riskLevel, opts);
  var marker = L.marker([lat, lng], { icon: icon }).addTo(map);
  if (tooltipText) {
    marker.bindTooltip(tooltipText, { className: 'sentinel-tooltip' });
  }
  return marker;
}

// Draw a dotted journey line from vessel position to destination port
// Returns the polyline (or null if destination unknown)
function _createJourneyLine(map, vesselLat, vesselLng, destination, color) {
  if (!destination) return null;
  var dest = destination.toUpperCase().trim();
  var coords = PORT_COORDS[dest];
  if (!coords) return null;
  // Don't draw if vessel is basically at the destination (< 20nm)
  if (haversineNm(vesselLat, vesselLng, coords[0], coords[1]) < 20) return null;
  return L.polyline(
    [[vesselLat, vesselLng], coords],
    { color: color || 'rgba(255,255,255,0.15)', weight: 1, dashArray: '4 6', interactive: false }
  ).addTo(map);
}
