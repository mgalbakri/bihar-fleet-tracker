// CZMT -- Conflict Zone Monitoring Terminal
// Bloomberg-style threat center with corridor bar, alert banner, threat map, and panels

var czmt = {
  active: false,
  map: null,
  incidentMarkers: [],
  vesselMarkers: [],
  proximityRings: [],
  zoneOverlays: [],
  corridors: [],
  incidents: [],
  alerts: [],
  riskScores: {},
  wsInitialized: false,
  heatmapLayer: null,
  heatmapVisible: false,
  heatmapPeriod: '90d',
  feedSortBy: 'recent'
};

function toggleCZMT() {
  czmt.active = !czmt.active;
  var czEl = document.getElementById('czmt');
  var appEl = document.querySelector('.app');
  var statsEl = document.getElementById('statsBar');
  var toggleBtn = document.getElementById('czmt-toggle');

  if (czmt.active) {
    czEl.style.display = 'flex';
    appEl.style.display = 'none';
    statsEl.style.display = 'none';
    toggleBtn.classList.add('active');
    toggleBtn.textContent = '< Fleet Tracker';
    if (!czmt.map) {
      initCZMT();
    } else {
      czmt.map.invalidateSize();
      refreshCZMTData();
    }
  } else {
    czEl.style.display = 'none';
    appEl.style.display = '';
    statsEl.style.display = '';
    toggleBtn.classList.remove('active');
    toggleBtn.textContent = '\u26A0 Threat Center';
    if (window.map) window.map.invalidateSize();
  }
}

function initCZMT() {
  czmt.map = L.map('czmt-map', {
    center: [15, 50],
    zoom: 5,
    zoomControl: true,
    attributionControl: false
  });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(czmt.map);

  loadCZMTZones();

  // Tab switching
  document.querySelectorAll('.czmt-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      document.querySelectorAll('.czmt-tab').forEach(function(t) { t.classList.remove('active'); });
      this.classList.add('active');
      var tabName = this.getAttribute('data-czmt-tab');
      document.getElementById('czmt-feed').style.display = tabName === 'feed' ? '' : 'none';
      document.getElementById('czmt-risk').style.display = tabName === 'risk' ? '' : 'none';
      document.getElementById('czmt-notices').style.display = tabName === 'notices' ? '' : 'none';
      if (tabName === 'notices') refreshNotices();
    });
  });

  // Alert banner buttons
  var viewBtn = document.getElementById('czmt-alert-view');
  if (viewBtn) {
    viewBtn.addEventListener('click', function() {
      if (czmt.alerts.length > 0) {
        var a = czmt.alerts.find(function(x) { return x.alert_level === 'DANGER' || x.alert_level === 'CRITICAL'; });
        if (a && a.incident_lat && a.incident_lon) {
          czmt.map.setView([a.incident_lat, a.incident_lon], 8);
        }
      }
    });
  }
  var dismissBtn = document.getElementById('czmt-alert-dismiss');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', function() {
      document.getElementById('czmt-alert-banner').style.display = 'none';
    });
  }

  // WebSocket auto-refresh
  initCZMTWebSocket();

  refreshCZMTData();
}

function refreshCZMTData() {
  var token = sessionStorage.getItem('sentinel_access_token');
  var headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  Promise.all([
    fetch('/api/corridors', { headers: headers }).then(function(r) { return r.json(); }),
    fetch('/api/incidents', { headers: headers }).then(function(r) { return r.json(); }),
    fetch('/api/alerts', { headers: headers }).then(function(r) { return r.json(); }),
    fetch('/api/vessels', { headers: headers }).then(function(r) { return r.json(); })
  ]).then(function(results) {
    czmt.corridors = results[0];
    czmt.incidents = results[1];
    czmt.alerts = results[2];
    var vessels = results[3];

    renderCorridorBar(czmt.corridors);
    renderAlertBanner(czmt.alerts);
    renderIncidentMarkers(czmt.incidents);
    renderCZMTVesselMarkers(vessels);
    renderThreatFeed(czmt.incidents);
    renderRiskPanel(vessels);
  });
}

// --- Corridor Bar ---
function renderCorridorBar(corridors) {
  var bar = document.getElementById('czmt-corridor-bar');
  bar.textContent = '';

  var nameMap = {
    HORMUZ: 'Hormuz', BAB_EL_MANDEB: 'Bab el-Mandeb',
    GULF_OF_ADEN: 'Gulf of Aden', SUEZ_APPROACH: 'Suez',
    ARABIAN_SEA: 'Arabian Sea', SOMALI_BASIN: 'Somali Basin'
  };

  corridors.forEach(function(c) {
    var card = document.createElement('div');
    card.className = 'corridor-card';

    var header = document.createElement('div');
    header.className = 'corridor-card-header';

    var name = document.createElement('span');
    name.className = 'corridor-card-name';
    name.textContent = nameMap[c.corridor_id] || c.name;
    header.appendChild(name);

    var dot = document.createElement('span');
    dot.className = 'corridor-status-dot ' + c.status;
    header.appendChild(dot);

    card.appendChild(header);

    var stats = document.createElement('div');
    stats.className = 'corridor-card-stats';

    // Incidents stat
    var incSpan = document.createElement('span');
    var incVal = document.createElement('span');
    incVal.className = 'corridor-stat-value';
    incVal.textContent = c.incident_count_7d;
    incSpan.appendChild(incVal);
    incSpan.appendChild(document.createTextNode(' inc/7d'));
    stats.appendChild(incSpan);

    // Vessels stat
    var vesSpan = document.createElement('span');
    var vesVal = document.createElement('span');
    vesVal.className = 'corridor-stat-value';
    vesVal.textContent = c.bihar_vessels_count;
    vesSpan.appendChild(vesVal);
    vesSpan.appendChild(document.createTextNode(' vessels'));
    stats.appendChild(vesSpan);

    // Trend arrow
    var trend = document.createElement('span');
    trend.className = 'corridor-trend ' + (c.trend || 'STABLE');
    var trendText = c.trend === 'WORSENING' ? '\u2191' : c.trend === 'IMPROVING' ? '\u2193' : '\u2194';
    trend.textContent = trendText;
    stats.appendChild(trend);

    card.appendChild(stats);
    bar.appendChild(card);
  });
}

// --- Alert Banner ---
function renderAlertBanner(alerts) {
  var banner = document.getElementById('czmt-alert-banner');
  var critical = alerts.filter(function(a) {
    return a.alert_level === 'DANGER' || a.alert_level === 'CRITICAL';
  });

  if (critical.length === 0) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = 'flex';
  var text = document.getElementById('czmt-alert-text');
  if (critical.length === 1) {
    text.textContent = critical[0].alert_level + ': ' + critical[0].vessel_name + ' within ' + critical[0].distance_nm + 'nm of active incident';
  } else {
    text.textContent = critical.length + ' CRITICAL alerts -- ' + critical.map(function(a) { return a.vessel_name; }).join(', ');
  }
}

// --- Threat Map: Incident Markers ---
function renderIncidentMarkers(incidents) {
  czmt.incidentMarkers.forEach(function(m) { czmt.map.removeLayer(m); });
  czmt.incidentMarkers = [];

  incidents.forEach(function(inc) {
    if (!inc.lat || !inc.lon) return;

    var iconDiv = document.createElement('div');
    iconDiv.className = 'incident-marker severity-' + inc.severity;
    iconDiv.textContent = getIncidentIcon(inc.type);

    var icon = L.divIcon({
      className: 'incident-div-icon',
      html: iconDiv.outerHTML,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    var marker = L.marker([inc.lat, inc.lon], { icon: icon }).addTo(czmt.map);

    // Hover tooltip with key details
    var tooltipContent = document.createElement('div');
    tooltipContent.style.cssText = 'max-width:280px;';

    var tooltipType = document.createElement('div');
    tooltipType.style.cssText = 'font-weight:700;font-size:9px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;color:' + (inc.severity >= 4 ? '#e05555' : inc.severity >= 3 ? '#d4a037' : '#8888a0');
    tooltipType.textContent = formatIncidentType(inc.type) + ' \u2502 SEV ' + inc.severity + '/5';
    tooltipContent.appendChild(tooltipType);

    var tooltipTitle = document.createElement('div');
    tooltipTitle.style.cssText = 'font-weight:600;margin-bottom:4px;font-family:Inter,sans-serif;font-size:12px;color:#e0e0e8;';
    tooltipTitle.textContent = inc.title;
    tooltipContent.appendChild(tooltipTitle);

    var metaParts = [inc.source, formatTimeAgo(inc.timestamp)];
    if (inc.corridor) metaParts.push(formatCorridorName(inc.corridor));
    if (inc.target_vessel) metaParts.push('Target: ' + inc.target_vessel);
    var tooltipMeta = document.createElement('div');
    tooltipMeta.style.cssText = 'color:#8888a0;font-size:10px;';
    tooltipMeta.textContent = metaParts.join(' \u00b7 ');
    tooltipContent.appendChild(tooltipMeta);

    marker.bindTooltip(tooltipContent, {
      direction: 'top',
      offset: [0, -14],
      className: 'incident-tooltip',
      sticky: false
    });

    // Click opens full detail panel
    marker.on('click', function() {
      showIncidentDetail(inc.id);
    });

    czmt.incidentMarkers.push(marker);
  });
}

// --- Incident Detail Panel ---
function showIncidentDetail(incidentId) {
  var token = sessionStorage.getItem('sentinel_access_token');
  var headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  fetch('/api/incidents/' + incidentId, { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      renderIncidentDetailPanel(data);
    })
    .catch(function(err) {
      console.error('[CZMT] Failed to load incident detail:', err);
    });
}

function renderIncidentDetailPanel(incident) {
  var panel = document.getElementById('incident-detail-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'incident-detail-panel';
    panel.className = 'incident-detail-panel';
    document.getElementById('czmt').appendChild(panel);
  }

  panel.textContent = '';
  panel.classList.add('visible');

  // Close button
  var closeBtn = document.createElement('button');
  closeBtn.className = 'incident-detail-close';
  closeBtn.textContent = '\u00d7';
  closeBtn.onclick = function() { panel.classList.remove('visible'); };
  panel.appendChild(closeBtn);

  // Header
  var header = document.createElement('div');
  header.className = 'incident-detail-header';
  var typeBadge = document.createElement('span');
  typeBadge.className = 'feed-type-badge ' + incident.type;
  typeBadge.textContent = formatIncidentType(incident.type);
  header.appendChild(typeBadge);
  var severity = document.createElement('span');
  severity.style.cssText = 'font-family:var(--font-mono);font-weight:700;font-size:12px;color:' + (incident.severity >= 4 ? 'var(--red)' : incident.severity >= 3 ? 'var(--amber)' : 'var(--text-secondary)');
  severity.textContent = 'SEVERITY ' + incident.severity + '/5';
  header.appendChild(severity);
  panel.appendChild(header);

  // Title
  var title = document.createElement('h3');
  title.style.cssText = 'font-size:16px;font-weight:600;margin:12px 0 8px;font-family:var(--font-display);';
  title.textContent = incident.title;
  panel.appendChild(title);

  // Description
  if (incident.description) {
    var desc = document.createElement('p');
    desc.style.cssText = 'font-size:12px;color:var(--text-secondary);line-height:1.5;margin-bottom:14px;';
    desc.textContent = incident.description;
    panel.appendChild(desc);
  }

  // Detail grid
  var fields = [
    { label: 'Source', value: incident.source },
    { label: 'Corridor', value: incident.corridor ? formatCorridorName(incident.corridor) : null },
    { label: 'Time', value: incident.timestamp ? new Date(incident.timestamp).toLocaleString() : null },
    { label: 'Status', value: incident.status },
    { label: 'Location', value: incident.lat ? incident.lat.toFixed(4) + ', ' + incident.lon.toFixed(4) : null },
    { label: 'Verified', value: incident.verified ? 'Yes' : 'Unverified' }
  ];
  if (incident.target_vessel) fields.push({ label: 'Target Vessel', value: incident.target_vessel });
  if (incident.target_imo) fields.push({ label: 'Target IMO', value: incident.target_imo });
  if (incident.target_type) fields.push({ label: 'Target Type', value: incident.target_type });
  if (incident.target_flag) fields.push({ label: 'Target Flag', value: incident.target_flag });
  if (incident.weapon_type) fields.push({ label: 'Weapon Type', value: incident.weapon_type });
  if (incident.attributed_to) fields.push({ label: 'Attributed To', value: incident.attributed_to });
  if (incident.result) fields.push({ label: 'Result', value: incident.result });
  if (incident.source_ref) fields.push({ label: 'Source Ref', value: incident.source_ref });

  var grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px;';
  fields.forEach(function(f) {
    if (!f.value) return;
    var item = document.createElement('div');
    item.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--border);border-radius:4px;padding:8px;';
    var label = document.createElement('div');
    label.style.cssText = 'font-family:var(--font-mono);font-size:8px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;';
    label.textContent = f.label;
    item.appendChild(label);
    var val = document.createElement('div');
    val.style.cssText = 'font-size:12px;font-weight:500;color:var(--text-primary);';
    val.textContent = f.value;
    item.appendChild(val);
    grid.appendChild(item);
  });
  panel.appendChild(grid);

  // Update history
  if (incident.updates && incident.updates.length > 0) {
    var updatesTitle = document.createElement('div');
    updatesTitle.style.cssText = 'font-family:var(--font-mono);font-size:9px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border);';
    updatesTitle.textContent = 'UPDATE HISTORY';
    panel.appendChild(updatesTitle);

    incident.updates.forEach(function(u) {
      var update = document.createElement('div');
      update.style.cssText = 'padding:8px;border-left:2px solid var(--border);margin-bottom:6px;margin-left:4px;';
      var uTime = document.createElement('div');
      uTime.style.cssText = 'font-family:var(--font-mono);font-size:9px;color:var(--text-muted);';
      uTime.textContent = new Date(u.timestamp).toLocaleString() + ' \u00b7 ' + u.source;
      update.appendChild(uTime);
      var uNote = document.createElement('div');
      uNote.style.cssText = 'font-size:11px;color:var(--text-secondary);margin-top:2px;';
      uNote.textContent = u.note;
      update.appendChild(uNote);
      panel.appendChild(update);
    });
  }
}

// --- CZMT Vessel Markers ---
function renderCZMTVesselMarkers(vessels) {
  czmt.vesselMarkers.forEach(function(m) { czmt.map.removeLayer(m); });
  czmt.vesselMarkers = [];
  czmt.proximityRings.forEach(function(r) { czmt.map.removeLayer(r); });
  czmt.proximityRings = [];

  vessels.forEach(function(v) {
    if (!v.lat || !v.lng) return;

    var color = v.inJWC ? '#ff6b6b' : '#64748b';
    var size = v.inJWC ? 8 : 6;

    var marker = L.circleMarker([v.lat, v.lng], {
      radius: size,
      fillColor: color,
      color: '#fff',
      weight: 1,
      fillOpacity: 0.8
    }).addTo(czmt.map);

    var popup = document.createElement('div');
    popup.style.cssText = 'font-family:Inter,sans-serif;font-size:12px;';
    var nameEl = document.createElement('strong');
    nameEl.textContent = v.name;
    popup.appendChild(nameEl);
    var details = document.createElement('div');
    details.style.color = '#999';
    details.textContent = 'IMO: ' + v.imo + ' | Risk: ' + (v.riskLevel || 'LOW');
    popup.appendChild(details);
    if (v.inJWC) {
      var jwcInfo = document.createElement('div');
      jwcInfo.style.color = '#ff6b6b';
      jwcInfo.textContent = 'IN JWC ZONE';
      popup.appendChild(jwcInfo);
    }
    marker.bindPopup(popup);
    czmt.vesselMarkers.push(marker);

    // Proximity rings for JWC vessels (25nm, 50nm, 100nm)
    if (v.inJWC) {
      var rings = [
        { nm: 25, color: '#ef4444', opacity: 0.15 },
        { nm: 50, color: '#f59e0b', opacity: 0.08 },
        { nm: 100, color: '#3b82f6', opacity: 0.05 }
      ];
      rings.forEach(function(ring) {
        var circle = L.circle([v.lat, v.lng], {
          radius: ring.nm * 1852,
          color: ring.color,
          weight: 1,
          dashArray: '3 3',
          fillColor: ring.color,
          fillOpacity: ring.opacity,
          interactive: false
        }).addTo(czmt.map);
        czmt.proximityRings.push(circle);
      });
    }
  });
}

// --- Zone overlays on CZMT map ---
function loadCZMTZones() {
  var token = sessionStorage.getItem('sentinel_access_token');
  var headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  fetch('/api/zones/jwc-zones', { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(geojson) {
      L.geoJSON(geojson, {
        style: function(feature) {
          var risk = feature.properties.riskLevel;
          var opacity = risk === 'CRITICAL' ? 0.2 : 0.1;
          return {
            color: '#ef4444',
            weight: 1,
            dashArray: '4 4',
            fillColor: '#ef4444',
            fillOpacity: opacity
          };
        }
      }).addTo(czmt.map);
    });
}

// --- Threat Feed ---
function renderThreatFeed(incidents) {
  var feed = document.getElementById('czmt-feed');
  feed.textContent = '';

  // Sort controls bar
  var controls = document.createElement('div');
  controls.className = 'feed-controls';

  var sortSelect = document.createElement('select');
  sortSelect.className = 'feed-sort-select';
  sortSelect.id = 'feed-sort';
  var options = [
    { value: 'severity', text: 'Most Severe' },
    { value: 'recent', text: 'Most Recent' },
    { value: 'type', text: 'By Type' }
  ];
  options.forEach(function(opt) {
    var o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.text;
    sortSelect.appendChild(o);
  });
  sortSelect.value = czmt.feedSortBy || 'recent';
  sortSelect.addEventListener('change', function() {
    czmt.feedSortBy = this.value;
    renderThreatFeed(czmt.incidents);
  });
  controls.appendChild(sortSelect);

  var countEl = document.createElement('span');
  countEl.className = 'feed-count';
  countEl.textContent = incidents.length + ' incidents';
  controls.appendChild(countEl);

  feed.appendChild(controls);

  // Sort incidents
  var sortBy = czmt.feedSortBy || 'recent';
  var sorted = incidents.slice();
  if (sortBy === 'severity') {
    sorted.sort(function(a, b) { return (b.severity || 0) - (a.severity || 0); });
  } else if (sortBy === 'recent') {
    sorted.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  } else if (sortBy === 'type') {
    sorted.sort(function(a, b) { return (a.type || '').localeCompare(b.type || ''); });
  }

  if (sorted.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:var(--text-muted);padding:40px;';
    empty.textContent = 'No active incidents';
    feed.appendChild(empty);
    return;
  }

  sorted.forEach(function(inc) {
    feed.appendChild(createFeedItem(inc));
  });
}

function createFeedItem(inc) {
  var item = document.createElement('div');
  item.className = 'feed-item';

  var header = document.createElement('div');
  header.className = 'feed-item-header';

  var badge = document.createElement('span');
  badge.className = 'feed-type-badge ' + inc.type;
  badge.textContent = formatIncidentType(inc.type);
  header.appendChild(badge);

  // Severity badge (always shown)
  var sevBadge = document.createElement('span');
  sevBadge.className = 'feed-severity-badge sev-' + (inc.severity || 3);
  sevBadge.textContent = 'SEV ' + (inc.severity || 3);
  header.appendChild(sevBadge);

  var source = document.createElement('span');
  source.className = 'feed-source';
  source.textContent = inc.source;
  header.appendChild(source);

  item.appendChild(header);

  var title = document.createElement('div');
  title.className = 'feed-title';
  title.textContent = inc.title;
  item.appendChild(title);

  var meta = document.createElement('div');
  meta.className = 'feed-meta';
  if (inc.corridor) {
    var corridor = document.createElement('span');
    corridor.className = 'feed-corridor';
    corridor.textContent = formatCorridorName(inc.corridor);
    meta.appendChild(corridor);
  }
  var time = document.createElement('span');
  time.className = 'feed-time';
  time.textContent = formatTimeAgo(inc.timestamp);
  meta.appendChild(time);
  item.appendChild(meta);

  // Expandable detail section (hidden by default)
  var detail = document.createElement('div');
  detail.className = 'feed-item-detail';
  detail.style.display = 'none';
  item.appendChild(detail);

  // Click handler: toggle inline detail + pan map
  item.addEventListener('click', function(e) {
    // Don't toggle if clicking the full detail button inside
    if (e.target.classList.contains('feed-detail-full-btn')) return;

    var isOpen = detail.style.display !== 'none';

    // Close all other open details
    document.querySelectorAll('.feed-item-detail').forEach(function(d) {
      d.style.display = 'none';
      d.parentElement.classList.remove('expanded');
    });

    if (!isOpen) {
      item.classList.add('expanded');
      detail.style.display = 'block';
      loadFeedItemDetail(inc.id, detail);
      if (inc.lat && inc.lon) {
        czmt.map.setView([inc.lat, inc.lon], 8);
      }
    }
  });

  return item;
}

function loadFeedItemDetail(incidentId, container) {
  var token = sessionStorage.getItem('sentinel_access_token');
  var headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  container.innerHTML = '<div style="color:var(--text-muted);font-size:10px;padding:8px">Loading...</div>';

  fetch('/api/incidents/' + incidentId, { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      container.textContent = '';

      // Description
      if (data.description) {
        var desc = document.createElement('p');
        desc.className = 'feed-detail-desc';
        desc.textContent = data.description;
        container.appendChild(desc);
      }

      // Detail grid
      var fields = [
        { label: 'Time', value: data.timestamp ? new Date(data.timestamp).toLocaleString() : null },
        { label: 'Location', value: data.lat ? data.lat.toFixed(4) + ', ' + data.lon.toFixed(4) : null },
        { label: 'Corridor', value: data.corridor ? formatCorridorName(data.corridor) : null },
        { label: 'Status', value: data.status },
        { label: 'Verified', value: data.verified ? 'Yes' : 'Unverified' },
        { label: 'Source', value: data.source }
      ];
      if (data.target_vessel) fields.push({ label: 'Target', value: data.target_vessel });
      if (data.weapon_type) fields.push({ label: 'Weapon', value: data.weapon_type.replace(/_/g, ' ') });
      if (data.attributed_to) fields.push({ label: 'Attribution', value: data.attributed_to });
      if (data.result) fields.push({ label: 'Result', value: data.result.replace(/_/g, ' ') });

      var grid = document.createElement('div');
      grid.className = 'feed-detail-grid';
      fields.forEach(function(f) {
        if (!f.value) return;
        var row = document.createElement('div');
        row.className = 'feed-detail-item';
        var lbl = document.createElement('span');
        lbl.className = 'feed-detail-label';
        lbl.textContent = f.label;
        row.appendChild(lbl);
        var val = document.createElement('span');
        val.className = 'feed-detail-value';
        val.textContent = f.value;
        row.appendChild(val);
        grid.appendChild(row);
      });
      container.appendChild(grid);

      // Full detail button
      var fullBtn = document.createElement('button');
      fullBtn.className = 'feed-detail-full-btn';
      fullBtn.textContent = 'View Full Detail';
      fullBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        showIncidentDetail(incidentId);
      });
      container.appendChild(fullBtn);
    })
    .catch(function(err) {
      container.innerHTML = '<div style="color:var(--red);font-size:10px;padding:8px">Failed to load detail</div>';
    });
}

// --- Risk Panel ---
function renderRiskPanel(vessels) {
  var panel = document.getElementById('czmt-risk');
  panel.textContent = '';

  var sorted = vessels.slice().sort(function(a, b) {
    return (b.riskScore || 0) - (a.riskScore || 0);
  });

  sorted.forEach(function(v) {
    var card = document.createElement('div');
    card.className = 'risk-card ' + (v.riskLevel || 'LOW');

    var header = document.createElement('div');
    header.className = 'risk-card-header';

    var nameEl = document.createElement('span');
    nameEl.className = 'risk-vessel-name';
    nameEl.textContent = v.name;
    header.appendChild(nameEl);

    var score = document.createElement('span');
    score.className = 'risk-score ' + (v.riskLevel || 'LOW');
    score.textContent = v.riskScore || 0;
    header.appendChild(score);

    card.appendChild(header);

    var info = document.createElement('div');
    info.style.cssText = 'font-size:11px;color:var(--text-muted);margin-bottom:4px;';
    info.textContent = v.location || '';
    if (v.inJWC) {
      var jwc = document.createElement('span');
      jwc.style.cssText = 'color:#ff6b6b;font-weight:600;margin-left:8px;';
      jwc.textContent = 'JWC';
      info.appendChild(jwc);
    }
    card.appendChild(info);

    // Risk factor breakdown bars
    if (v.riskFactors) {
      var factors = document.createElement('div');
      factors.className = 'risk-factors';

      var factorDefs = [
        { key: 'proximity', label: 'Prox', cls: 'proximity' },
        { key: 'corridor', label: 'Corr', cls: 'corridor' },
        { key: 'jwc', label: 'JWC', cls: 'jwc' },
        { key: 'ais', label: 'AIS', cls: 'ais' },
        { key: 'vulnerability', label: 'Vuln', cls: 'vulnerability' },
        { key: 'historical', label: 'Hist', cls: 'historical' }
      ];

      factorDefs.forEach(function(fd) {
        var bar = document.createElement('div');
        bar.className = 'risk-factor-bar';
        bar.title = fd.label + ': ' + Math.round(v.riskFactors[fd.key]);
        var fill = document.createElement('div');
        fill.className = 'risk-factor-fill ' + fd.cls;
        fill.style.width = Math.min(v.riskFactors[fd.key], 100) + '%';
        bar.appendChild(fill);
        factors.appendChild(bar);
      });

      card.appendChild(factors);

      // Legend
      var legend = document.createElement('div');
      legend.className = 'risk-factor-legend';
      var legendItems = [
        { cls: 'proximity', label: 'Proximity' },
        { cls: 'corridor', label: 'Corridor' },
        { cls: 'jwc', label: 'JWC' },
        { cls: 'ais', label: 'AIS' },
        { cls: 'vulnerability', label: 'Vuln' },
        { cls: 'historical', label: 'Hist' }
      ];
      legendItems.forEach(function(li) {
        var span = document.createElement('span');
        var dot = document.createElement('span');
        dot.className = 'risk-legend-dot';
        dot.style.background = getFactorColor(li.cls);
        span.appendChild(dot);
        span.appendChild(document.createTextNode(li.label));
        legend.appendChild(span);
      });
      card.appendChild(legend);
    }

    if (v.lat && v.lng) {
      card.addEventListener('click', function() {
        czmt.map.setView([v.lat, v.lng], 8);
      });
    }

    panel.appendChild(card);
  });
}

// --- Utility ---
function getIncidentIcon(type) {
  var t = (type || '').toUpperCase();
  if (t.includes('MISSILE')) return '\uD83D\uDE80';
  if (t.includes('DRONE')) return '\u2708';
  if (t.includes('PIRACY')) return '\u2620';
  if (t.includes('MINE')) return '\uD83D\uDCA3';
  if (t.includes('SEIZURE')) return '\u26D4';
  if (t.includes('SUSPICIOUS')) return '\u2753';
  return '\u26A0';
}

function formatIncidentType(type) {
  var map = {
    'MISSILE_ATTACK': 'MISSILE', 'missile': 'MISSILE',
    'DRONE_ATTACK': 'DRONE', 'drone': 'DRONE',
    'PIRACY': 'PIRACY', 'MINE_THREAT': 'MINE',
    'SEIZURE': 'SEIZURE',
    'SUSPICIOUS_APPROACH': 'SUSPICIOUS', 'suspicious_approach': 'SUSPICIOUS',
    'MILITARY_ACTION': 'MILITARY',
    'ADVISORY': 'ADVISORY', 'advisory': 'ADVISORY'
  };
  return map[type] || type;
}

function formatCorridorName(id) {
  var map = {
    'HORMUZ': 'Hormuz', 'BAB_EL_MANDEB': 'Bab el-Mandeb',
    'GULF_OF_ADEN': 'Gulf of Aden', 'SUEZ_APPROACH': 'Suez',
    'ARABIAN_SEA': 'Arabian Sea', 'SOMALI_BASIN': 'Somali Basin'
  };
  return map[id] || id;
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return '';
  var diff = Date.now() - new Date(timestamp).getTime();
  var mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  var hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  var days = Math.floor(hours / 24);
  return days + 'd ago';
}

function getFactorColor(cls) {
  var colors = {
    proximity: '#ef4444', corridor: '#f59e0b', jwc: '#fbbf24',
    ais: '#3b82f6', vulnerability: '#a855f7', historical: '#6b7280'
  };
  return colors[cls] || '#6b7280';
}

// --- Notices Panel ---
function refreshNotices() {
  var token = sessionStorage.getItem('sentinel_access_token');
  var headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  fetch('/api/notices?limit=50', { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(notices) {
      renderNotices(notices);
    });
}

function renderNotices(notices) {
  var panel = document.getElementById('czmt-notices');
  panel.textContent = '';

  // Split into pending and sent/dismissed
  var pending = notices.filter(function(n) { return n.status === 'PENDING' || n.status === 'AUTO_QUEUED'; });
  var sent = notices.filter(function(n) { return n.status === 'SENT'; });
  var dismissed = notices.filter(function(n) { return n.status === 'DISMISSED'; });

  if (notices.length === 0) {
    var empty = document.createElement('div');
    empty.style.cssText = 'text-align:center;color:var(--text-muted);padding:40px;';
    empty.textContent = 'No insurer notices generated yet';
    panel.appendChild(empty);
    return;
  }

  // Pending section
  if (pending.length > 0) {
    var pendingHeader = document.createElement('div');
    pendingHeader.className = 'notice-section-header';
    pendingHeader.textContent = 'PENDING REVIEW (' + pending.length + ')';
    panel.appendChild(pendingHeader);

    pending.forEach(function(n) {
      panel.appendChild(createNoticeCard(n, true));
    });
  }

  // Sent section
  if (sent.length > 0) {
    var sentHeader = document.createElement('div');
    sentHeader.className = 'notice-section-header sent';
    sentHeader.textContent = 'SENT (' + sent.length + ')';
    panel.appendChild(sentHeader);

    sent.forEach(function(n) {
      panel.appendChild(createNoticeCard(n, false));
    });
  }

  // Dismissed section
  if (dismissed.length > 0) {
    var dismissedHeader = document.createElement('div');
    dismissedHeader.className = 'notice-section-header dismissed';
    dismissedHeader.textContent = 'DISMISSED (' + dismissed.length + ')';
    panel.appendChild(dismissedHeader);

    dismissed.forEach(function(n) {
      panel.appendChild(createNoticeCard(n, false));
    });
  }
}

function createNoticeCard(notice, showActions) {
  var card = document.createElement('div');
  card.className = 'notice-card ' + notice.status;

  var header = document.createElement('div');
  header.className = 'notice-card-header';

  var typeBadge = document.createElement('span');
  typeBadge.className = 'notice-type-badge ' + notice.notice_type;
  typeBadge.textContent = notice.notice_type.replace('_', ' ');
  header.appendChild(typeBadge);

  var vessel = document.createElement('span');
  vessel.className = 'notice-vessel';
  vessel.textContent = notice.vessel_name;
  header.appendChild(vessel);

  card.appendChild(header);

  var trigger = document.createElement('div');
  trigger.className = 'notice-trigger';
  trigger.textContent = notice.trigger_event;
  card.appendChild(trigger);

  var meta = document.createElement('div');
  meta.className = 'notice-meta';
  var time = document.createElement('span');
  time.textContent = formatTimeAgo(notice.generated_at);
  meta.appendChild(time);
  if (notice.due_by) {
    var due = document.createElement('span');
    due.className = 'notice-due';
    due.textContent = 'Due: ' + notice.due_by;
    meta.appendChild(due);
  }
  card.appendChild(meta);

  if (showActions) {
    var actions = document.createElement('div');
    actions.className = 'notice-actions';

    var sendBtn = document.createElement('button');
    sendBtn.className = 'notice-action-btn send';
    sendBtn.textContent = 'REVIEW & SEND';
    sendBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      sendNotice(notice.id);
    });
    actions.appendChild(sendBtn);

    var dismissBtn = document.createElement('button');
    dismissBtn.className = 'notice-action-btn dismiss';
    dismissBtn.textContent = 'DISMISS';
    dismissBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      dismissNotice(notice.id);
    });
    actions.appendChild(dismissBtn);

    card.appendChild(actions);
  } else if (notice.status === 'SENT') {
    var sentInfo = document.createElement('div');
    sentInfo.className = 'notice-sent-info';
    sentInfo.textContent = 'Sent ' + formatTimeAgo(notice.sent_at);
    card.appendChild(sentInfo);
  }

  return card;
}

function sendNotice(noticeId) {
  var token = sessionStorage.getItem('sentinel_access_token');
  fetch('/api/notices/' + noticeId + '/send', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).then(function() { refreshNotices(); });
}

function dismissNotice(noticeId) {
  var token = sessionStorage.getItem('sentinel_access_token');
  fetch('/api/notices/' + noticeId + '/dismiss', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: 'Dismissed by operator' })
  }).then(function() { refreshNotices(); });
}

// --- WebSocket auto-refresh for CZMT ---
function initCZMTWebSocket() {
  if (czmt.wsInitialized || !window.sentinelWS) return;
  czmt.wsInitialized = true;

  window.sentinelWS.on('positions', function() {
    if (czmt.active) {
      // Re-fetch full vessel data (includes risk scores, zone status)
      var token = sessionStorage.getItem('sentinel_access_token');
      var headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      fetch('/api/vessels', { headers: headers })
        .then(function(r) { return r.json(); })
        .then(function(vessels) {
          renderCZMTVesselMarkers(vessels);
          renderRiskPanel(vessels);
        });
    }
  });

  window.sentinelWS.on('incidents', function(data) {
    if (czmt.active && data && data.length > 0) {
      refreshCZMTData();
    }
  });

  window.sentinelWS.on('proximity_alerts', function(data) {
    if (czmt.active) {
      czmt.alerts = data;
      renderAlertBanner(data);
    }
  });

  window.sentinelWS.on('corridor_status', function(data) {
    if (czmt.active) {
      czmt.corridors = data;
      renderCorridorBar(data);
    }
  });

  window.sentinelWS.on('notice_generated', function(data) {
    if (czmt.active) {
      // Auto-refresh notices panel if it's visible
      var noticesPanel = document.getElementById('czmt-notices');
      if (noticesPanel && noticesPanel.style.display !== 'none') {
        refreshNotices();
      }
      // Flash the notices tab to indicate new notice
      var noticesTab = document.querySelector('[data-czmt-tab="notices"]');
      if (noticesTab && !noticesTab.classList.contains('active')) {
        noticesTab.style.color = '#ff6b6b';
        setTimeout(function() { noticesTab.style.color = ''; }, 3000);
      }
    }
  });
}

// --- Heatmap Layer ---
function toggleHeatmap(enabled) {
  czmt.heatmapVisible = enabled;
  var periodSelect = document.getElementById('heatmap-period');
  if (periodSelect) periodSelect.disabled = !enabled;

  if (enabled) {
    loadHeatmapData(czmt.heatmapPeriod);
  } else if (czmt.heatmapLayer) {
    czmt.map.removeLayer(czmt.heatmapLayer);
    czmt.heatmapLayer = null;
  }
}

function updateHeatmapPeriod(period) {
  czmt.heatmapPeriod = period;
  if (czmt.heatmapVisible) {
    loadHeatmapData(period);
  }
}

function loadHeatmapData(period) {
  if (!czmt.map || !L.heatLayer) return;

  var token = sessionStorage.getItem('sentinel_access_token');
  var headers = {};
  if (token) headers['Authorization'] = 'Bearer ' + token;

  fetch('/api/incidents/heatmap?period=' + period, { headers: headers })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.points || data.points.length === 0) return;

      // Remove existing heatmap layer
      if (czmt.heatmapLayer) {
        czmt.map.removeLayer(czmt.heatmapLayer);
      }

      // Create heatmap layer with Leaflet.heat
      czmt.heatmapLayer = L.heatLayer(data.points, {
        radius: 35,
        blur: 25,
        maxZoom: 10,
        max: 1.0,
        gradient: {
          0.0: 'transparent',
          0.2: '#fef08a',
          0.4: '#fbbf24',
          0.6: '#f59e0b',
          0.8: '#ef4444',
          1.0: '#dc2626'
        }
      }).addTo(czmt.map);
    });
}
