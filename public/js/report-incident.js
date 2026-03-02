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

  vessels.forEach(function(v) {
    if (!v.lat || !v.lng) return;
    var color = { CRITICAL: '#e05555', HIGH: '#c0392b', ELEVATED: '#d4a037', LOW: '#3cb371' }[v.riskLevel || 'LOW'] || '#3cb371';
    var m = L.circleMarker([v.lat, v.lng], { radius: 4, fillColor: color, fillOpacity: 0.9, color: color, weight: 1 }).addTo(threatMap);
    m.bindTooltip(_esc(v.name || v.vessel_name), { className: 'sentinel-tooltip' });
    threatMarkers[v.id || v.imo] = m;
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
    threatMap.fitBounds(group.getBounds().pad(0.1));
    if (threatMap.getZoom() < 3) threatMap.setZoom(3);
  }
}

function renderThreatFeedSidebar(incidents) {
  var el = document.getElementById('tmFeed');
  if (!el) return;
  el.innerHTML = incidents.slice(0, 30).map(function(inc) {
    return '<div class="threat-item" onclick="viewIncident(\'' + _esc(inc.id) + '\')">' +
      '<div class="threat-item-header">' +
        '<span class="threat-sev sev-' + (inc.severity || 3) + '"></span>' +
        '<span class="threat-type">' + _esc((inc.type || '').replace(/_/g, ' ')) + '</span>' +
        '<span class="threat-time">' + _timeAgo(inc.timestamp) + '</span>' +
      '</div>' +
      '<div class="threat-title">' + _esc(inc.title || 'Untitled') + '</div>' +
      '<div class="threat-location">' + _esc(inc.corridor || '') + '</div>' +
    '</div>';
  }).join('');
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
