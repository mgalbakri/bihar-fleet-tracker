// report-incident.js -- Report Incident modal logic
// BIHAR SENTINEL

function initReportModal() {
  var btn = document.getElementById('reportIncidentBtn');
  if (btn) btn.addEventListener('click', openReportModal);

  var submit = document.getElementById('submitReport');
  if (submit) submit.addEventListener('click', submitIncidentReport);

  // Close on overlay click
  var overlay = document.getElementById('reportOverlay');
  if (overlay) {
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeReportModal();
    });
  }
}

function openReportModal() {
  var overlay = document.getElementById('reportOverlay');
  if (overlay) overlay.classList.add('open');
}

function closeReportModal() {
  var overlay = document.getElementById('reportOverlay');
  if (overlay) overlay.classList.remove('open');
  // Reset form
  ['reportType', 'reportTitle', 'reportLat', 'reportLon', 'reportCorridor', 'reportDescription'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.value = el.tagName === 'SELECT' ? '' : '';
  });
  var sevEl = document.getElementById('reportSeverity');
  if (sevEl) sevEl.value = '3';
  var srcEl = document.getElementById('reportSource');
  if (srcEl) srcEl.value = 'MANUAL';
}

function submitIncidentReport() {
  var type = (document.getElementById('reportType') || {}).value;
  var severity = (document.getElementById('reportSeverity') || {}).value;
  var title = (document.getElementById('reportTitle') || {}).value;
  var lat = (document.getElementById('reportLat') || {}).value;
  var lon = (document.getElementById('reportLon') || {}).value;
  var corridor = (document.getElementById('reportCorridor') || {}).value;
  var description = (document.getElementById('reportDescription') || {}).value;
  var source = (document.getElementById('reportSource') || {}).value;

  if (!type || !title) {
    alert('Please select an incident type and provide a title.');
    return;
  }

  var body = {
    type: type,
    severity: Number(severity) || 3,
    title: title,
    description: description || null,
    source: source || 'MANUAL',
    corridor: corridor || null
  };
  if (lat) body.lat = Number(lat);
  if (lon) body.lon = Number(lon);

  var headers = _authHeaders();
  headers['Content-Type'] = 'application/json';

  var submitBtn = document.getElementById('submitReport');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

  fetch('/api/incidents', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  })
    .then(_handleAuth)
    .then(function(result) {
      closeReportModal();
      if (typeof refreshCurrentView === 'function') refreshCurrentView('incidents');
    })
    .catch(function(err) {
      console.error('[REPORT] Submit failed:', err);
      alert('Failed to submit incident report. Please try again.');
    })
    .finally(function() {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Incident'; }
    });
}

// Threat map functions (used in threat map view)
var threatMap = null;
var threatMapInitialized = false;
var threatMarkers = {};
var threatIncidentMarkers = [];
var threatJourneyLines = [];
var threatHeatLayer = null;

function initThreatMap() {
  if (threatMapInitialized) return;
  threatMapInitialized = true;

  threatMap = L.map('threat-map', {
    center: [15, 55], zoom: 4, zoomControl: false, attributionControl: false
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 18 }).addTo(threatMap);
  L.control.zoom({ position: 'topright' }).addTo(threatMap);

  if (typeof initZoneOverlays === 'function') initZoneOverlays(threatMap);

  // Force Leaflet to recalculate container size (container was just made visible)
  setTimeout(function() { threatMap.invalidateSize(); }, 150);

  // Threatmap sidebar tabs
  document.querySelectorAll('.tm-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.tm-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      var target = this.dataset.tmTab;
      document.getElementById('tmFeed').style.display = target === 'feed' ? '' : 'none';
      document.getElementById('tmCorridors').style.display = target === 'corridors' ? '' : 'none';
    });
  });

  refreshThreatMap();
}

function refreshThreatMap() {
  if (!threatMap) return;
  var headers = _authHeaders();

  Promise.all([
    fetch('/api/vessels', { headers: headers }).then(_handleAuth),
    fetch('/api/incidents?status=active&limit=100', { headers: headers }).then(_handleAuth),
    fetch('/api/corridors', { headers: headers }).then(_handleAuth).catch(function() { return []; })
  ]).then(function(results) {
    var vessels = results[0] || [];
    var incidents = results[1] || [];
    var corridors = results[2] || [];

    renderThreatMapMarkers(vessels, incidents);
    renderThreatFeedSidebar(incidents);
    renderThreatCorridorsSidebar(corridors);
  }).catch(function(err) { console.error('[THREATMAP] Refresh failed:', err); });
}

function renderThreatMapMarkers(vessels, incidents) {
  Object.values(threatMarkers).forEach(function(m) { threatMap.removeLayer(m); });
  threatMarkers = {};
  threatIncidentMarkers.forEach(function(m) { threatMap.removeLayer(m); });
  threatIncidentMarkers = [];
  threatJourneyLines.forEach(function(l) { threatMap.removeLayer(l); });
  threatJourneyLines = [];

  vessels.forEach(function(v) {
    if (!v.lat || !v.lng) return;
    var riskLevel = v.riskLevel || 'LOW';
    var heading = (v.speed > 0) ? (v.course || v.heading || 0) : 0;
    var m = _createVesselMarker(threatMap, v.lat, v.lng, riskLevel,
      _esc(v.name || v.vessel_name), { heading: heading });
    threatMarkers[v.id || v.imo] = m;

    // Journey line for moving vessels
    if (v.speed > 0 && v.destination) {
      var line = _createJourneyLine(threatMap, v.lat, v.lng, v.destination, RISK_COLORS[riskLevel]);
      if (line) threatJourneyLines.push(line);
    }
  });

  incidents.forEach(function(inc) {
    if (!inc.lat || !inc.lon) return;
    var sevColor = { 5: '#e05555', 4: '#c0392b', 3: '#d4a037', 2: '#4a7dcc', 1: '#555568' }[inc.severity] || '#d4a037';
    var m = L.circleMarker([inc.lat, inc.lon], {
      radius: 7, fillColor: sevColor, fillOpacity: 0.6, color: '#fff', weight: 1.5
    }).addTo(threatMap);
    m.bindPopup('<b>' + _esc(inc.title || inc.type) + '</b><br>Severity: ' + inc.severity + '<br>' + _esc(inc.corridor || ''));
    m.on('click', function() { viewIncident(inc.id); });
    threatIncidentMarkers.push(m);
  });

  // Auto-fit map to show all vessel and incident markers (min zoom 3 for operational focus)
  var allMarkers = Object.values(threatMarkers).concat(threatIncidentMarkers);
  if (allMarkers.length > 0) {
    var group = L.featureGroup(allMarkers);
    threatMap.fitBounds(group.getBounds().pad(0.1), { animate: false, maxZoom: 8 });
    if (threatMap.getZoom() < 3) threatMap.setZoom(3);
  }
}

function renderThreatFeedSidebar(incidents) {
  var el = document.getElementById('tmFeed');
  if (!el) return;
  // Sort: official sources first, then severity, then time
  var sorted = incidents.slice().sort(function(a, b) {
    var ta = _sourceTier(a.source).tier, tb = _sourceTier(b.source).tier;
    if (ta !== tb) return ta - tb;
    if ((b.severity || 0) !== (a.severity || 0)) return (b.severity || 0) - (a.severity || 0);
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  el.textContent = '';
  sorted.slice(0, 30).forEach(function(inc) {
    var item = document.createElement('div');
    item.className = 'threat-item';
    item.onclick = function() { viewIncident(inc.id); };

    var header = document.createElement('div');
    header.className = 'threat-item-header';
    var sev = document.createElement('span');
    sev.className = 'threat-sev sev-' + (inc.severity || 3);
    header.appendChild(sev);

    var badge = document.createElement('span');
    var tier = _sourceTier(inc.source);
    badge.className = 'source-tier-badge tier-' + tier.tier;
    badge.style.cssText = 'font-size:8px;font-family:var(--font-mono);letter-spacing:0.5px;padding:1px 4px;border-radius:2px;border:1px solid ' + tier.color + ';color:' + tier.color + ';white-space:nowrap;';
    badge.textContent = tier.label;
    header.appendChild(badge);

    var typeEl = document.createElement('span');
    typeEl.className = 'threat-type';
    typeEl.textContent = (inc.type || '').replace(/_/g, ' ');
    header.appendChild(typeEl);
    var timeEl = document.createElement('span');
    timeEl.className = 'threat-time';
    timeEl.textContent = _timeAgo(inc.timestamp);
    header.appendChild(timeEl);
    item.appendChild(header);

    var title = document.createElement('div');
    title.className = 'threat-title';
    title.textContent = inc.title || 'Untitled';
    item.appendChild(title);

    var loc = document.createElement('div');
    loc.className = 'threat-location';
    loc.textContent = inc.corridor || '';
    item.appendChild(loc);

    el.appendChild(item);
  });
}

function renderThreatCorridorsSidebar(corridors) {
  var el = document.getElementById('tmCorridors');
  if (!el) return;
  el.innerHTML = corridors.map(function(c) {
    return '<div class="corridor-card">' +
      '<div class="corridor-name">' + _esc((c.name || c.corridor_id || '').replace(/_/g, ' ')) + '</div>' +
      '<div class="corridor-status ' + _esc(c.status) + '">' + _esc(c.status) + '</div>' +
      '<div class="corridor-incidents">' + (c.incident_count_7d || 0) + ' incidents (7d)</div>' +
    '</div>';
  }).join('');
}

function toggleThreatHeatmap(on) {
  if (!threatMap) return;
  if (on) {
    fetch('/api/incidents/heatmap?period=30d', { headers: _authHeaders() }).then(_handleAuth).then(function(data) {
      if (threatHeatLayer) threatMap.removeLayer(threatHeatLayer);
      var pts = (data && data.points) ? data.points : [];
      threatHeatLayer = L.heatLayer(pts, { radius: 25, blur: 15 }).addTo(threatMap);
    }).catch(function() {});
  } else if (threatHeatLayer) { threatMap.removeLayer(threatHeatLayer); threatHeatLayer = null; }
}
function toggleThreatJWC(on) { /* handled by zone overlays */ }
function toggleThreatVessels(on) {
  Object.values(threatMarkers).forEach(function(m) { if (on) threatMap.addLayer(m); else threatMap.removeLayer(m); });
}
function toggleThreatIncidents(on) {
  threatIncidentMarkers.forEach(function(m) { if (on) threatMap.addLayer(m); else threatMap.removeLayer(m); });
}
function updateThreatPeriod(val) { refreshThreatMap(); }
