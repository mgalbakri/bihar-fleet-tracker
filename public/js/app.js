// app.js -- Main initialization, view navigation, and refresh orchestration
// BIHAR SENTINEL — Redesigned for Security Operations

// Global state
var vessels = [];
var currentView = 'overview';
var AUTO_REFRESH_MS = 5 * 60 * 1000;
var refreshTimer = null;
var dataSourceStatus = null;

// ========== VIEW NAVIGATION ==========

function switchView(view) {
  // Deactivate all views
  document.querySelectorAll('.view').forEach(function(v) { v.classList.remove('active'); });

  // Update nav buttons (header + mobile tab bar)
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.querySelectorAll('.mtab').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  currentView = view;

  var viewEl = document.getElementById('view-' + view);
  if (viewEl) viewEl.classList.add('active');

  switch (view) {
    case 'overview':
      if (!overviewInitialized) initOverview();
      else { if (overviewMap) overviewMap.invalidateSize(); refreshOverview(); }
      break;

    case 'threatmap':
      if (!threatMapInitialized) initThreatMap();
      else { if (threatMap) threatMap.invalidateSize(); refreshThreatMap(); }
      break;

    case 'incidents':
      if (!incidentsInitialized) initIncidents();
      else refreshIncidents();
      break;

    case 'fleet':
      if (!fleetInitialized) initFleetStatus();
      else refreshFleetStatus();
      break;

    case 'notices':
      if (!noticesInitialized) initNotices();
      else refreshNotices();
      break;

    case 'czmt':
      if (!czmt || !czmt.map) {
        setTimeout(function() { if (typeof initCZMT === 'function') initCZMT(); }, 50);
      } else {
        czmt.map.invalidateSize();
        refreshCZMTData();
      }
      break;
  }
}

// Called by WebSocket handlers to refresh current view
function refreshCurrentView(eventType) {
  switch (currentView) {
    case 'overview':
      refreshOverview();
      break;
    case 'threatmap':
      if (eventType === 'incidents' || eventType === 'positions' || eventType === 'corridors' || eventType === 'manual' || eventType === 'auto') refreshThreatMap();
      break;
    case 'incidents':
      if (eventType === 'incidents' || eventType === 'manual' || eventType === 'auto') refreshIncidents();
      break;
    case 'fleet':
      if (eventType === 'positions' || eventType === 'recommendations' || eventType === 'alerts' || eventType === 'manual' || eventType === 'auto') refreshFleetStatus();
      break;
    case 'notices':
      refreshNotices();
      break;
    case 'czmt':
      if (eventType === 'incidents' || eventType === 'positions' || eventType === 'corridors' || eventType === 'manual' || eventType === 'auto') {
        if (typeof refreshCZMTData === 'function') refreshCZMTData();
      }
      break;
  }
}

// ========== DATA SOURCE STATUS ==========

function fetchDataStatus() {
  fetch('/api/data-status')
    .then(function(r) { return r.json(); })
    .then(function(status) {
      dataSourceStatus = status;
      updateDataStatusIndicator(status);
    })
    .catch(function() {}); // Silently fail (might not be logged in yet)
}

function updateDataStatusIndicator(status) {
  var dot = document.querySelector('.live-dot');
  var label = document.querySelector('.live-indicator .live-mode');
  if (!dot || !label) return;

  if (status.ais.mode === 'simulation') {
    dot.style.background = 'var(--amber, #f59e0b)';
    label.textContent = 'SIMULATION';
    label.style.color = 'var(--amber, #f59e0b)';
  } else {
    dot.style.background = 'var(--green, #22c55e)';
    label.textContent = 'LIVE';
    label.style.color = 'var(--green, #22c55e)';
  }

  // Update source badges using safe DOM methods
  var srcEl = document.getElementById('dataSourceBadges');
  if (srcEl) {
    srcEl.textContent = ''; // Clear existing
    var sources = [
      { label: 'AIS: ' + status.ais.mode.toUpperCase(), live: status.ais.mode === 'live' },
      { label: 'WX: ' + status.weather.mode.toUpperCase(), live: status.weather.mode === 'live' },
      { label: 'THREATS: LIVE', live: true },
      { label: 'NEWS: LIVE', live: true }
    ];
    sources.forEach(function(src) {
      var badge = document.createElement('span');
      badge.className = 'src-badge ' + (src.live ? 'live' : 'sim');
      badge.textContent = src.label;
      srcEl.appendChild(badge);
    });
  }
}

// ========== REFRESH ==========

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(function() {
    console.log('[SENTINEL] Auto-refreshing...');
    refreshCurrentView('auto');
  }, AUTO_REFRESH_MS);
}

function refreshAllData() {
  var btn = document.getElementById('refreshBtn');
  var txt = document.querySelector('.refresh-text');
  if (btn) btn.classList.add('refreshing');
  if (txt) txt.textContent = 'Refreshing...';

  // Tell server to re-poll all external data sources
  var headers = _authHeaders();
  headers['Content-Type'] = 'application/json';

  fetch('/api/refresh', { method: 'POST', headers: headers })
    .then(function(r) {
      if (r.status === 401 || r.status === 403) {
        // Fallback: just refresh the UI from cached data
        refreshCurrentView('manual');
        return null;
      }
      return r.json();
    })
    .then(function(result) {
      if (result) {
        console.log('[SENTINEL] Server refresh complete:', result);
      }
      // Now refresh the current view with fresh data
      refreshCurrentView('manual');
      // Also re-fetch data status in case something changed
      fetchDataStatus();
    })
    .catch(function(err) {
      console.error('[SENTINEL] Refresh error:', err);
      // Fallback: still refresh UI from whatever data exists
      refreshCurrentView('manual');
    })
    .finally(function() {
      if (btn) btn.classList.remove('refreshing');
      if (txt) txt.textContent = 'Refresh';
    });
}

function manualRefresh() {
  refreshAllData();
  startAutoRefresh();
}

// ========== INITIALIZATION ==========

document.addEventListener('DOMContentLoaded', function() {
  // Nav button handlers (header)
  document.querySelectorAll('.nav-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchView(this.dataset.view);
    });
  });

  // Mobile tab bar handlers
  document.querySelectorAll('.mtab').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchView(this.dataset.view);
    });
  });

  // Report incident modal
  if (typeof initReportModal === 'function') initReportModal();

  // Fetch data source status
  fetchDataStatus();

  // Start with overview
  switchView('overview');

  // Live clock
  setInterval(function() {
    var el = document.getElementById('liveTime');
    if (el) el.textContent = new Date().toLocaleTimeString('en-GB');
  }, 1000);

  startAutoRefresh();
  console.log('[SENTINEL] Bihar Sentinel initialized — Security Operations Mode');
});
