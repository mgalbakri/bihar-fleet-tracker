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
