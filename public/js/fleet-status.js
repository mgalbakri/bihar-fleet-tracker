// fleet-status.js -- Fleet Status view with vessel cards and detail panel
// BIHAR SENTINEL

var fleetInitialized = false;

function initFleetStatus() {
  if (fleetInitialized) return;
  fleetInitialized = true;

  ['fleetSearch', 'fleetRiskFilter', 'fleetTypeFilter', 'fleetSortBy'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(id === 'fleetSearch' ? 'input' : 'change', renderFleetGrid);
  });

  refreshFleetStatus();
}

function refreshFleetStatus() {
  var headers = _authHeaders();
  fetch('/api/vessels', { headers: headers })
    .then(_handleAuth)
    .then(function(data) {
      window.vessels = data || [];
      renderFleetGrid();
    })
    .catch(function(err) { console.error('[FLEET] Fetch failed:', err); });
}

function renderFleetGrid() {
  var vessels = window.vessels || [];
  var search = (document.getElementById('fleetSearch') || {}).value || '';
  var riskF = (document.getElementById('fleetRiskFilter') || {}).value || '';
  var typeF = (document.getElementById('fleetTypeFilter') || {}).value || '';
  var sortBy = (document.getElementById('fleetSortBy') || {}).value || 'risk';
  search = search.toLowerCase();

  var filtered = vessels.filter(function(v) {
    if (riskF && v.riskLevel !== riskF) return false;
    if (typeF && v.type !== typeF) return false;
    if (search) {
      var hay = ((v.name || '') + ' ' + (v.vessel_name || '') + ' ' + (v.imo || '') + ' ' + (v.destination || '')).toLowerCase();
      if (hay.indexOf(search) === -1) return false;
    }
    return true;
  });

  // Sort
  filtered.sort(function(a, b) {
    if (sortBy === 'risk') return (b.riskScore || 0) - (a.riskScore || 0);
    if (sortBy === 'name') return (a.name || a.vessel_name || '').localeCompare(b.name || b.vessel_name || '');
    if (sortBy === 'jwc') return (b.inJWC ? 1 : 0) - (a.inJWC ? 1 : 0);
    return 0;
  });

  // Summary
  var summary = document.getElementById('fleetSummary');
  if (summary) {
    var counts = { CRITICAL: 0, HIGH: 0, ELEVATED: 0, LOW: 0 };
    vessels.forEach(function(v) { var l = v.riskLevel || 'LOW'; if (counts[l] !== undefined) counts[l]++; });
    summary.innerHTML =
      '<div class="fleet-summary-stat"><div class="dot" style="background:var(--red)"></div><span style="color:var(--red)">' + counts.CRITICAL + '</span> Critical</div>' +
      '<div class="fleet-summary-stat"><div class="dot" style="background:#c0392b"></div><span style="color:#c0392b">' + counts.HIGH + '</span> High</div>' +
      '<div class="fleet-summary-stat"><div class="dot" style="background:var(--amber)"></div><span style="color:var(--amber)">' + counts.ELEVATED + '</span> Elevated</div>' +
      '<div class="fleet-summary-stat"><div class="dot" style="background:var(--green)"></div><span style="color:var(--green)">' + counts.LOW + '</span> Low</div>';
  }

  // Grid
  var grid = document.getElementById('fleetGrid');
  if (!grid) return;

  grid.innerHTML = filtered.map(function(v) {
    var level = v.riskLevel || 'LOW';
    var badges = '';
    if (v.inJWC) badges += '<span class="vc-badge jwc">JWC</span>';
    if (v.activeAlerts) badges += '<span class="vc-badge alert">ALERT</span>';
    if (v.aisGap) badges += '<span class="vc-badge ais-gap">AIS GAP</span>';
    if (v.hasRecommendation) badges += '<span class="vc-badge rec">REC</span>';

    return '<div class="vessel-card risk-' + _esc(level) + '" onclick="openFleetDetail(\'' + _esc(v.imo || v.id) + '\')">' +
      '<div class="vc-header">' +
        '<div><div class="vc-name">' + _esc(v.name || v.vessel_name) + '</div><div class="vc-type">' + _esc(v.type || '') + ' · IMO ' + _esc(v.imo || '') + '</div></div>' +
        '<div class="vc-risk-score ' + _esc(level) + '">' + (v.riskScore || '--') + '</div>' +
      '</div>' +
      '<div class="vc-details">' +
        '<div class="vc-field"><div class="vc-field-label">Position</div><div class="vc-field-value">' + (v.lat ? Number(v.lat).toFixed(2) + '°N ' + Number(v.lng).toFixed(2) + '°E' : 'N/A') + '</div></div>' +
        '<div class="vc-field"><div class="vc-field-label">Dest</div><div class="vc-field-value">' + _esc(v.destination || 'N/A') + '</div></div>' +
        '<div class="vc-field"><div class="vc-field-label">Speed</div><div class="vc-field-value">' + (v.speed != null ? v.speed + ' kn' : '--') + '</div></div>' +
        '<div class="vc-field"><div class="vc-field-label">Flag</div><div class="vc-field-value">' + _esc(v.flag || '') + '</div></div>' +
      '</div>' +
      (badges ? '<div class="vc-badges">' + badges + '</div>' : '') +
    '</div>';
  }).join('');
}

function openFleetDetail(imo) {
  var panel = document.getElementById('fleetDetailPanel');
  if (!panel) return;

  var headers = _authHeaders();
  Promise.all([
    fetch('/api/vessels', { headers: headers }).then(_handleAuth),
    fetch('/api/recommendations/vessel/' + imo, { headers: headers }).then(_handleAuth).catch(function() { return []; }),
    fetch('/api/alerts?vessel_imo=' + imo + '&active=true', { headers: headers }).then(_handleAuth).catch(function() { return []; })
  ]).then(function(results) {
    var allVessels = results[0] || [];
    var recs = results[1] || [];
    var alerts = results[2] || [];
    var vessel = allVessels.find(function(v) { return v.imo === imo || v.id === imo; });
    if (!vessel) { console.error('[FLEET] Vessel not found:', imo); return; }
    renderFleetDetailPanel(vessel, recs, alerts);
    panel.classList.add('open');
  }).catch(function(err) { console.error('[FLEET] Detail failed:', err); });
}

function renderFleetDetailPanel(vessel, recs, alerts) {
  var title = document.getElementById('fdpTitle');
  var body = document.getElementById('fdpBody');
  if (title) title.textContent = vessel.name || vessel.vessel_name;
  if (!body) return;

  var level = vessel.riskLevel || 'LOW';
  var html = '';

  // Risk Score
  html += '<div class="fdp-section"><div class="fdp-section-title">Risk Assessment</div>';
  html += '<div style="text-align:center;margin:8px 0"><span class="vc-risk-score ' + _esc(level) + '" style="font-size:32px">' + (vessel.riskScore || '--') + '</span>';
  html += '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">Risk Level: <strong style="color:var(--text-primary)">' + _esc(level) + '</strong></div></div>';

  // Risk breakdown
  if (vessel.riskFactors) {
    html += '<div class="risk-breakdown">';
    var factors = vessel.riskFactors;
    ['proximity', 'corridor', 'jwc', 'ais', 'vulnerability', 'historical'].forEach(function(f) {
      var val = factors[f] || 0;
      var pct = Math.min(100, Math.round(val));
      var barColor = pct >= 70 ? 'var(--red)' : pct >= 40 ? 'var(--amber)' : 'var(--green)';
      html += '<div class="risk-factor"><div class="risk-factor-name">' + f.toUpperCase() + '</div>';
      html += '<div class="risk-factor-value" style="color:' + barColor + '">' + pct + '</div>';
      html += '<div class="risk-factor-bar"><div class="risk-factor-fill" style="width:' + pct + '%;background:' + barColor + '"></div></div></div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // Position
  html += '<div class="fdp-section"><div class="fdp-section-title">Position</div>';
  html += _fdpField('Lat/Lon', vessel.lat ? Number(vessel.lat).toFixed(4) + '°N, ' + Number(vessel.lng).toFixed(4) + '°E' : 'N/A');
  html += _fdpField('Speed', (vessel.speed != null ? vessel.speed + ' kn' : '--'));
  html += _fdpField('Course', (vessel.course != null ? vessel.course + '°' : '--'));
  html += _fdpField('Destination', vessel.destination || 'N/A');
  html += _fdpField('ETA', vessel.eta || '--');
  html += _fdpField('Flag', vessel.flag || '--');
  html += _fdpField('DWT', vessel.dwt || '--');
  html += '</div>';

  // Recommendations
  html += '<div class="fdp-section"><div class="fdp-section-title">Recommendations (' + recs.length + ')</div>';
  html += '<div id="fdpRecs"></div></div>';

  // Alerts
  if (alerts.length > 0) {
    html += '<div class="fdp-section"><div class="fdp-section-title">Active Alerts</div>';
    alerts.forEach(function(a) {
      html += '<div class="alert-card"><div class="alert-severity ' + _esc(a.tier || 'WATCH') + '"></div>';
      html += '<div class="alert-info"><div class="alert-title">' + _esc(a.incident_title || a.incident_type || '') + '</div>';
      html += '<div class="alert-sub">' + (a.distance_nm ? a.distance_nm.toFixed(1) + ' nm' : '') + '</div></div></div>';
    });
    html += '</div>';
  }

  body.innerHTML = html;

  // Render recommendations into container
  var recsContainer = document.getElementById('fdpRecs');
  if (recsContainer && recs.length > 0) {
    recs.forEach(function(r) { renderRecommendationDetail(r, recsContainer); });
  } else if (recsContainer) {
    recsContainer.innerHTML = '<div class="empty-state">No active recommendations</div>';
  }
}

function closeFleetDetail() {
  var panel = document.getElementById('fleetDetailPanel');
  if (panel) panel.classList.remove('open');
}

function _fdpField(label, value) {
  return '<div class="fdp-field"><span class="fdp-field-label">' + label + '</span><span class="fdp-field-value">' + _esc(String(value)) + '</span></div>';
}
