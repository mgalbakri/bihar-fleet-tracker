// recommendations.js -- Recommendation display and interaction logic
// BIHAR SENTINEL

function renderRecommendationDetail(rec, container) {
  if (!rec || !container) return;

  var actions = _tryParse(rec.suggested_actions) || [];
  var ports = _tryParse(rec.alternative_ports) || [];

  var html = '<div class="rec-detail">';
  html += '<div class="rec-detail-header">';
  html += '<span class="rec-detail-type ' + _esc(rec.action_type) + '">' + _esc((rec.action_type || '').replace(/_/g, ' ')) + '</span>';
  html += '<span class="rec-urgency ' + _esc(rec.urgency) + '">' + _esc(rec.urgency) + '</span>';
  if (rec.confidence_score) {
    var confClass = rec.confidence_score >= 75 ? 'conf-high' : rec.confidence_score >= 50 ? 'conf-med' : 'conf-low';
    html += '<div class="rec-confidence"><div class="rec-conf-bar"><div class="rec-conf-fill ' + confClass + '" style="width:' + rec.confidence_score + '%"></div></div>';
    html += '<span class="rec-conf-text">' + rec.confidence_score + '%</span></div>';
  }
  html += '</div>';

  html += '<div class="rec-detail-text">' + _esc(rec.recommendation_text || '') + '</div>';

  if (rec.rationale) {
    html += '<div class="rec-detail-rationale">' + _esc(rec.rationale) + '</div>';
  }

  // Action steps
  if (actions.length > 0) {
    html += '<ul class="rec-steps">';
    actions.forEach(function(step) {
      html += '<li>' + _esc(typeof step === 'string' ? step : step.action || step.step || JSON.stringify(step)) + '</li>';
    });
    html += '</ul>';
  }

  // Alternative ports
  if (ports.length > 0) {
    html += '<div class="alt-ports">';
    ports.forEach(function(p) {
      html += '<div class="alt-port">';
      html += '<div class="alt-port-name">' + _esc(p.name || p.port || '') + '</div>';
      if (p.distance_nm) html += '<div class="alt-port-dist">' + Math.round(p.distance_nm) + ' nm</div>';
      if (p.eta_hours) html += '<div class="alt-port-eta">ETA: ' + Math.round(p.eta_hours) + 'h</div>';
      html += '</div>';
    });
    html += '</div>';
  }

  if (rec.estimated_delay_hours) {
    html += '<div style="font-size:11px;color:var(--text-muted);margin-top:8px;font-family:var(--font-mono)">Est. delay: ' + rec.estimated_delay_hours + ' hours</div>';
  }

  // Action buttons
  if (rec.status === 'ACTIVE') {
    html += '<div class="rec-actions">';
    html += '<button class="rec-btn acknowledge" onclick="acknowledgeRec(\'' + _esc(rec.id) + '\')">Acknowledge</button>';
    html += '<button class="rec-btn execute" onclick="executeRec(\'' + _esc(rec.id) + '\')">Execute</button>';
    html += '<button class="rec-btn dismiss" onclick="dismissRec(\'' + _esc(rec.id) + '\')">Dismiss</button>';
    html += '</div>';
  } else {
    html += '<div style="font-size:10px;color:var(--text-muted);margin-top:8px;font-family:var(--font-mono)">Status: ' + _esc(rec.status) + '</div>';
  }

  html += '</div>';
  container.innerHTML += html;
}

function acknowledgeRec(id) {
  _recAction(id, 'acknowledge');
}

function executeRec(id) {
  _recAction(id, 'execute');
}

function dismissRec(id) {
  _recAction(id, 'dismiss');
}

function _recAction(id, action) {
  var headers = _authHeaders();
  headers['Content-Type'] = 'application/json';
  fetch('/api/recommendations/' + id + '/' + action, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ notes: action + ' via UI' })
  }).then(_handleAuth).then(function() {
    if (typeof refreshCurrentView === 'function') refreshCurrentView('recommendations');
  }).catch(function(err) { console.error('[RECS] Action failed:', err); });
}

function fetchVesselRecommendations(imo, container) {
  if (!container) return;
  var headers = _authHeaders();
  fetch('/api/recommendations/vessel/' + imo, { headers: headers })
    .then(_handleAuth)
    .then(function(recs) {
      if (!recs || recs.length === 0) {
        container.innerHTML = '<div class="empty-state">No recommendations for this vessel</div>';
        return;
      }
      container.innerHTML = '';
      recs.forEach(function(r) { renderRecommendationDetail(r, container); });
    })
    .catch(function(err) {
      container.innerHTML = '<div class="empty-state">Failed to load recommendations</div>';
    });
}
