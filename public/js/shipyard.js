// shipyard.js -- Newbuild Shipyard Pricing modal
// BIHAR Fleet Tracker

function openShipyardModal() {
    var shipyardBody = document.getElementById('shipyardBody');
    shipyardBody.textContent = '';

    var sections = [
        { title: '\ud83d\udea2 Small Tanker (7-8K DWT)', data: liveData.shipyards.small },
        { title: '\ud83d\udee2\ufe0f LR2 Tanker (110K DWT)', data: liveData.shipyards.lr2 },
        { title: '\u26fd LPG Carrier (27K CBM)', data: liveData.shipyards.lpg },
        { title: '\ud83d\udee2\ufe0f Aframax (105K DWT)', data: liveData.shipyards.aframax }
    ];

    sections.forEach(function(s) {
        var sec = document.createElement('div');
        sec.className = 'market-section';
        sec.style.marginBottom = '16px';
        var header = document.createElement('div');
        header.className = 'market-section-header';
        var title = document.createElement('div');
        title.className = 'market-section-title';
        title.textContent = s.title;
        header.appendChild(title);
        sec.appendChild(header);

        var tableWrap = document.createElement('div');
        tableWrap.style.overflowX = 'auto';
        tableWrap.appendChild(_buildYardTable(s.data));
        sec.appendChild(tableWrap);
        shipyardBody.appendChild(sec);
    });

    // Footer
    var footer = document.createElement('div');
    footer.style.cssText = 'background:var(--bg-primary);padding:14px;border-radius:10px';
    var footerP = document.createElement('p');
    footerP.style.cssText = 'font-size:10px;color:var(--text-muted)';

    var bulb = document.createTextNode('\ud83d\udca1 ');
    footerP.appendChild(bulb);
    var premLabel = document.createElement('strong');
    premLabel.style.color = 'var(--green)';
    premLabel.textContent = 'Premium';
    footerP.appendChild(premLabel);
    footerP.appendChild(document.createTextNode(' = Korea/Japan, best resale | '));
    var highLabel = document.createElement('strong');
    highLabel.style.color = 'var(--blue)';
    highLabel.textContent = 'High';
    footerP.appendChild(highLabel);
    footerP.appendChild(document.createTextNode(' = China Tier-1, competitive. Prices Q1 2025 indicative.'));
    footer.appendChild(footerP);
    shipyardBody.appendChild(footer);

    document.getElementById('shipyardOverlay').classList.add('visible');
}

function _buildYardTable(yards) {
    var min = Math.min.apply(null, yards.map(function(y) { return y.price; }));

    var table = document.createElement('table');
    table.className = 'yard-table';

    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['Yard', 'Quality', 'Price', 'Lead', 'Slot'].forEach(function(h) {
        var th = document.createElement('th');
        th.textContent = h;
        headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    yards.forEach(function(y) {
        var tr = document.createElement('tr');

        var td1 = document.createElement('td');
        td1.textContent = y.country + ' ' + y.yard;
        tr.appendChild(td1);

        var td2 = document.createElement('td');
        var qSpan = document.createElement('span');
        qSpan.className = 'yard-quality ' + (y.quality === 'Premium' ? 'premium' : 'high');
        qSpan.textContent = y.quality;
        td2.appendChild(qSpan);
        tr.appendChild(td2);

        var td3 = document.createElement('td');
        if (y.price === min) td3.className = 'price-best';
        td3.textContent = '$' + y.price + 'M' + (y.price === min ? ' \u2713' : '');
        tr.appendChild(td3);

        var td4 = document.createElement('td');
        td4.textContent = y.lead;
        tr.appendChild(td4);

        var td5 = document.createElement('td');
        td5.className = 'slot-available';
        td5.textContent = y.slots;
        tr.appendChild(td5);

        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    return table;
}

function closeShipyardModal() {
    document.getElementById('shipyardOverlay').classList.remove('visible');
}
