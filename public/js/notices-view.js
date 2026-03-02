// notices-view.js -- Notices management view
// BIHAR SENTINEL

var noticesInitialized = false;
var currentNoticeTab = 'pending';

function initNotices() {
  if (noticesInitialized) return;
  noticesInitialized = true;

  document.querySelectorAll('.ntab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.ntab').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      currentNoticeTab = this.dataset.ntab;
      refreshNotices();
    });
  });

  refreshNotices();
}

function refreshNotices() {
  var headers = _authHeaders();

  if (currentNoticeTab === 'recipients') {
    fetchRecipients();
    return;
  }

  var url = '/api/notices';
  if (currentNoticeTab === 'pending') url = '/api/notices/pending';
  else if (currentNoticeTab === 'sent') url = '/api/notices?status=sent';

  fetch(url, { headers: headers })
    .then(_handleAuth)
    .then(function(data) {
      renderNoticesList(data || []);
      // Update pending count
      if (currentNoticeTab !== 'pending') {
        fetch('/api/notices/pending', { headers: headers }).then(_handleAuth).then(function(p) {
          var badge = document.getElementById('pendingCount');
          if (badge) badge.textContent = (p || []).length;
        }).catch(function() {});
      } else {
        var badge = document.getElementById('pendingCount');
        if (badge) badge.textContent = (data || []).length;
      }
    })
    .catch(function(err) { console.error('[NOTICES] Fetch failed:', err); });
}

function renderNoticesList(notices) {
  var container = document.getElementById('noticesContent');
  if (!container) return;

  if (notices.length === 0) {
    container.innerHTML = '<div class="empty-state">No ' + currentNoticeTab + ' notices</div>';
    return;
  }

  container.innerHTML = notices.map(function(n) {
    var typeClass = (n.type || n.notice_type || '').replace(/ /g, '_');
    return '<div class="notice-card">' +
      '<div class="notice-card-header">' +
        '<div class="notice-card-left">' +
          '<span class="notice-type-badge ' + _esc(typeClass) + '">' + _esc((n.type || n.notice_type || '').replace(/_/g, ' ')) + '</span>' +
          '<span class="notice-vessel">' + _esc(n.vessel_name || n.vessel_imo || '') + '</span>' +
        '</div>' +
        '<span class="notice-time">' + _formatTime(n.generated_at || n.created_at || n.timestamp) + '</span>' +
      '</div>' +
      '<div class="notice-preview">' + _esc(n.trigger_event || n.subject || n.summary || '') + '</div>' +
      renderDeliveryTags(n) +
      renderNoticeActions(n) +
    '</div>';
  }).join('');
}

function renderDeliveryTags(notice) {
  if (!notice.deliveries) return '';
  var deliveries = _tryParse(notice.deliveries) || [];
  if (deliveries.length === 0) return '';
  var html = '<div class="notice-delivery">';
  deliveries.forEach(function(d) {
    var status = d.status || 'queued';
    html += '<span class="delivery-tag ' + _esc(status) + '">' + _esc(d.recipient_name || d.email || '') + ': ' + _esc(status) + '</span>';
  });
  html += '</div>';
  return html;
}

function renderNoticeActions(notice) {
  var status = (notice.status || 'pending').toLowerCase();
  if (status === 'sent' || status === 'dismissed') return '';

  var html = '<div class="notice-actions">';
  if (status === 'pending' || status === 'draft') {
    html += '<button class="notice-btn review" onclick="reviewNotice(\'' + _esc(notice.id) + '\')">Review</button>';
    html += '<button class="notice-btn send" onclick="sendNotice(\'' + _esc(notice.id) + '\')">Send</button>';
    html += '<button class="notice-btn" onclick="dismissNotice(\'' + _esc(notice.id) + '\')">Dismiss</button>';
  }
  html += '</div>';
  return html;
}

function reviewNotice(id) {
  var headers = _authHeaders();
  headers['Content-Type'] = 'application/json';
  fetch('/api/notices/' + id + '/review', { method: 'POST', headers: headers })
    .then(_handleAuth)
    .then(function() { refreshNotices(); })
    .catch(function(err) { console.error('[NOTICES] Review failed:', err); });
}

function sendNotice(id) {
  var headers = _authHeaders();
  headers['Content-Type'] = 'application/json';
  fetch('/api/notices/' + id + '/send', { method: 'POST', headers: headers })
    .then(_handleAuth)
    .then(function() { refreshNotices(); })
    .catch(function(err) { console.error('[NOTICES] Send failed:', err); });
}

function dismissNotice(id) {
  var headers = _authHeaders();
  headers['Content-Type'] = 'application/json';
  fetch('/api/notices/' + id + '/dismiss', { method: 'POST', headers: headers })
    .then(_handleAuth)
    .then(function() { refreshNotices(); })
    .catch(function(err) { console.error('[NOTICES] Dismiss failed:', err); });
}

function fetchRecipients() {
  var headers = _authHeaders();
  fetch('/api/notices/recipients', { headers: headers })
    .then(_handleAuth)
    .then(function(data) {
      renderRecipientsList(data || []);
    })
    .catch(function(err) {
      var container = document.getElementById('noticesContent');
      if (container) container.innerHTML = '<div class="empty-state">Failed to load recipients</div>';
    });
}

function renderRecipientsList(recipients) {
  var container = document.getElementById('noticesContent');
  if (!container) return;

  if (recipients.length === 0) {
    container.innerHTML = '<div class="empty-state">No recipients configured</div>';
    return;
  }

  container.innerHTML = '<div class="recipients-grid">' + recipients.map(function(r) {
    var isActive = r.active !== 0;
    return '<div class="recipient-card">' +
      '<div class="recipient-name">' + _esc(r.name) + '</div>' +
      '<div class="recipient-email">' + _esc(r.email) + '</div>' +
      '<div class="recipient-meta">' +
        '<span class="recipient-role">' + _esc(r.role || '') + '</span>' +
        (r.company ? '<span>' + _esc(r.company) + '</span>' : '') +
        '<span class="recipient-status"><span class="dot ' + (isActive ? 'active' : 'inactive') + '"></span>' + (isActive ? 'Active' : 'Inactive') + '</span>' +
      '</div>' +
    '</div>';
  }).join('') + '</div>';
}
