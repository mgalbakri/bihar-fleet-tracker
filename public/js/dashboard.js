// dashboard.js -- Dashboard view initialization and rendering
// BIHAR SENTINEL

var dashMap = null;
var dashMarkers = [];
var dashboardInitialized = false;

function initDashboard() {
    if (dashboardInitialized) return;
    dashboardInitialized = true;

    dashMap = L.map('dash-map', {
        center: [20, 50],
        zoom: 3,
        zoomControl: false,
        attributionControl: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(dashMap);

    refreshDashboard();
}

function refreshDashboard() {
    var token = sessionStorage.getItem('sentinel_access_token');
    var headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;

    Promise.all([
        fetch('/api/vessels', { headers: headers }).then(function(r) { return r.json(); }),
        fetch('/api/corridors', { headers: headers }).then(function(r) { return r.json(); }),
        fetch('/api/incidents?limit=10', { headers: headers }).then(function(r) { return r.json(); }),
        fetch('/api/alerts', { headers: headers }).then(function(r) { return r.json(); }),
        fetch('/api/news?limit=8', { headers: headers }).then(function(r) { return r.json(); }).catch(function() { return []; })
    ]).then(function(results) {
        var vsl = results[0];
        var corridors = results[1];
        var incidents = results[2];
        var alerts = results[3];
        var news = results[4];

        renderDashStats(vsl, alerts);
        renderDashMap(vsl);
        renderDashCorridors(corridors);
        renderDashIncidents(incidents);
        renderDashAlerts(alerts);
        renderDashNews(news);
    }).catch(function(err) {
        console.error('[Dashboard] Failed to load data:', err);
    });
}

function renderDashStats(vsl, alerts) {
    var active = vsl.filter(function(v) { return v.active; }).length;
    var maint = vsl.length - active;
    var jwc = vsl.filter(function(v) { return v.inJWC; }).length;
    var total = vsl.reduce(function(s, v) { return s + (v.marketValue || 0); }, 0);

    document.getElementById('dash-fleet-count').textContent = vsl.length;
    document.getElementById('dash-active-count').textContent = active;
    document.getElementById('dash-maint-count').textContent = maint;
    document.getElementById('dash-jwc-count').textContent = jwc;
    document.getElementById('dash-alert-count').textContent = alerts.length;
    document.getElementById('dash-total-value').textContent = '$' + total + 'M';
}

function renderDashMap(vsl) {
    dashMarkers.forEach(function(m) { dashMap.removeLayer(m); });
    dashMarkers = [];
    vsl.forEach(function(v) {
        if (!v.lat && !v.lng) return;
        var color = v.active ? getTypeColor(v.type) : '#555568';
        var m = L.circleMarker([v.lat, v.lng], {
            radius: 4,
            fillColor: color,
            color: 'rgba(255,255,255,0.2)',
            weight: 1,
            fillOpacity: 0.8
        }).addTo(dashMap);
        m.bindTooltip(v.name, { direction: 'top', offset: [0, -6] });
        m.on('click', function() { switchView('fleet'); setTimeout(function() { selectVessel(v.id); }, 300); });
        dashMarkers.push(m);
    });
}

function renderDashCorridors(corridors) {
    var container = document.getElementById('dash-corridors');
    container.textContent = '';
    var nameMap = {
        HORMUZ: 'Strait of Hormuz',
        BAB_EL_MANDEB: 'Bab el-Mandeb',
        GULF_OF_ADEN: 'Gulf of Aden',
        SUEZ_APPROACH: 'Suez Approach',
        ARABIAN_SEA: 'Arabian Sea',
        SOMALI_BASIN: 'Somali Basin'
    };
    var colorMap = { GREEN: 'var(--green)', AMBER: 'var(--amber)', RED: 'var(--red)', BLACK: '#e0e0e8' };

    corridors.forEach(function(c) {
        var row = document.createElement('div');
        row.className = 'dash-corridor-row';

        var name = document.createElement('span');
        name.className = 'dash-corridor-name';
        name.textContent = nameMap[c.corridor_id] || c.name || c.corridor_id;
        row.appendChild(name);

        var info = document.createElement('span');
        info.className = 'dash-corridor-info';
        info.textContent = (c.incident_count_7d || 0) + ' inc/7d';
        row.appendChild(info);

        var dot = document.createElement('span');
        dot.className = 'dash-corridor-status';
        dot.style.background = colorMap[c.status] || 'var(--text-muted)';
        row.appendChild(dot);

        container.appendChild(row);
    });

    if (corridors.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'dash-empty';
        empty.textContent = 'No corridor data';
        container.appendChild(empty);
    }
}

function renderDashIncidents(incidents) {
    var container = document.getElementById('dash-incidents');
    container.textContent = '';

    var items = Array.isArray(incidents) ? incidents : [];
    items.slice(0, 8).forEach(function(inc) {
        var row = document.createElement('div');
        row.className = 'dash-incident-row';

        var type = document.createElement('div');
        type.className = 'dash-incident-type';
        type.textContent = (typeof formatIncidentType === 'function') ? formatIncidentType(inc.type) : (inc.type || 'INCIDENT');
        row.appendChild(type);

        var title = document.createElement('div');
        title.className = 'dash-incident-title';
        title.textContent = inc.title || 'Untitled';
        row.appendChild(title);

        var time = document.createElement('div');
        time.className = 'dash-incident-time';
        var timeParts = [];
        if (typeof formatTimeAgo === 'function') timeParts.push(formatTimeAgo(inc.timestamp));
        if (inc.corridor && typeof formatCorridorName === 'function') timeParts.push(formatCorridorName(inc.corridor));
        time.textContent = timeParts.join(' · ');
        row.appendChild(time);

        row.addEventListener('click', function() {
            switchView('threats');
            if (inc.lat && inc.lon) {
                setTimeout(function() {
                    if (czmt.map) czmt.map.setView([inc.lat, inc.lon], 8);
                }, 500);
            }
        });
        container.appendChild(row);
    });

    if (items.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'dash-empty';
        empty.textContent = 'No active incidents';
        container.appendChild(empty);
    }
}

function renderDashAlerts(alerts) {
    var container = document.getElementById('dash-alerts');
    container.textContent = '';

    var items = Array.isArray(alerts) ? alerts : [];
    items.slice(0, 5).forEach(function(a) {
        var row = document.createElement('div');
        row.className = 'dash-alert-row';

        var level = document.createElement('div');
        level.className = 'dash-alert-level';
        level.textContent = (a.alert_level || 'ALERT') + ': ' + (a.vessel_name || 'Unknown');
        row.appendChild(level);

        var desc = document.createElement('div');
        desc.className = 'dash-alert-desc';
        desc.textContent = (a.distance_nm || '?') + 'nm from incident';
        row.appendChild(desc);

        container.appendChild(row);
    });

    if (items.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'dash-empty';
        empty.textContent = 'No active alerts';
        container.appendChild(empty);
    }
}

function renderDashNews(articles) {
    var container = document.getElementById('dash-news');
    if (!container) return;
    container.textContent = '';

    var items = Array.isArray(articles) ? articles : [];
    items.slice(0, 8).forEach(function(art) {
        var row = document.createElement('a');
        row.className = 'dash-news-row';
        row.href = art.link || '#';
        row.target = '_blank';
        row.rel = 'noopener noreferrer';

        var source = document.createElement('div');
        source.className = 'dash-news-source';
        source.textContent = (art.source || 'NEWS').toUpperCase();

        // Color-code by category
        if (art.category === 'regulatory') source.classList.add('regulatory');
        else if (art.category === 'market') source.classList.add('market');

        row.appendChild(source);

        var title = document.createElement('div');
        title.className = 'dash-news-title';
        title.textContent = art.title || 'Untitled';
        row.appendChild(title);

        var time = document.createElement('div');
        time.className = 'dash-news-time';
        time.textContent = formatNewsTime(art.publishedAt);
        row.appendChild(time);

        container.appendChild(row);
    });

    if (items.length === 0) {
        var empty = document.createElement('div');
        empty.className = 'dash-empty';
        empty.textContent = 'Loading maritime news...';
        container.appendChild(empty);
    }
}

function formatNewsTime(isoStr) {
    if (!isoStr) return '';
    var now = new Date();
    var d = new Date(isoStr);
    var diffMs = now - d;
    var diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return diffMin + 'm ago';
    var diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return diffHr + 'h ago';
    var diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return diffDays + 'd ago';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
