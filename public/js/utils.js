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

// Port coordinates lookup for journey lines (synced with backend port-coords.js)
var PORT_COORDS = {
  // UAE
  'FUJAIRAH': [25.12, 56.35], 'JEBEL ALI': [25.01, 55.06],
  'RUWAIS': [24.11, 52.73], 'KHOR FAKKAN': [25.34, 56.35],
  // Saudi Arabia
  'JEDDAH': [21.48, 39.17], 'JUBAIL': [27.00, 49.66],
  'RAS TANURA': [26.64, 50.16], 'YANBU': [24.09, 38.06],
  'SHOAIBA': [20.67, 39.50], 'RABIGH': [22.79, 39.02],
  // India
  'MUNDRA': [22.74, 69.72], 'KANDLA': [23.03, 70.22],
  'PIPAVAV': [20.91, 71.52], 'MUMBAI': [18.95, 72.84],
  'COCHIN': [9.97, 76.27], 'CHENNAI': [13.08, 80.29],
  // Singapore & SE Asia
  'SINGAPORE': [1.27, 103.82], 'PORT KLANG': [3.00, 101.39],
  'TANJUNG BURAS': [2.35, 111.83], 'PENANG': [5.42, 100.35],
  'PRAI': [5.38, 100.39], 'HO CHI MINH': [10.77, 106.71],
  // East Asia
  'SHANGHAI': [31.36, 121.62], 'YOKOHAMA': [35.44, 139.64],
  'SHENAO': [25.13, 121.82], 'KAOHSIUNG': [22.62, 120.27],
  'BUSAN': [35.10, 129.04],
  // Mediterranean
  'VENICE': [45.42, 12.34], 'AUGUSTA': [37.23, 15.22],
  'SINES': [37.95, -8.87], 'ALGECIRAS': [36.13, -5.43],
  // Red Sea & Egypt
  'SUEZ STS': [29.97, 32.55], 'SUEZ': [29.97, 32.55],
  'AQABA': [29.52, 35.01], 'PORT SUDAN': [19.62, 37.22],
  // East Africa
  'DURBAN': [-29.86, 31.02], 'MOMBASA': [-4.04, 39.67],
  'DAR ES SALAAM': [-6.83, 39.29],
  // Europe
  'ANTWERP': [51.22, 4.40], 'ROTTERDAM': [51.90, 4.50],
  'HOUSTON': [29.73, -95.02],
  // Persian Gulf
  'BAHRAIN': [26.23, 50.55], 'KUWAIT': [29.34, 47.96],
  'BASRA': [30.50, 47.82], 'BANDAR ABBAS': [27.18, 56.28],
  'SOHAR': [24.36, 56.74],
  // Oman
  'MUSCAT': [23.61, 58.54], 'SALALAH': [16.94, 54.00],
  // Special
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
// opts.vessel: full vessel data object for popup/tooltip
function _createVesselMarker(map, lat, lng, riskLevel, tooltipText, opts) {
  var icon = _vesselIcon(riskLevel, opts);
  var marker = L.marker([lat, lng], { icon: icon }).addTo(map);
  var v = (opts && opts.vessel) || null;
  if (v) {
    marker.bindTooltip(_vesselTooltipHtml(v, riskLevel), {
      className: 'sentinel-vessel-tooltip', direction: 'top', offset: [0, -8]
    });
    marker.bindPopup(_vesselPopupHtml(v, riskLevel), {
      className: 'sentinel-vessel-popup', maxWidth: 320, minWidth: 260
    });
  } else if (tooltipText) {
    marker.bindTooltip(tooltipText, { className: 'sentinel-tooltip' });
  }
  return marker;
}

// Rich tooltip HTML for vessel hover (compact summary)
function _vesselTooltipHtml(v, riskLevel) {
  var name = _esc(v.name || v.vessel_name || 'Unknown');
  var type = _esc(v.typeLabel || v.type || '');
  var speed = v.speed || v.sog || 0;
  var dest = _esc(v.destination || '--');
  var flag = _esc(v.flag || '');
  var color = RISK_COLORS[riskLevel] || RISK_COLORS.LOW;
  return '<div style="font-family:var(--font-mono);font-size:11px;line-height:1.5;">' +
    '<div style="font-weight:600;color:' + color + ';font-size:12px;">' + name + '</div>' +
    '<div style="color:var(--text-muted);">' + type + (flag ? ' · ' + flag : '') + '</div>' +
    '<div>' + speed.toFixed(1) + ' kn → ' + dest + '</div>' +
  '</div>';
}

// Full popup HTML for vessel click (detailed info panel)
function _vesselPopupHtml(v, riskLevel) {
  var name = _esc(v.name || v.vessel_name || 'Unknown');
  var color = RISK_COLORS[riskLevel] || RISK_COLORS.LOW;
  var speed = v.speed || v.sog || 0;
  var course = v.course || v.heading || v.cog || 0;
  var rows = [
    _popupRow('IMO', v.imo || '--'),
    _popupRow('MMSI', v.mmsi || '--'),
    _popupRow('Type', v.typeLabel || v.type || '--'),
    _popupRow('Flag', v.flag || '--'),
    _popupRow('Class', v.classAbbr || v['class'] || '--'),
    _popupRow('Charterer', v.charterer || '--'),
    _popupRow('DWT', v.dwt ? v.dwt.toLocaleString() + ' MT' : '--'),
    _popupRow('Speed', speed.toFixed(1) + ' kn'),
    _popupRow('Course', course.toFixed(0) + '\u00b0'),
    _popupRow('Destination', v.destination || '--'),
    _popupRow('ETA', v.eta || '--'),
    _popupRow('Nav Status', v.navStatus || '--'),
    _popupRow('Status', v.status || '--')
  ];
  if (v.cargo && v.cargo.type) {
    rows.push(_popupRow('Cargo', _esc(v.cargo.type) + (v.cargo.quantity ? ' (' + _esc(v.cargo.quantity) + ')' : '')));
  }
  rows.push(_popupRow('Position', Number(v.lat).toFixed(4) + '\u00b0, ' + Number(v.lng).toFixed(4) + '\u00b0'));

  return '<div style="font-family:var(--font-mono);font-size:11px;">' +
    '<div style="font-size:13px;font-weight:700;color:' + color + ';padding-bottom:6px;border-bottom:1px solid var(--border,#333);margin-bottom:6px;">' +
      '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + color + ';margin-right:6px;"></span>' +
      name + ' <span style="font-weight:400;color:var(--text-muted,#888);font-size:10px;">[' + _esc(riskLevel) + ']</span>' +
    '</div>' +
    '<div style="display:grid;grid-template-columns:90px 1fr;gap:2px 8px;line-height:1.6;">' +
      rows.join('') +
    '</div>' +
  '</div>';
}

function _popupRow(label, value) {
  return '<span style="color:var(--text-muted,#888);font-size:10px;">' + _esc(label) + '</span>' +
    '<span style="color:var(--text,#ddd);">' + _esc(String(value)) + '</span>';
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
