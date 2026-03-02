// market.js -- Market Intelligence modal
// BIHAR Fleet Tracker

function openMarketModal() {
    document.getElementById('marketTime').textContent = 'Updated: ' + new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

    var marketBody = document.getElementById('marketBody');
    marketBody.textContent = '';

    var indicativeLabel = SIMULATED ? ' (INDICATIVE)' : '';

    // Main grid
    var grid = document.createElement('div');
    grid.className = 'market-grid';

    // LEFT COLUMN
    var leftCol = document.createElement('div');
    leftCol.style.cssText = 'display:flex;flex-direction:column;gap:16px';

    // Charter Rates section
    var ratesSec = document.createElement('div');
    ratesSec.className = 'market-section';
    var ratesHeader = document.createElement('div');
    ratesHeader.className = 'market-section-header';
    var ratesTitle = document.createElement('div');
    ratesTitle.className = 'market-section-title';
    ratesTitle.textContent = '\ud83d\udcca Charter Rates ($/day)' + indicativeLabel;
    ratesHeader.appendChild(ratesTitle);
    var ratesSource = document.createElement('div');
    ratesSource.className = 'market-section-source';
    ratesSource.textContent = 'Baltic Exchange';
    ratesHeader.appendChild(ratesSource);
    ratesSec.appendChild(ratesHeader);

    var ratesNote = document.createElement('p');
    ratesNote.style.cssText = 'font-size:10px;color:var(--text-muted);margin-bottom:12px';
    ratesNote.textContent = 'TC = Time Charter | Spot = Voyage Equivalent';
    ratesSec.appendChild(ratesNote);

    liveData.charterRates.forEach(function(r) {
        var row = document.createElement('div');
        row.className = 'rate-row';

        var typeDiv = document.createElement('div');
        typeDiv.className = 'rate-type';
        var typeName = document.createElement('strong');
        typeName.textContent = r.type;
        typeDiv.appendChild(typeName);
        typeDiv.appendChild(document.createElement('br'));
        var typeSize = document.createElement('span');
        typeSize.style.cssText = 'font-size:10px;color:var(--text-muted)';
        typeSize.textContent = r.size;
        typeDiv.appendChild(typeSize);
        row.appendChild(typeDiv);

        var valsDiv = document.createElement('div');
        valsDiv.className = 'rate-values';

        // TC 1yr
        valsDiv.appendChild(_createRateValue('$' + r.tc1yr.toLocaleString(), r.tcTrend, 'TC 1yr', ''));
        // TC 3yr
        valsDiv.appendChild(_createRateValue('$' + r.tc3yr.toLocaleString(), null, 'TC 3yr', 'color:var(--text-secondary)'));
        // Spot
        valsDiv.appendChild(_createRateValue('$' + r.spot.toLocaleString(), r.spotTrend, 'Spot', 'color:var(--amber)'));

        row.appendChild(valsDiv);
        ratesSec.appendChild(row);
    });

    leftCol.appendChild(ratesSec);

    // Asset Prices section
    var assetSec = document.createElement('div');
    assetSec.className = 'market-section';
    var assetHeader = document.createElement('div');
    assetHeader.className = 'market-section-header';
    var assetTitle = document.createElement('div');
    assetTitle.className = 'market-section-title';
    assetTitle.textContent = '\ud83d\udcc9 Asset Prices' + indicativeLabel;
    assetHeader.appendChild(assetTitle);
    var assetSource = document.createElement('div');
    assetSource.className = 'market-section-source';
    assetSource.textContent = 'VesselsValue';
    assetHeader.appendChild(assetSource);
    assetSec.appendChild(assetHeader);

    var assetRows = [
        ['Scrap Steel ($/LDT)', '$' + liveData.scrap.price, 'amber'],
        ['NB Small Tanker 7K', '$' + liveData.newbuild.small + 'M', ''],
        ['NB LR2 110K', '$' + liveData.newbuild.lr2 + 'M', ''],
        ['NB LPG 27K', '$' + liveData.newbuild.lpg + 'M', ''],
        ['NB Aframax 105K', '$' + liveData.newbuild.aframax + 'M', '']
    ];
    assetRows.forEach(function(ar) {
        var row = document.createElement('div');
        row.className = 'asset-row';
        var aType = document.createElement('div');
        aType.className = 'asset-type';
        aType.textContent = ar[0];
        row.appendChild(aType);
        var aPrice = document.createElement('div');
        aPrice.className = 'asset-price' + (ar[2] ? ' ' + ar[2] : '');
        aPrice.textContent = ar[1];
        row.appendChild(aPrice);
        assetSec.appendChild(row);
    });

    leftCol.appendChild(assetSec);
    grid.appendChild(leftCol);

    // RIGHT COLUMN
    var rightCol = document.createElement('div');
    rightCol.style.cssText = 'display:flex;flex-direction:column;gap:16px';

    // Fleet Profile
    var profile = document.createElement('div');
    profile.className = 'fleet-profile';
    var profTitle = document.createElement('div');
    profTitle.className = 'fleet-profile-title';
    profTitle.textContent = '\ud83c\udfaf Your Fleet Profile (Match Criteria)';
    profile.appendChild(profTitle);
    var profTags = document.createElement('div');
    profTags.className = 'fleet-profile-tags';
    ['Small Tanker 7-8K', 'LPG 27K CBM', 'MR/LR2 45-110K', 'Aframax 105K', 'Age <20yr', 'Class: LR/DNV/NK/BV'].forEach(function(t) {
        var tag = document.createElement('span');
        tag.className = 'profile-tag';
        tag.textContent = t;
        profTags.appendChild(tag);
    });
    profile.appendChild(profTags);
    rightCol.appendChild(profile);

    // S&P Alerts section
    var spSec = document.createElement('div');
    spSec.className = 'market-section';
    var spHeader = document.createElement('div');
    spHeader.className = 'market-section-header';
    var spTitle = document.createElement('div');
    spTitle.className = 'market-section-title';
    spTitle.textContent = '\ud83d\udd14 S&P Alerts (' + liveData.spAlerts.length + ')';
    spHeader.appendChild(spTitle);
    var spSource = document.createElement('div');
    spSource.className = 'market-section-source';
    spSource.textContent = 'Broker Feeds';
    spHeader.appendChild(spSource);
    spSec.appendChild(spHeader);

    var spNote = document.createElement('p');
    spNote.style.cssText = 'font-size:10px;color:var(--text-muted);margin-bottom:12px';
    spNote.textContent = 'Vessels matching your fleet profile';
    spSec.appendChild(spNote);

    liveData.spAlerts.forEach(function(s) {
        var card = document.createElement('div');
        card.className = 'sp-alert-card' + (s.hot ? ' hot' : (s.new ? ' new' : ''));

        if (s.hot || s.new) {
            var alertBadge = document.createElement('span');
            alertBadge.className = 'sp-alert-badge ' + (s.hot ? 'hot' : 'new');
            alertBadge.textContent = s.hot ? '\ud83d\udd25 HOT' : '\u2728 NEW';
            card.appendChild(alertBadge);
        }

        var vName = document.createElement('div');
        vName.className = 'sp-vessel-name';
        vName.textContent = s.name;
        card.appendChild(vName);

        var vType = document.createElement('div');
        vType.className = 'sp-vessel-type';
        vType.textContent = s.type + ' | ' + s.dwt.toLocaleString() + ' DWT | Built ' + s.built;
        card.appendChild(vType);

        var vPrice = document.createElement('div');
        vPrice.className = 'sp-price';
        vPrice.textContent = '$' + s.price + 'M';
        card.appendChild(vPrice);

        var vDetails = document.createElement('div');
        vDetails.className = 'sp-details';
        var detBuilder = document.createElement('span');
        var bStrong = document.createElement('strong');
        bStrong.textContent = 'Builder:';
        detBuilder.appendChild(bStrong);
        detBuilder.appendChild(document.createTextNode(' ' + s.builder));
        vDetails.appendChild(detBuilder);
        var detClass = document.createElement('span');
        var cStrong = document.createElement('strong');
        cStrong.textContent = 'Class:';
        detClass.appendChild(cStrong);
        detClass.appendChild(document.createTextNode(' ' + s.class));
        vDetails.appendChild(detClass);
        card.appendChild(vDetails);

        // Match tags
        var matchWrap = document.createElement('div');
        matchWrap.style.marginTop = '10px';
        var matchLabel = document.createElement('div');
        matchLabel.style.cssText = 'font-size:9px;color:var(--text-muted);margin-bottom:4px';
        matchLabel.textContent = 'FLEET MATCH:';
        matchWrap.appendChild(matchLabel);
        var matchTags = document.createElement('div');
        matchTags.className = 'sp-match-tags';
        s.matches.forEach(function(m) {
            var tag = document.createElement('span');
            tag.className = 'sp-match-tag';
            tag.textContent = m;
            matchTags.appendChild(tag);
        });
        matchWrap.appendChild(matchTags);
        card.appendChild(matchWrap);

        var broker = document.createElement('div');
        broker.className = 'sp-broker';
        broker.textContent = '\ud83d\udccb ' + s.broker + ' | ' + s.listed;
        card.appendChild(broker);

        spSec.appendChild(card);
    });

    rightCol.appendChild(spSec);
    grid.appendChild(rightCol);
    marketBody.appendChild(grid);

    // Footer
    var footer = document.createElement('div');
    footer.style.cssText = 'background:var(--bg-primary);padding:14px;border-radius:10px;margin-top:16px';
    var footerP = document.createElement('p');
    footerP.style.cssText = 'font-size:10px;color:var(--text-muted)';
    footerP.textContent = '\ud83d\udce1 Data Sources: Baltic Exchange, Clarksons, VesselsValue, SSY, Fearnleys. Auto-refreshes every 30 seconds.';
    footer.appendChild(footerP);
    marketBody.appendChild(footer);

    document.getElementById('marketOverlay').classList.add('visible');
}

function _createRateValue(amount, trend, label, style) {
    var wrapper = document.createElement('div');
    wrapper.className = 'rate-value';
    var amountDiv = document.createElement('div');
    amountDiv.className = 'rate-amount';
    if (style) amountDiv.style.cssText = style;
    amountDiv.textContent = amount;
    if (trend) {
        var trendSpan = document.createElement('span');
        if (trend === 'up') { trendSpan.className = 'rate-trend up'; trendSpan.textContent = '\u2191'; }
        else if (trend === 'down') { trendSpan.className = 'rate-trend down'; trendSpan.textContent = '\u2193'; }
        else { trendSpan.className = 'rate-trend flat'; trendSpan.textContent = '\u2192'; }
        amountDiv.appendChild(trendSpan);
    }
    wrapper.appendChild(amountDiv);
    var labelDiv = document.createElement('div');
    labelDiv.className = 'rate-label';
    labelDiv.textContent = label;
    wrapper.appendChild(labelDiv);
    return wrapper;
}

function closeMarketModal() {
    document.getElementById('marketOverlay').classList.remove('visible');
}
