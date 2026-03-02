// overview.js -- Situational Overview command center view
// BIHAR SENTINEL

var overviewMap = null;
var overviewMarkers = {};
var overviewHeatLayer = null;
var overviewIncidentMarkers = [];
var overviewInitialized = false;

function initOverview() {
  if (overviewInitialized) return;
  overviewInitialized = true;

  overviewMap = L.map('overview-map', {
    center: [15, 55],
    zoom: 4,
    zoomControl: false,
    attributionControl: false
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 18
  }).addTo(overviewMap);

  L.control.zoom({ position: 'topright' }).addTo(overviewMap);

  if (typeof initZoneOverlays === 'function') {
    initZoneOverlays(overviewMap);
  }

  refreshOverview();
}

function refreshOverview() {
  var headers = _authHeaders();
  Promise.all([
    fetch('/api/vessels', { headers: headers }).then(_handleAuth),
    fetch('/api/incidents?status=active&limit=50', { headers: headers }).then(_handleAuth),
    fetch('/api/alerts?active=true', { headers: headers }).then(_handleAuth).catch(function() { return []; }),
    fetch('/api/corridors', { headers: headers }).then(_handleAuth).catch(function() { return []; }),
    fetch('/api/recommendations?status=ACTIVE', { headers: headers }).then(_handleAuth).catch(function() { return []; }),
    fetch('/api/notices/pending', { headers: headers }).then(_handleAuth).catch(function() { return []; })
  ]).then(function(results) {
    var vessels = results[0] || [];
    var incidents = results[1] || [];
    var alerts = results[2] || [];
    var corridors = results[3] || [];
    var recs = results[4] || [];
    var notices = results[5] || [];

    window.vessels = vessels;
    renderOverviewStats(vessels, incidents, alerts, recs, notices);
    renderCorridorStrip(corridors);
    renderOverviewMap(vessels, incidents);
    renderOverviewRecs(recs);
    renderOverviewAlerts(alerts);
    renderOverviewThreatFeed(incidents);
    renderOverviewFleetStrip(vessels);
  }).catch(function(err) {
    console.error('[OVERVIEW] Refresh failed:', err);
  });
}

function renderOverviewStats(vessels, incidents, alerts, recs, notices) {
  _setText('ostat-fleet', vessels.length);
  var jwcCount = vessels.filter(function(v) { return v.inJWC; }).length;
  _setText('ostat-jwc', jwcCount);
  _setText('ostat-alerts', alerts.length);
  _setText('ostat-incidents', incidents.length);
  _setText('ostat-recs', recs.length);
  _setText('ostat-notices', Array.isArray(notices) ? notices.length : 0);
  _setText('recCount', recs.length);
  _setText('alertCount', alerts.length);
}

function renderCorridorStrip(corridors) {
  var el = document.getElementById('corridorStrip');
  if (!el) return;
  if (!corridors || corridors.length === 0) {
    el.innerHTML = '<div class="corridor-card"><div class="corridor-name">No corridor data</div></div>';
    return;
  }
  el.innerHTML = corridors.map(function(c) {
    var name = (c.corridor || c.name || '').replace(/_/g, ' ');
    return '<div class="corridor-card" onclick="switchView(\'threatmap\')">' +
      '<div class="corridor-name">' + _esc(name) + '</div>' +
      '<div class="corridor-status ' + _esc(c.status) + '">' + _esc(c.status) + '</div>' +
      '<div class="corridor-incidents">' + (c.incidentCount || 0) + ' incidents (7d)</div>' +
    '</div>';
  }).join('');
}

function renderOverviewMap(vessels, incidents) {
  if (!overviewMap) return;

  // Clear existing markers
  Object.values(overviewMarkers).forEach(function(m) { overviewMap.removeLayer(m); });
  overviewMarkers = {};
  overviewIncidentMarkers.forEach(function(m) { overviewMap.removeLayer(m); });
  overviewIncidentMarkers = [];

  // Vessel markers
  vessels.forEach(function(v) {
    if (!v.lat || !v.lng) return;
    var riskLevel = v.riskLevel || 'LOW';
    var color = { CRITICAL: '#e05555', HIGH: '#c0392b', ELEVATED: '#d4a037', LOW: '#3cb371' }[riskLevel] || '#3cb371';
    var marker = L.circleMarker([v.lat, v.lng], {
      radius: 4, fillColor: color, fillOpacity: 0.9, color: color, weight: 1, opacity: 0.6
    }).addTo(overviewMap);
    marker.bindTooltip(_esc(v.name || v.vessel_name) + ' [' + riskLevel + ']', { className: 'sentinel-tooltip' });
    overviewMarkers[v.id || v.imo] = marker;
  });

  // Incident markers
  incidents.forEach(function(inc) {
    if (!inc.lat || !inc.lon) return;
    var sevColor = { 5: '#e05555', 4: '#c0392b', 3: '#d4a037', 2: '#4a7dcc', 1: '#555568' }[inc.severity] || '#d4a037';
    var m = L.circleMarker([inc.lat, inc.lon], {
      radius: 6, fillColor: sevColor, fillOpacity: 0.7, color: '#fff', weight: 1, opacity: 0.5
    }).addTo(overviewMap);
    m.bindTooltip(_esc(inc.title || inc.type) + ' [Sev ' + inc.severity + ']', { className: 'sentinel-tooltip' });
    overviewIncidentMarkers.push(m);
  });
}

function renderOverviewRecs(recs) {
  var el = document.getElementById('overviewRecList');
  if (!el) return;
  if (!recs || recs.length === 0) {
    el.innerHTML = '<div class="empty-state">No active recommendations</div>';
    return;
  }
  el.innerHTML = recs.slice(0, 10).map(function(r) {
    var actions = _tryParse(r.suggested_actions);
    return '<div class="rec-card" onclick="switchView(\'fleet\')">' +
      '<div class="rec-card-header">' +
        '<span class="rec-urgency ' + _esc(r.urgency) + '">' + _esc(r.urgency) + '</span>' +
        '<span class="rec-vessel">' + _esc(r.vessel_name || r.vessel_imo) + '</span>' +
        '<span class="rec-action">' + _esc((r.action_type || '').replace(/_/g, ' ')) + '</span>' +
      '</div>' +
      '<div class="rec-text">' + _esc(r.recommendation_text || '') + '</div>' +
      '<div class="rec-meta"><span>Score: ' + (r.risk_score || '--') + '</span><span>' + _timeAgo(r.created_at) + '</span></div>' +
    '</div>';
  }).join('');
}

function renderOverviewAlerts(alerts) {
  var el = document.getElementById('overviewAlertList');
  if (!el) return;
  if (!alerts || alerts.length === 0) {
    el.innerHTML = '<div class="empty-state">No active alerts</div>';
    return;
  }
  el.innerHTML = alerts.slice(0, 8).map(function(a) {
    var tier = a.tier || a.alert_level || 'WATCH';
    return '<div class="alert-card">' +
      '<div class="alert-severity ' + _esc(tier) + '"></div>' +
      '<div class="alert-info">' +
        '<div class="alert-title">' + _esc(a.vessel_name || a.vessel_imo || '') + ' - ' + _esc(a.incident_title || a.incident_type || '') + '</div>' +
        '<div class="alert-sub">' + _esc(tier) + ' · ' + (a.distance_nm ? a.distance_nm.toFixed(1) + ' nm' : '--') + '</div>' +
      '</div>' +
      '<div class="alert-time">' + _timeAgo(a.created_at || a.timestamp) + '</div>' +
    '</div>';
  }).join('');
}

function renderOverviewThreatFeed(incidents) {
  var el = document.getElementById('overviewThreatFeed');
  if (!el) return;
  if (!incidents || incidents.length === 0) {
    el.innerHTML = '<div class="empty-state">No active threats</div>';
    return;
  }
  el.innerHTML = incidents.slice(0, 15).map(function(inc) {
    return '<div class="threat-item" onclick="viewIncident(\'' + _esc(inc.id) + '\')">' +
      '<div class="threat-item-header">' +
        '<span class="threat-sev sev-' + (inc.severity || 3) + '"></span>' +
        '<span class="threat-type">' + _esc((inc.type || '').replace(/_/g, ' ')) + '</span>' +
        '<span class="threat-time">' + _timeAgo(inc.timestamp) + '</span>' +
      '</div>' +
      '<div class="threat-title">' + _esc(inc.title || 'Untitled') + '</div>' +
      '<div class="threat-location">' + _esc(inc.corridor || '') + (inc.lat ? ' · ' + Number(inc.lat).toFixed(2) + '°N ' + Number(inc.lon).toFixed(2) + '°E' : '') + '</div>' +
    '</div>';
  }).join('');
}

function renderOverviewFleetStrip(vessels) {
  var el = document.getElementById('overviewFleetStrip');
  if (!el) return;
  var atRisk = vessels.filter(function(v) { return v.riskLevel && v.riskLevel !== 'LOW'; })
    .sort(function(a, b) { return (b.riskScore || 0) - (a.riskScore || 0); });
  if (atRisk.length === 0) {
    el.innerHTML = '<div class="empty-state">All vessels at normal risk</div>';
    return;
  }
  el.innerHTML = atRisk.slice(0, 10).map(function(v) {
    var level = v.riskLevel || 'LOW';
    var scoreColor = { CRITICAL: 'color:var(--red)', HIGH: 'color:#c0392b', ELEVATED: 'color:var(--amber)', LOW: 'color:var(--green)' }[level] || '';
    return '<div class="fleet-strip-item" onclick="openFleetDetail(\'' + _esc(v.imo || v.id) + '\')">' +
      '<div class="fleet-risk-dot ' + _esc(level) + '"></div>' +
      '<div class="fleet-strip-info">' +
        '<div class="fleet-strip-name">' + _esc(v.name || v.vessel_name) + '</div>' +
        '<div class="fleet-strip-detail">' + _esc(v.type || '') + ' · ' + _esc(v.destination || 'N/A') + '</div>' +
      '</div>' +
      '<div class="fleet-strip-score" style="' + scoreColor + '">' + (v.riskScore || '--') + '</div>' +
    '</div>';
  }).join('');
}

// Toggle functions for overview map layers
function toggleOverviewHeatmap(on) {
  if (!overviewMap) return;
  if (on) {
    var headers = _authHeaders();
    fetch('/api/incidents/heatmap?period=90d', { headers: headers })
      .then(_handleAuth)
      .then(function(data) {
        if (overviewHeatLayer) overviewMap.removeLayer(overviewHeatLayer);
        var points = (data && data.points) ? data.points : (Array.isArray(data) ? data.map(function(p) { return [p.lat, p.lon || p.lng, (p.severity || 3) / 5]; }) : []);
        overviewHeatLayer = L.heatLayer(points, { radius: 25, blur: 15, maxZoom: 8, gradient: { 0.2: '#4a9eff', 0.5: '#d4a037', 0.8: '#c0392b', 1.0: '#e05555' } }).addTo(overviewMap);
      }).catch(function() {});
  } else if (overviewHeatLayer) {
    overviewMap.removeLayer(overviewHeatLayer);
    overviewHeatLayer = null;
  }
}
function toggleOverviewJWC(on) { /* Zone overlays handled by zones.js */ }
function toggleOverviewVessels(on) {
  Object.values(overviewMarkers).forEach(function(m) {
    if (on) overviewMap.addLayer(m); else overviewMap.removeLayer(m);
  });
}

// Handle proximity alert broadcast
function handleProximityAlert(data) {
  var banner = document.getElementById('alertBanner');
  var text = document.getElementById('alertBannerText');
  if (!banner || !text) return;
  var msg = Array.isArray(data) ? data[0] : data;
  if (!msg) return;
  text.textContent = (msg.tier || 'ALERT') + ': ' + (msg.vessel_name || 'Vessel') + ' within ' +
    (msg.distance_nm ? msg.distance_nm.toFixed(1) + 'nm' : '--') + ' of ' + (msg.incident_title || 'incident');
  banner.style.display = 'flex';

  document.getElementById('alertBannerDismiss').onclick = function() { banner.style.display = 'none'; };
  document.getElementById('alertBannerAction').onclick = function() { banner.style.display = 'none'; switchView('incidents'); };
}

// Helpers now centralized in utils.js
