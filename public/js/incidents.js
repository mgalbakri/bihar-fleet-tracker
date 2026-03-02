// incidents.js -- Incidents table view with filtering, sorting, and detail panel
// BIHAR SENTINEL

var incidentsData = [];
var incidentSort = { field: 'timestamp', dir: 'desc' };
var incidentsInitialized = false;

function initIncidents() {
  if (incidentsInitialized) return;
  incidentsInitialized = true;

  // Setup sort handlers
  document.querySelectorAll('.incidents-table th[data-sort]').forEach(function(th) {
    th.addEventListener('click', function() {
      var field = this.dataset.sort;
      if (incidentSort.field === field) {
        incidentSort.dir = incidentSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        incidentSort.field = field;
        incidentSort.dir = 'desc';
      }
      document.querySelectorAll('.incidents-table th').forEach(function(h) {
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      this.classList.add('sorted-' + incidentSort.dir);
      renderIncidentsTable();
    });
  });

  // Filter handlers
  ['incSearch', 'incTypeFilter', 'incStatusFilter', 'incCorridorFilter', 'incSeverityFilter'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(id === 'incSearch' ? 'input' : 'change', renderIncidentsTable);
  });

  // Export handler
  var exportBtn = document.getElementById('exportIncidents');
  if (exportBtn) exportBtn.addEventListener('click', exportIncidentsCSV);

  refreshIncidents();
}

function refreshIncidents() {
  var headers = _authHeaders();
  fetch('/api/incidents?limit=200', { headers: headers })
    .then(_handleAuth)
    .then(function(data) {
      incidentsData = data || [];
      populateCorridorFilter(incidentsData);
      renderIncidentsTable();
    })
    .catch(function(err) { console.error('[INCIDENTS] Fetch failed:', err); });
}

function populateCorridorFilter(incidents) {
  var filter = document.getElementById('incCorridorFilter');
  if (!filter) return;
  var corridors = {};
  incidents.forEach(function(inc) { if (inc.corridor) corridors[inc.corridor] = true; });
  var opts = '<option value="">All Corridors</option>';
  Object.keys(corridors).sort().forEach(function(c) {
    opts += '<option value="' + _esc(c) + '">' + _esc(c.replace(/_/g, ' ')) + '</option>';
  });
  filter.innerHTML = opts;
}

function getFilteredIncidents() {
  var search = (document.getElementById('incSearch') || {}).value || '';
  var typeF = (document.getElementById('incTypeFilter') || {}).value || '';
  var statusF = (document.getElementById('incStatusFilter') || {}).value || '';
  var corridorF = (document.getElementById('incCorridorFilter') || {}).value || '';
  var sevF = (document.getElementById('incSeverityFilter') || {}).value || '';
  search = search.toLowerCase();

  var filtered = incidentsData.filter(function(inc) {
    if (typeF && inc.type !== typeF) return false;
    if (statusF && inc.status !== statusF) return false;
    if (corridorF && inc.corridor !== corridorF) return false;
    if (sevF && String(inc.severity) !== sevF) return false;
    if (search) {
      var haystack = ((inc.title || '') + ' ' + (inc.type || '') + ' ' + (inc.corridor || '') + ' ' + (inc.source || '')).toLowerCase();
      if (haystack.indexOf(search) === -1) return false;
    }
    return true;
  });

  // Sort
  filtered.sort(function(a, b) {
    var va = a[incidentSort.field], vb = b[incidentSort.field];
    if (incidentSort.field === 'severity') { va = Number(va) || 0; vb = Number(vb) || 0; }
    if (incidentSort.field === 'timestamp') { va = new Date(va || 0).getTime(); vb = new Date(vb || 0).getTime(); }
    if (va < vb) return incidentSort.dir === 'asc' ? -1 : 1;
    if (va > vb) return incidentSort.dir === 'asc' ? 1 : -1;
    return 0;
  });

  return filtered;
}

function renderIncidentsTable() {
  var filtered = getFilteredIncidents();
  var countEl = document.getElementById('incidentCount');
  if (countEl) countEl.textContent = filtered.length + ' incidents';

  var body = document.getElementById('incidentsBody');
  if (!body) return;

  body.innerHTML = filtered.map(function(inc) {
    var confScore = inc.confidence_score || 0;
    var confClass = confScore >= 75 ? 'conf-high' : confScore >= 50 ? 'conf-med' : 'conf-low';
    return '<tr data-id="' + _esc(inc.id) + '" onclick="openIncidentDetail(\'' + _esc(inc.id) + '\')">' +
      '<td><span class="sev-badge sev-' + (inc.severity || 3) + '">' + (inc.severity || '?') + '</span></td>' +
      '<td><span class="type-tag ' + _esc(inc.type) + '">' + _esc((inc.type || '').replace(/_/g, ' ')) + '</span></td>' +
      '<td>' + _esc(inc.title || 'Untitled') + '</td>' +
      '<td>' + _esc((inc.corridor || '').replace(/_/g, ' ')) + '</td>' +
      '<td style="font-family:var(--font-mono);font-size:10px">' + _formatTime(inc.timestamp) + '</td>' +
      '<td><span class="status-tag ' + _esc(inc.status) + '">' + _esc(inc.status || '') + '</span></td>' +
      '<td><div class="conf-bar"><div class="conf-fill ' + confClass + '" style="width:' + confScore + '%"></div></div>' + confScore + '%</td>' +
      '<td><button class="btn-secondary" onclick="event.stopPropagation();openIncidentDetail(\'' + _esc(inc.id) + '\')">Detail</button></td>' +
    '</tr>';
  }).join('');
}

function openIncidentDetail(id) {
  var panel = document.getElementById('incidentDetailPanel');
  if (!panel) return;

  // Highlight selected row
  document.querySelectorAll('.incidents-table tr.selected').forEach(function(r) { r.classList.remove('selected'); });
  var row = document.querySelector('.incidents-table tr[data-id="' + id + '"]');
  if (row) row.classList.add('selected');

  var headers = _authHeaders();
  fetch('/api/incidents/' + id, { headers: headers })
    .then(_handleAuth)
    .then(function(data) {
      renderIncidentDetailPanel(data);
      panel.classList.add('open');
    })
    .catch(function(err) { console.error('[INCIDENTS] Detail failed:', err); });
}

function renderIncidentDetailPanel(inc) {
  var title = document.getElementById('idpTitle');
  var body = document.getElementById('idpBody');
  if (title) title.textContent = inc.title || 'Incident Detail';
  if (!body) return;

  var updates = inc.updates || [];
  var html = '';

  // Overview section
  html += '<div class="idp-section"><div class="idp-section-title">Overview</div>';
  html += _field('Type', '<span class="type-tag ' + _esc(inc.type) + '">' + _esc((inc.type || '').replace(/_/g, ' ')) + '</span>');
  html += _field('Severity', '<span class="sev-badge sev-' + (inc.severity || 3) + '">' + (inc.severity || '?') + '</span>');
  html += _field('Status', '<span class="status-tag ' + _esc(inc.status) + '">' + _esc(inc.status) + '</span>');
  html += _field('Corridor', _esc((inc.corridor || '').replace(/_/g, ' ')));
  html += _field('Source', _esc(inc.source || ''));
  if (inc.source_reliability) html += _field('Source Reliability', _esc(inc.source_reliability));
  if (inc.confidence_score) html += _field('Confidence', inc.confidence_score + '%');
  if (inc.escalation_potential) html += _field('Escalation', _esc(inc.escalation_potential));
  html += _field('Position', inc.lat ? Number(inc.lat).toFixed(4) + '°N, ' + Number(inc.lon).toFixed(4) + '°E' : '--');
  html += _field('Reported', _formatTime(inc.timestamp));
  html += '</div>';

  // Description
  if (inc.description) {
    html += '<div class="idp-section"><div class="idp-section-title">Description</div>';
    html += '<p style="font-size:12px;color:var(--text-secondary);line-height:1.5">' + _esc(inc.description) + '</p></div>';
  }

  // Enrichment details
  if (inc.impact_area || inc.recommended_clearance_nm) {
    html += '<div class="idp-section"><div class="idp-section-title">Enrichment</div>';
    if (inc.impact_area) html += _field('Impact Area', _esc(inc.impact_area));
    if (inc.recommended_clearance_nm) html += _field('Rec. Clearance', inc.recommended_clearance_nm + ' nm');
    if (inc.impact_radius_nm) html += _field('Impact Radius', inc.impact_radius_nm + ' nm');
    if (inc.attack_method) html += _field('Attack Method', _esc(inc.attack_method));
    html += '</div>';
  }

  // Lifecycle / Updates
  if (updates.length > 0) {
    html += '<div class="idp-section"><div class="idp-section-title">Timeline</div>';
    html += '<div class="lifecycle-timeline">';
    updates.forEach(function(u, i) {
      var isLast = i === updates.length - 1;
      html += '<div class="lifecycle-step">' +
        '<div class="lifecycle-dot ' + (isLast ? 'active' : 'completed') + '"></div>' +
        (isLast ? '' : '<div class="lifecycle-line"></div>') +
        '<div class="lifecycle-info">' +
          '<div class="lifecycle-status">' + _esc(u.new_status || u.update_type || 'Update') + '</div>' +
          '<div class="lifecycle-time">' + _formatTime(u.timestamp || u.created_at) + (u.user_name ? ' by ' + _esc(u.user_name) : '') + '</div>' +
          (u.notes ? '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px">' + _esc(u.notes) + '</div>' : '') +
        '</div></div>';
    });
    html += '</div></div>';
  }

  // Actions
  html += '<div class="idp-section"><div class="idp-section-title">Actions</div>';
  html += '<div class="idp-actions">';
  if (inc.status === 'active') {
    html += '<button onclick="transitionIncident(\'' + inc.id + '\',\'INVESTIGATING\')">Investigate</button>';
    html += '<button onclick="transitionIncident(\'' + inc.id + '\',\'CONFIRMED\')" class="primary">Confirm</button>';
    html += '<button onclick="transitionIncident(\'' + inc.id + '\',\'RESOLVED\')">Resolve</button>';
  } else if (inc.status === 'monitoring') {
    html += '<button onclick="transitionIncident(\'' + inc.id + '\',\'RESOLVED\')" class="primary">Resolve</button>';
  }
  html += '</div></div>';

  body.innerHTML = html;
}

function closeIncidentDetail() {
  var panel = document.getElementById('incidentDetailPanel');
  if (panel) panel.classList.remove('open');
  document.querySelectorAll('.incidents-table tr.selected').forEach(function(r) { r.classList.remove('selected'); });
}

function transitionIncident(id, newStatus) {
  var headers = _authHeaders();
  headers['Content-Type'] = 'application/json';
  fetch('/api/incidents/' + id + '/status', {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify({ status: newStatus === 'RESOLVED' ? 'resolved' : newStatus === 'INVESTIGATING' ? 'monitoring' : 'active' })
  }).then(_handleAuth).then(function() {
    refreshIncidents();
    openIncidentDetail(id);
  }).catch(function(err) { console.error('[INCIDENTS] Transition failed:', err); });
}

function viewIncident(id) {
  switchView('incidents');
  setTimeout(function() { openIncidentDetail(id); }, 200);
}

function exportIncidentsCSV() {
  var filtered = getFilteredIncidents();
  var csv = 'Severity,Type,Title,Corridor,Time,Status,Confidence,Lat,Lon\n';
  filtered.forEach(function(inc) {
    csv += [inc.severity, inc.type, '"' + (inc.title || '').replace(/"/g, '""') + '"',
      inc.corridor, inc.timestamp, inc.status, inc.confidence_score || '',
      inc.lat || '', inc.lon || ''].join(',') + '\n';
  });
  var blob = new Blob([csv], { type: 'text/csv' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'incidents_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
}

function _field(label, value) {
  return '<div class="idp-field"><span class="idp-field-label">' + label + '</span><span class="idp-field-value">' + value + '</span></div>';
}

// _formatTime now centralized in utils.js
