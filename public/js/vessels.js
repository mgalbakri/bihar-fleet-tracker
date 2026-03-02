// vessels.js -- Vessel list rendering, search, and filter
// BIHAR Fleet Tracker

function renderList(list) {
    var container = document.getElementById('vesselList');
    container.textContent = '';
    list.forEach(function(v) {
        var maint = v.active ? '' : ' maintenance';
        var totalDef = v.pscInspections.reduce(function(s, i) { return s + i.deficiencies; }, 0);

        var card = document.createElement('div');
        card.className = 'vessel-card ' + v.type + maint + (v.id === selectedId ? ' selected' : '');
        card.setAttribute('data-id', v.id);
        card.onclick = function() { selectVessel(v.id); };

        // Header row
        var header = document.createElement('div');
        header.className = 'vessel-header';

        var headerLeft = document.createElement('div');
        var nameDiv = document.createElement('div');
        nameDiv.className = 'vessel-name';
        nameDiv.textContent = v.name;
        if (!v.active) {
            var maintTag = document.createElement('span');
            maintTag.className = 'maintenance-tag';
            maintTag.textContent = '\ud83d\udd27';
            nameDiv.appendChild(maintTag);
        }
        headerLeft.appendChild(nameDiv);

        var imoDiv = document.createElement('div');
        imoDiv.className = 'vessel-imo';
        imoDiv.textContent = 'IMO: ' + v.imo;
        headerLeft.appendChild(imoDiv);
        header.appendChild(headerLeft);

        var badge = document.createElement('span');
        badge.className = 'vessel-badge ' + v.type;
        badge.textContent = v.typeLabel;
        header.appendChild(badge);
        card.appendChild(header);

        // Location
        var locDiv = document.createElement('div');
        locDiv.className = 'vessel-location';
        locDiv.textContent = '\ud83d\udccd ' + v.location;
        card.appendChild(locDiv);

        // Stats row
        var stats = document.createElement('div');
        stats.className = 'vessel-stats';

        var classBadge = document.createElement('span');
        classBadge.className = 'class-badge';
        classBadge.textContent = v.classAbbr;
        stats.appendChild(classBadge);

        var pscBadge = document.createElement('span');
        if (totalDef === 0) {
            pscBadge.className = 'psc-badge good';
            pscBadge.textContent = '\u2713 PSC';
        } else {
            pscBadge.className = 'psc-badge warn';
            pscBadge.textContent = totalDef + ' def';
        }
        stats.appendChild(pscBadge);

        var valueBadge = document.createElement('span');
        valueBadge.className = 'value-badge';
        valueBadge.textContent = '$' + v.marketValue + 'M';
        stats.appendChild(valueBadge);

        // JWC zone badge (if vessel is in a JWC Listed Area)
        if (v.inJWC && v.jwcZones && v.jwcZones.length > 0) {
            var jwcBadge = document.createElement('span');
            var riskClass = (v.highestRisk || '').toLowerCase();
            jwcBadge.className = 'jwc-badge ' + riskClass;
            jwcBadge.textContent = 'JWC';
            jwcBadge.title = v.jwcZones.map(function(z) { return z.name; }).join(', ');
            stats.appendChild(jwcBadge);
        }

        // AIS health indicator
        if (v.aisHealth && v.aisHealth !== 'UNKNOWN') {
            var aisDot = document.createElement('span');
            aisDot.className = 'ais-health-dot ' + v.aisHealth.toLowerCase();
            aisDot.title = 'AIS: ' + v.aisHealth;
            stats.appendChild(aisDot);
        }

        card.appendChild(stats);
        container.appendChild(card);
    });
    document.getElementById('vesselCount').textContent = list.length;
}

function setupEvents() {
    document.getElementById('searchInput').addEventListener('input', function(e) {
        var q = e.target.value.toLowerCase();
        renderList(vessels.filter(function(v) {
            return v.name.toLowerCase().indexOf(q) > -1 ||
                   v.imo.indexOf(q) > -1 ||
                   v.location.toLowerCase().indexOf(q) > -1 ||
                   v.charterer.toLowerCase().indexOf(q) > -1;
        }));
    });
    document.querySelectorAll('.filter-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });
            this.classList.add('active');
            var f = this.getAttribute('data-filter');
            if (f === 'all') renderList(vessels);
            else if (f === 'maintenance') renderList(vessels.filter(function(v) { return !v.active; }));
            else renderList(vessels.filter(function(v) { return v.type === f; }));
        });
    });
    document.querySelectorAll('.detail-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            activeTab = this.dataset.tab;
            document.querySelectorAll('.detail-tab').forEach(function(t) { t.classList.remove('active'); });
            this.classList.add('active');
            var v = vessels.find(function(x) { return x.id === selectedId; });
            if (v) renderTabContent(v);
        });
    });
}
