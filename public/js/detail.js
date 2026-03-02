// detail.js -- Vessel detail modal, tabs, select/deselect
// BIHAR Fleet Tracker

function _makeMarkerIcon(v, selected) {
    var color = getTypeColor(v.type);
    var sel = selected ? ' selected' : '';
    var maint = v.active ? '' : ' maintenance';
    var underway = isVesselUnderway(v);
    var div = document.createElement('div');
    div.className = 'vessel-marker' + sel + maint;

    if (underway) {
        // Directional arrow SVG -- points north by default, rotated by course
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">'
            + '<path d="M14 2 L23 24 L14 17 L5 24 Z" fill="' + color + '" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-linejoin="round"/>'
            + '</svg>';
        div.innerHTML = svg;
        div.style.transform = 'rotate(' + (v.course || 0) + 'deg)';
        return L.divIcon({ html: div.outerHTML, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
    } else {
        // Stationary vessel -- circle with inner dot
        var strokeStyle = v.active ? 'stroke-width="2"' : 'stroke-width="2" stroke-dasharray="3 2"';
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">'
            + '<circle cx="11" cy="11" r="9" fill="' + color + '" fill-opacity="0.3" stroke="' + color + '" ' + strokeStyle + '/>'
            + '<circle cx="11" cy="11" r="3.5" fill="' + color + '"/>'
            + '</svg>';
        div.innerHTML = svg;
        return L.divIcon({ html: div.outerHTML, className: '', iconSize: [22, 22], iconAnchor: [11, 11] });
    }
}

function selectVessel(id) {
    if (selectedId) {
        var pv = vessels.find(function(v) { return v.id === selectedId; });
        if (pv && markers[selectedId]) markers[selectedId].setIcon(_makeMarkerIcon(pv, false));
        var pc = document.querySelector('.vessel-card.selected');
        if (pc) pc.classList.remove('selected');
    }
    selectedId = id;
    var v = vessels.find(function(x) { return x.id === id; });
    if (!v) return;
    markers[id].setIcon(_makeMarkerIcon(v, true));
    var card = document.querySelector('.vessel-card[data-id="' + id + '"]');
    if (card) { card.classList.add('selected'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    map.setView([v.lat, v.lng], 5, { animate: true });
    // Highlight this vessel's route line
    if (typeof highlightRoute === 'function') highlightRoute(id);
    // Load AIS track trail
    if (typeof loadVesselTrack === 'function') loadVesselTrack(v);
    activeTab = 'overview';
    showDetail(v);
    if (window.innerWidth < 768 && panelOpen) togglePanel();
}

function deselectVessel() {
    if (!selectedId) return;
    var v = vessels.find(function(x) { return x.id === selectedId; });
    if (v && markers[selectedId]) markers[selectedId].setIcon(_makeMarkerIcon(v, false));
    var pc = document.querySelector('.vessel-card.selected');
    if (pc) pc.classList.remove('selected');
    selectedId = null;
    // Reset all route lines to default
    if (typeof resetRoutes === 'function') resetRoutes();
    // Clear AIS track trail
    if (typeof clearVesselTrack === 'function') clearVesselTrack();
    closeDetail();
}

function showDetail(v) {
    document.getElementById('detailTitle').textContent = v.name;
    document.getElementById('detailSubtitle').textContent = v.typeLabel + ' | ' + v.dwt.toLocaleString() + ' DWT';
    document.getElementById('detailImo').textContent = 'IMO: ' + v.imo + ' | MMSI: ' + v.mmsi;
    document.getElementById('detailClass').textContent = '\ud83c\udfdb\ufe0f ' + v.class + ' (' + v.classAbbr + ')';
    document.querySelectorAll('.detail-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.tab === activeTab); });
    renderTabContent(v);
    document.getElementById('detailModal').classList.add('visible');
    document.getElementById('detailOverlay').classList.add('visible');
}

function renderTabContent(v) {
    var body = document.getElementById('detailBody');
    var sc = v.active ? 'active' : 'maintenance', st = v.active ? 'Active' : 'Maintenance';
    var totalDef = v.pscInspections.reduce(function(s, i) { return s + i.deficiencies; }, 0);
    var indicative = SIMULATED ? ' (INDICATIVE)' : '';

    if (activeTab === 'overview') {
        _renderOverviewTab(body, v, sc, st);
    } else if (activeTab === 'valuation') {
        _renderValuationTab(body, v, indicative);
    } else if (activeTab === 'nbcycle') {
        _renderNbCycleTab(body, v, indicative);
    } else if (activeTab === 'ais') {
        _renderAisTab(body, v);
    } else if (activeTab === 'psc') {
        _renderPscTab(body, v, totalDef);
    } else if (activeTab === 'ports') {
        _renderPortsTab(body, v);
    } else if (activeTab === 'specs') {
        _renderSpecsTab(body, v);
    }
}

function _renderOverviewTab(body, v, sc, st) {
    body.textContent = '';

    // Voyage summary (hero position)
    body.appendChild(_renderVoyageSummary(v));

    // Cargo section
    body.appendChild(_renderCargoSection(v));

    // Status section
    var sec1 = _createSection('Current Status');
    var grid1 = document.createElement('div');
    grid1.className = 'detail-grid';

    // Status item with badge
    var statusItem = document.createElement('div');
    statusItem.className = 'detail-item';
    var statusLabel = document.createElement('div');
    statusLabel.className = 'detail-label';
    statusLabel.textContent = 'Status';
    statusItem.appendChild(statusLabel);
    var statusVal = document.createElement('div');
    statusVal.className = 'detail-value';
    var statusBadge = document.createElement('span');
    statusBadge.className = 'status-badge ' + sc;
    var statusDot = document.createElement('span');
    statusDot.className = 'status-badge-dot';
    statusBadge.appendChild(statusDot);
    statusBadge.appendChild(document.createTextNode(st));
    statusVal.appendChild(statusBadge);
    statusItem.appendChild(statusVal);
    grid1.appendChild(statusItem);

    // Class item
    var classItem = document.createElement('div');
    classItem.className = 'detail-item';
    var classLabel = document.createElement('div');
    classLabel.className = 'detail-label';
    classLabel.textContent = 'Class';
    classItem.appendChild(classLabel);
    var classVal = document.createElement('div');
    classVal.className = 'detail-value purple';
    classVal.textContent = v.classAbbr;
    classItem.appendChild(classVal);
    grid1.appendChild(classItem);

    // Activity item
    var actItem = _createItem('Activity', v.status);
    actItem.className = 'detail-item full';
    grid1.appendChild(actItem);
    sec1.appendChild(grid1);
    body.appendChild(sec1);

    // Weather section
    var sec2 = _createSection('Weather');
    var wCard = document.createElement('div');
    wCard.className = 'weather-card';
    var wMain = document.createElement('div');
    wMain.className = 'weather-main';
    var wIcon = document.createElement('div');
    wIcon.className = 'weather-icon';
    wIcon.textContent = v.weather.icon;
    wMain.appendChild(wIcon);
    var wInfo = document.createElement('div');
    var wTemp = document.createElement('div');
    wTemp.className = 'weather-temp';
    wTemp.textContent = v.weather.temp + '\u00b0C';
    wInfo.appendChild(wTemp);
    var wDesc = document.createElement('div');
    wDesc.className = 'weather-desc';
    wDesc.textContent = v.weather.condition;
    wInfo.appendChild(wDesc);
    wMain.appendChild(wInfo);
    wCard.appendChild(wMain);
    var wDetails = document.createElement('div');
    wDetails.className = 'weather-details';
    var wd1 = document.createElement('div');
    wd1.className = 'weather-detail';
    wd1.textContent = '\ud83d\udca8 ';
    var wd1s = document.createElement('span');
    wd1s.textContent = v.weather.wind + ' kts';
    wd1.appendChild(wd1s);
    wDetails.appendChild(wd1);
    var wd2 = document.createElement('div');
    wd2.className = 'weather-detail';
    wd2.textContent = '\ud83d\udca7 ';
    var wd2s = document.createElement('span');
    wd2s.textContent = v.weather.humidity + '%';
    wd2.appendChild(wd2s);
    wDetails.appendChild(wd2);
    wCard.appendChild(wDetails);
    sec2.appendChild(wCard);
    body.appendChild(sec2);

    // Charter section
    var sec3 = _createSection('Charter');
    var grid3 = document.createElement('div');
    grid3.className = 'detail-grid';
    var chItem = _createItem('Charterer', v.charterer);
    chItem.className = 'detail-item full';
    grid3.appendChild(chItem);
    grid3.appendChild(_createItem('Delivered', v.delivered));
    grid3.appendChild(_createItem('Redelivery', v.redelivery));
    sec3.appendChild(grid3);
    body.appendChild(sec3);
}

function _renderValuationTab(body, v, indicative) {
    body.textContent = '';
    var scrapPct = (v.scrapValue / v.replacementValue * 100).toFixed(0);
    var marketPct = (v.marketValue / v.replacementValue * 100).toFixed(0);

    var sec = _createSection('Asset Valuation (USD Millions)');

    // Market value card
    sec.appendChild(_createValuationCard(
        '\ud83d\udcb0 Market Value' + indicative, 'green', '$' + v.marketValue + 'M',
        'Current market estimate', 'market', marketPct
    ));

    // Replacement card
    sec.appendChild(_createValuationCard(
        '\ud83d\udd04 Replacement (Newbuild)', 'blue', '$' + v.replacementValue + 'M',
        'Cost to order equivalent today', 'replacement', '100'
    ));

    // Scrap card
    sec.appendChild(_createValuationCard(
        '\u2699\ufe0f Scrap Value' + indicative, 'amber', '$' + v.scrapValue + 'M',
        'LDT: ' + v.ldt.toLocaleString() + 't @ $' + liveData.scrap.price + '/LDT', 'scrap', scrapPct
    ));

    body.appendChild(sec);

    // Analysis section
    var sec2 = _createSection('Analysis');
    var grid = document.createElement('div');
    grid.className = 'detail-grid';
    grid.appendChild(_createItem('Age', (2025 - v.built) + ' years'));
    grid.appendChild(_createItem('LDT', v.ldt.toLocaleString() + ' t'));
    var aboveScrap = _createItem('Above Scrap', '+$' + (v.marketValue - v.scrapValue).toFixed(1) + 'M');
    aboveScrap.querySelector('.detail-value').className = 'detail-value green';
    grid.appendChild(aboveScrap);
    var vsRepl = _createItem('vs Replacement', '-' + (100 - parseInt(marketPct)) + '%');
    vsRepl.querySelector('.detail-value').className = 'detail-value red';
    grid.appendChild(vsRepl);
    sec2.appendChild(grid);
    body.appendChild(sec2);
}

function _renderNbCycleTab(body, v, indicative) {
    body.textContent = '';
    // Determine vessel class for NB history
    var nbKey = 'smallTanker';
    if (v.dwt > 100000) nbKey = v.type === 'crude' ? 'aframax' : 'lr2';
    else if (v.type === 'lpg') nbKey = 'lpg';
    else if (v.type === 'chemical' || v.dwt > 40000) nbKey = 'chemical';

    var nbData = liveData.nbHistory[nbKey];
    var prices = nbData.prices;
    var maxPrice = Math.max.apply(null, prices.map(function(p) { return p.price; }));
    var minPrice = Math.min.apply(null, prices.map(function(p) { return p.price; }));
    var avgPrice = Math.round(prices.reduce(function(s, p) { return s + p.price; }, 0) / prices.length);
    var currentPrice = prices[prices.length - 1].price;
    var lowYear = prices.find(function(p) { return p.price === minPrice; }).year;
    var highYear = prices.find(function(p) { return p.price === maxPrice; }).year;

    // Cycle position
    var cyclePosition = Math.round((currentPrice - minPrice) / (maxPrice - minPrice) * 100);

    // Signal
    var signal, signalClass, signalIcon, signalDesc;
    if (cyclePosition <= 25) {
        signal = 'STRONG BUY'; signalClass = 'buy'; signalIcon = '\ud83d\udfe2';
        signalDesc = 'Prices near 15-year low. Excellent ordering window.';
    } else if (cyclePosition <= 50) {
        signal = 'CONSIDER BUYING'; signalClass = 'buy'; signalIcon = '\ud83d\udfe1';
        signalDesc = 'Prices below average. Good time to order if planning fleet renewal.';
    } else if (cyclePosition <= 75) {
        signal = 'HOLD / WAIT'; signalClass = 'hold'; signalIcon = '\ud83d\udfe0';
        signalDesc = 'Prices above average. Consider waiting for better entry point.';
    } else {
        signal = 'WAIT FOR DIP'; signalClass = 'wait'; signalIcon = '\ud83d\udd34';
        signalDesc = 'Prices near cycle peak. Not ideal ordering window.';
    }

    // Signal box
    var sigDiv = document.createElement('div');
    sigDiv.className = 'nb-signal ' + signalClass;
    var sigIconDiv = document.createElement('div');
    sigIconDiv.className = 'nb-signal-icon';
    sigIconDiv.textContent = signalIcon;
    sigDiv.appendChild(sigIconDiv);
    var sigText = document.createElement('div');
    sigText.className = 'nb-signal-text';
    var sigTitle = document.createElement('div');
    sigTitle.className = 'nb-signal-title';
    sigTitle.textContent = signal;
    sigText.appendChild(sigTitle);
    var sigDescDiv = document.createElement('div');
    sigDescDiv.className = 'nb-signal-desc';
    sigDescDiv.textContent = signalDesc;
    sigText.appendChild(sigDescDiv);
    sigDiv.appendChild(sigText);
    body.appendChild(sigDiv);

    // Chart container
    var chartContainer = document.createElement('div');
    chartContainer.className = 'nb-chart-container';
    var chartHeader = document.createElement('div');
    chartHeader.className = 'nb-chart-header';
    var chartTitle = document.createElement('div');
    chartTitle.className = 'nb-chart-title';
    chartTitle.textContent = '15-Year Newbuild Price History';
    chartHeader.appendChild(chartTitle);
    var chartClass = document.createElement('div');
    chartClass.className = 'nb-chart-class';
    chartClass.textContent = nbData.label;
    chartHeader.appendChild(chartClass);
    chartContainer.appendChild(chartHeader);

    var chartDiv = document.createElement('div');
    chartDiv.className = 'nb-chart';
    prices.forEach(function(p, i) {
        var height = ((p.price - minPrice * 0.8) / (maxPrice - minPrice * 0.8) * 100);
        var bar = document.createElement('div');
        bar.className = 'nb-bar';
        if (i === prices.length - 1) bar.className += ' current';
        else if (p.price === minPrice) bar.className += ' low';
        else if (p.price === maxPrice) bar.className += ' high';
        bar.style.height = height + '%';
        var tooltip = document.createElement('div');
        tooltip.className = 'nb-bar-tooltip';
        var strong = document.createElement('strong');
        strong.textContent = p.year;
        tooltip.appendChild(strong);
        tooltip.appendChild(document.createElement('br'));
        tooltip.appendChild(document.createTextNode('$' + p.price + 'M'));
        bar.appendChild(tooltip);
        chartDiv.appendChild(bar);
    });
    chartContainer.appendChild(chartDiv);

    var labels = document.createElement('div');
    labels.className = 'nb-chart-labels';
    ['2010', '2015', '2020', '2025'].forEach(function(l) {
        var s = document.createElement('span');
        s.textContent = l;
        labels.appendChild(s);
    });
    chartContainer.appendChild(labels);
    body.appendChild(chartContainer);

    // Stats row
    var statsDiv = document.createElement('div');
    statsDiv.className = 'nb-stats';
    statsDiv.appendChild(_createNbStat('$' + currentPrice + 'M', 'amber', 'Current Price'));
    statsDiv.appendChild(_createNbStat('$' + minPrice + 'M', 'green', '15yr Low (' + lowYear + ')'));
    statsDiv.appendChild(_createNbStat('$' + maxPrice + 'M', 'red', '15yr High (' + highYear + ')'));
    body.appendChild(statsDiv);

    // Analysis grid
    var grid = document.createElement('div');
    grid.className = 'detail-grid';
    grid.style.marginBottom = '16px';
    grid.appendChild(_createItem('15yr Average', '$' + avgPrice + 'M'));
    var cpItem = _createItem('Cycle Position', cyclePosition + '% (of range)');
    cpItem.querySelector('.detail-value').className = 'detail-value ' + (cyclePosition > 50 ? 'red' : 'green');
    grid.appendChild(cpItem);
    var vsAvg = _createItem('vs Average', (currentPrice > avgPrice ? '+' : '') + (currentPrice - avgPrice) + 'M');
    vsAvg.querySelector('.detail-value').className = 'detail-value ' + (currentPrice > avgPrice ? 'red' : 'green');
    grid.appendChild(vsAvg);
    var savings = _createItem('Potential Savings', '$' + (currentPrice - minPrice) + 'M at cycle low');
    savings.querySelector('.detail-value').className = 'detail-value green';
    grid.appendChild(savings);
    body.appendChild(grid);

    // Market events
    var eventsDiv = document.createElement('div');
    eventsDiv.className = 'nb-events';
    var evTitle = document.createElement('div');
    evTitle.className = 'nb-events-title';
    evTitle.textContent = '\ud83d\udcc5 Key Market Events';
    eventsDiv.appendChild(evTitle);
    liveData.marketEvents.forEach(function(e) {
        var ev = document.createElement('div');
        ev.className = 'nb-event';
        var yr = document.createElement('div');
        yr.className = 'nb-event-year';
        yr.textContent = e.year;
        ev.appendChild(yr);
        var txt = document.createElement('div');
        txt.className = 'nb-event-text';
        txt.textContent = e.event;
        ev.appendChild(txt);
        eventsDiv.appendChild(ev);
    });
    body.appendChild(eventsDiv);
}

function _renderAisTab(body, v) {
    body.textContent = '';
    var sec1 = _createSection('\ud83d\udce1 AIS / Navigation');
    var aisCard = document.createElement('div');
    aisCard.className = 'ais-card';
    var aisFields = [
        ['Nav Status', v.navStatus],
        ['Speed', v.speed + ' kts'],
        ['Course', v.course + '\u00b0'],
        ['Destination', v.destination],
        ['ETA', v.eta],
        ['Position', v.lat.toFixed(4) + '\u00b0, ' + v.lng.toFixed(4) + '\u00b0']
    ];
    aisFields.forEach(function(f) {
        var row = document.createElement('div');
        row.className = 'ais-row';
        var lbl = document.createElement('div');
        lbl.className = 'ais-label';
        lbl.textContent = f[0];
        row.appendChild(lbl);
        var val = document.createElement('div');
        val.className = 'ais-value';
        if (f[0] === 'Position') val.style.fontFamily = 'monospace';
        val.textContent = f[1];
        row.appendChild(val);
        aisCard.appendChild(row);
    });
    sec1.appendChild(aisCard);
    body.appendChild(sec1);

    var sec2 = _createSection('Identifiers');
    var grid = document.createElement('div');
    grid.className = 'detail-grid';
    grid.appendChild(_createItem('IMO', v.imo));
    grid.appendChild(_createItem('MMSI', v.mmsi));
    grid.appendChild(_createItem('Call Sign', v.callSign));
    grid.appendChild(_createItem('Flag', v.flag));
    sec2.appendChild(grid);
    body.appendChild(sec2);
}

function _renderPscTab(body, v, totalDef) {
    body.textContent = '';
    var sec = _createSection('\ud83d\udd0d PSC Inspections');

    var tableWrap = document.createElement('div');
    tableWrap.style.cssText = 'overflow-x:auto;border-radius:10px;border:1px solid var(--border)';
    var table = document.createElement('table');
    table.className = 'psc-table';
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['Port', 'Date', 'Def.', 'Detained'].forEach(function(h) {
        var th = document.createElement('th');
        th.textContent = h;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    v.pscInspections.forEach(function(insp) {
        var tr = document.createElement('tr');
        var td1 = document.createElement('td');
        td1.textContent = insp.port;
        tr.appendChild(td1);
        var td2 = document.createElement('td');
        td2.textContent = insp.date;
        tr.appendChild(td2);
        var td3 = document.createElement('td');
        var defSpan = document.createElement('span');
        var dc = insp.deficiencies === 0 ? 'zero' : (insp.deficiencies <= 2 ? 'low' : 'high');
        defSpan.className = 'deficiency-count ' + dc;
        defSpan.textContent = insp.deficiencies;
        td3.appendChild(defSpan);
        tr.appendChild(td3);
        var td4 = document.createElement('td');
        td4.textContent = insp.detained ? '\u26a0\ufe0f Yes' : '\u2713 No';
        tr.appendChild(td4);
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableWrap.appendChild(table);
    sec.appendChild(tableWrap);

    // Summary
    var summary = document.createElement('div');
    summary.className = 'psc-summary';
    summary.appendChild(_createPscSummaryItem(v.pscInspections.length, 'Inspections'));
    summary.appendChild(_createPscSummaryItem(totalDef, 'Total Def.'));
    var detItem = _createPscSummaryItem(0, 'Detentions');
    detItem.querySelector('.psc-summary-value').className = 'psc-summary-value green';
    summary.appendChild(detItem);
    sec.appendChild(summary);
    body.appendChild(sec);
}

function _renderPortsTab(body, v) {
    body.textContent = '';
    var sec = _createSection('\ud83c\udfed Port Calls');
    v.portCalls.forEach(function(p) {
        var call = document.createElement('div');
        call.className = 'port-call';
        var icon = document.createElement('div');
        icon.className = 'port-icon';
        icon.textContent = '\ud83c\udfed';
        call.appendChild(icon);
        var info = document.createElement('div');
        var pName = document.createElement('div');
        pName.className = 'port-name';
        pName.textContent = p.port;
        info.appendChild(pName);
        var pCountry = document.createElement('div');
        pCountry.className = 'port-country';
        pCountry.textContent = p.country;
        info.appendChild(pCountry);
        var dates = document.createElement('div');
        dates.className = 'port-dates';
        var arrived = document.createElement('span');
        arrived.textContent = '\ud83d\udce5 ' + p.arrived;
        dates.appendChild(arrived);
        var departed = document.createElement('span');
        departed.textContent = '\ud83d\udce4 ' + p.departed;
        dates.appendChild(departed);
        info.appendChild(dates);
        call.appendChild(info);
        sec.appendChild(call);
    });
    body.appendChild(sec);
}

function _renderSpecsTab(body, v) {
    body.textContent = '';

    // Particulars
    var sec1 = _createSection('\ud83d\udccb Particulars');
    var grid1 = document.createElement('div');
    grid1.className = 'detail-grid';
    grid1.appendChild(_createItem('Type', v.typeLabel));
    grid1.appendChild(_createItem('Built', v.built));
    var builderItem = _createItem('Builder', v.builder);
    builderItem.className = 'detail-item full';
    grid1.appendChild(builderItem);
    grid1.appendChild(_createItem('Flag', v.flag));
    var classItem = _createItem('Class', v.class);
    classItem.querySelector('.detail-value').className = 'detail-value purple';
    grid1.appendChild(classItem);
    sec1.appendChild(grid1);
    body.appendChild(sec1);

    // Dimensions
    var sec2 = _createSection('Dimensions');
    var grid2 = document.createElement('div');
    grid2.className = 'detail-grid';
    grid2.appendChild(_createItem('LOA', v.loa + ' m'));
    grid2.appendChild(_createItem('Beam', v.beam + ' m'));
    grid2.appendChild(_createItem('Draft', v.draft + ' m'));
    grid2.appendChild(_createItem('LDT', v.ldt.toLocaleString() + ' t'));
    sec2.appendChild(grid2);
    body.appendChild(sec2);

    // Tonnage
    var sec3 = _createSection('Tonnage');
    var grid3 = document.createElement('div');
    grid3.className = 'detail-grid';
    grid3.appendChild(_createItem('DWT', v.dwt.toLocaleString() + ' MT'));
    grid3.appendChild(_createItem('GT', v.gt.toLocaleString()));
    grid3.appendChild(_createItem('NT', v.nt.toLocaleString()));
    sec3.appendChild(grid3);
    body.appendChild(sec3);
}

// --- DOM helper functions ---

function _createSection(title) {
    var sec = document.createElement('div');
    sec.className = 'detail-section';
    var t = document.createElement('div');
    t.className = 'detail-section-title';
    t.textContent = title;
    sec.appendChild(t);
    return sec;
}

function _createItem(label, value) {
    var item = document.createElement('div');
    item.className = 'detail-item';
    var lbl = document.createElement('div');
    lbl.className = 'detail-label';
    lbl.textContent = label;
    item.appendChild(lbl);
    var val = document.createElement('div');
    val.className = 'detail-value';
    val.textContent = String(value);
    item.appendChild(val);
    return item;
}

function _createValuationCard(title, colorClass, amount, sub, fillClass, pct) {
    var card = document.createElement('div');
    card.className = 'valuation-card';
    var t = document.createElement('div');
    t.className = 'valuation-title';
    t.textContent = title;
    card.appendChild(t);
    var a = document.createElement('div');
    a.className = 'valuation-amount ' + colorClass;
    a.textContent = amount;
    card.appendChild(a);
    var s = document.createElement('div');
    s.className = 'valuation-sub';
    s.textContent = sub;
    card.appendChild(s);
    var bar = document.createElement('div');
    bar.className = 'valuation-bar';
    var fill = document.createElement('div');
    fill.className = 'valuation-fill ' + fillClass;
    fill.style.width = pct + '%';
    bar.appendChild(fill);
    card.appendChild(bar);
    return card;
}

function _createNbStat(value, colorClass, label) {
    var stat = document.createElement('div');
    stat.className = 'nb-stat';
    var val = document.createElement('div');
    val.className = 'nb-stat-value ' + colorClass;
    val.textContent = value;
    stat.appendChild(val);
    var lbl = document.createElement('div');
    lbl.className = 'nb-stat-label';
    lbl.textContent = label;
    stat.appendChild(lbl);
    return stat;
}

function _createPscSummaryItem(value, label) {
    var item = document.createElement('div');
    item.className = 'psc-summary-item';
    var val = document.createElement('div');
    val.className = 'psc-summary-value';
    val.textContent = value;
    item.appendChild(val);
    var lbl = document.createElement('div');
    lbl.className = 'psc-summary-label';
    lbl.textContent = label;
    item.appendChild(lbl);
    return item;
}

// --- Voyage summary card ---
function _renderVoyageSummary(v) {
    var sec = _createSection('Voyage');
    var card = document.createElement('div');
    card.className = 'voyage-card';

    // Route progress bar: [origin] ─── progress ──▶ [destination]
    var bar = document.createElement('div');
    bar.className = 'voyage-route-bar';

    var origin = document.createElement('div');
    origin.className = 'voyage-point origin';
    var lastPort = v.portCalls && v.portCalls.length > 0 ? v.portCalls[0].port : v.location || '--';
    origin.textContent = lastPort;
    bar.appendChild(origin);

    var track = document.createElement('div');
    track.className = 'voyage-progress-track';
    var fill = document.createElement('div');
    fill.className = 'voyage-progress-fill ' + v.type;
    // Estimate progress: underway = 50%, in port = 100%, other = 10%
    var pct = isVesselUnderway(v) ? 50 : (v.eta === 'In Port' ? 100 : 10);
    fill.style.width = pct + '%';
    var dot = document.createElement('div');
    dot.className = 'voyage-progress-dot ' + v.type;
    fill.appendChild(dot);
    track.appendChild(fill);
    bar.appendChild(track);

    var dest = document.createElement('div');
    dest.className = 'voyage-point dest';
    dest.textContent = v.destination || '--';
    bar.appendChild(dest);
    card.appendChild(bar);

    // Key metrics: Next Port + ETA
    var metrics = document.createElement('div');
    metrics.className = 'voyage-metrics';

    var portMetric = document.createElement('div');
    portMetric.className = 'voyage-metric';
    var portLbl = document.createElement('div');
    portLbl.className = 'voyage-metric-label';
    portLbl.textContent = 'Next Port';
    portMetric.appendChild(portLbl);
    var portVal = document.createElement('div');
    portVal.className = 'voyage-metric-value ' + v.type;
    portVal.textContent = v.destination || '--';
    portMetric.appendChild(portVal);
    metrics.appendChild(portMetric);

    var etaMetric = document.createElement('div');
    etaMetric.className = 'voyage-metric';
    var etaLbl = document.createElement('div');
    etaLbl.className = 'voyage-metric-label';
    etaLbl.textContent = 'ETA';
    etaMetric.appendChild(etaLbl);
    var etaVal = document.createElement('div');
    etaVal.className = 'voyage-metric-value';
    etaVal.textContent = v.eta || '--';
    etaMetric.appendChild(etaVal);
    metrics.appendChild(etaMetric);
    card.appendChild(metrics);

    // Navigation chips: SPD | CRS | NAV
    var navRow = document.createElement('div');
    navRow.className = 'voyage-nav-row';
    navRow.appendChild(_createNavChip('SPD', (v.speed || 0) + ' kts'));
    navRow.appendChild(_createNavChip('CRS', (v.course || 0) + '\u00b0'));
    var navShort = _abbreviateNav(v.navStatus);
    navRow.appendChild(_createNavChip('NAV', navShort));
    card.appendChild(navRow);

    sec.appendChild(card);
    return sec;
}

function _createNavChip(label, value) {
    var chip = document.createElement('div');
    chip.className = 'nav-chip';
    var lbl = document.createElement('div');
    lbl.className = 'nav-chip-label';
    lbl.textContent = label;
    chip.appendChild(lbl);
    var val = document.createElement('div');
    val.className = 'nav-chip-value';
    val.textContent = value;
    chip.appendChild(val);
    return chip;
}

function _abbreviateNav(status) {
    if (!status) return '--';
    if (status.indexOf('Under way') !== -1) return 'Underway';
    if (status.indexOf('At anchor') !== -1) return 'Anchored';
    if (status.indexOf('Moored') !== -1) return 'Moored';
    return status;
}

// --- Cargo section ---
function _renderCargoSection(v) {
    var sec = _createSection('Cargo');
    var grid = document.createElement('div');
    grid.className = 'detail-grid';

    if (v.cargo) {
        grid.appendChild(_createItem('Cargo Type', v.cargo.type));
        grid.appendChild(_createItem('Quantity', v.cargo.quantity));
        if (v.cargo.grade) {
            var gradeItem = _createItem('Grade', v.cargo.grade);
            gradeItem.className = 'detail-item full';
            grid.appendChild(gradeItem);
        }
    } else {
        var categoryMap = { tanker: 'Clean Petroleum Products', lpg: 'Liquefied Petroleum Gas', chemical: 'Chemical / Petrochemical', crude: 'Crude Oil' };
        grid.appendChild(_createItem('Cargo Category', categoryMap[v.type] || 'Unknown'));
        grid.appendChild(_createItem('Capacity', v.dwt.toLocaleString() + ' DWT'));
        var statusItem = _createItem('Load Status', 'Ballast / Awaiting');
        statusItem.className = 'detail-item full';
        grid.appendChild(statusItem);
    }

    sec.appendChild(grid);
    return sec;
}

function closeDetail() {
    document.getElementById('detailModal').classList.remove('visible');
    document.getElementById('detailOverlay').classList.remove('visible');
}

function togglePanel() {
    panelOpen = !panelOpen;
    document.getElementById('panel').classList.toggle('open', panelOpen);
    document.getElementById('panelOverlay').classList.toggle('visible', panelOpen);
}
