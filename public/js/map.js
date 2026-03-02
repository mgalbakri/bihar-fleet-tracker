// map.js -- Leaflet map initialization, vessel markers, and voyage route lines
// BIHAR SENTINEL

// Route line state
var routeLines = {};
var routeLayerGroup = null;
var destMarkers = {};
var originMarkers = {};

function initMap() {
    try {
        map = L.map('map', { center: [22, 50], zoom: 3, zoomControl: true, attributionControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(map);

        vessels.forEach(function(v) {
            var icon = _makeMarkerIcon(v, false);
            var marker = L.marker([v.lat, v.lng], {
                icon: icon,
                zIndexOffset: isVesselUnderway(v) ? 200 : 100
            }).addTo(map);

            // Vessel name tooltip
            marker.bindTooltip(v.name, {
                direction: 'top',
                offset: [0, -10],
                className: 'vessel-tooltip'
            });

            marker.on('click', function(e) { L.DomEvent.stopPropagation(e); selectVessel(v.id); });
            markers[v.id] = marker;
        });

        document.getElementById('mapLoading').classList.add('hidden');
        map.on('click', function() { if (selectedId) deselectVessel(); });
    } catch (e) {
        var loadEl = document.getElementById('mapLoading');
        loadEl.textContent = '';
        var errP = document.createElement('p');
        errP.style.color = '#e05555';
        errP.textContent = 'Map error';
        loadEl.appendChild(errP);
    }
}

// Initialize voyage route lines — FULL VOYAGE from origin port to destination port
function initRouteLines() {
    routeLayerGroup = L.layerGroup().addTo(map);

    vessels.forEach(function(v) {
        if (!isVesselUnderway(v)) return;

        var destCoords = getDestinationCoords(v.destination);
        if (!destCoords) return;

        // Get origin port from portCalls or API-provided originPort field
        var originPort = v.originPort || (v.portCalls && v.portCalls.length > 0 ? v.portCalls[0].port : null);
        var originCoords = originPort ? getDestinationCoords(originPort.toUpperCase()) : null;

        // Fallback: if no origin port found, use vessel's current position
        if (!originCoords) {
            originCoords = [v.lat, v.lng];
        }

        var color = getTypeColor(v.type);

        // Dashed route line from ORIGIN PORT to DESTINATION PORT (full voyage)
        var line = L.polyline(
            [originCoords, destCoords],
            {
                color: color,
                weight: 1.5,
                dashArray: '6 8',
                opacity: 0.3,
                className: 'route-line'
            }
        );
        routeLayerGroup.addLayer(line);
        routeLines[v.id] = line;

        // Small origin circle marker at departure port
        var orig = L.circleMarker(originCoords, {
            radius: 3,
            fillColor: color,
            color: color,
            weight: 1,
            fillOpacity: 0.4,
            opacity: 0.3,
            className: 'origin-marker'
        });
        routeLayerGroup.addLayer(orig);
        originMarkers[v.id] = orig;

        // Small destination circle marker
        var dest = L.circleMarker(destCoords, {
            radius: 4,
            fillColor: 'transparent',
            color: color,
            weight: 1.5,
            dashArray: '3 3',
            opacity: 0.3,
            className: 'dest-marker'
        });
        routeLayerGroup.addLayer(dest);
        destMarkers[v.id] = dest;
    });
}

// Rebuild route lines (called on data refresh to update with new positions)
function rebuildRouteLines() {
    if (!routeLayerGroup) return;

    // Clear existing
    routeLayerGroup.clearLayers();
    routeLines = {};
    destMarkers = {};
    originMarkers = {};

    // Rebuild from current vessel data
    vessels.forEach(function(v) {
        if (!isVesselUnderway(v)) return;

        var destCoords = getDestinationCoords(v.destination);
        if (!destCoords) return;

        var originPort = v.originPort || (v.portCalls && v.portCalls.length > 0 ? v.portCalls[0].port : null);
        var originCoords = originPort ? getDestinationCoords(originPort.toUpperCase()) : null;
        if (!originCoords) originCoords = [v.lat, v.lng];

        var color = getTypeColor(v.type);

        var line = L.polyline([originCoords, destCoords], {
            color: color, weight: 1.5, dashArray: '6 8', opacity: 0.3, className: 'route-line'
        });
        routeLayerGroup.addLayer(line);
        routeLines[v.id] = line;

        var orig = L.circleMarker(originCoords, {
            radius: 3, fillColor: color, color: color, weight: 1, fillOpacity: 0.4, opacity: 0.3
        });
        routeLayerGroup.addLayer(orig);
        originMarkers[v.id] = orig;

        var dest = L.circleMarker(destCoords, {
            radius: 4, fillColor: 'transparent', color: color, weight: 1.5, dashArray: '3 3', opacity: 0.3
        });
        routeLayerGroup.addLayer(dest);
        destMarkers[v.id] = dest;
    });
}

// Highlight a vessel's route and dim all others
function highlightRoute(vesselId) {
    Object.keys(routeLines).forEach(function(id) {
        var numId = parseInt(id);
        var line = routeLines[id];
        var dest = destMarkers[id];
        var orig = originMarkers[id];
        if (numId === vesselId) {
            line.setStyle({ opacity: 0.8, weight: 2.5 });
            if (dest) dest.setStyle({ opacity: 0.8, weight: 2, fillColor: getTypeColor(vessels.find(function(v){return v.id===numId;}).type), fillOpacity: 0.3 });
            if (orig) orig.setStyle({ opacity: 0.8, fillOpacity: 0.6 });
            line.bringToFront();
        } else {
            line.setStyle({ opacity: 0.1, weight: 1 });
            if (dest) dest.setStyle({ opacity: 0.1 });
            if (orig) orig.setStyle({ opacity: 0.1 });
        }
    });
}

// Reset all routes to default appearance
function resetRoutes() {
    Object.keys(routeLines).forEach(function(id) {
        routeLines[id].setStyle({ opacity: 0.3, weight: 1.5 });
        if (destMarkers[id]) destMarkers[id].setStyle({ opacity: 0.3, fillColor: 'transparent', fillOpacity: 0 });
        if (originMarkers[id]) originMarkers[id].setStyle({ opacity: 0.3, fillOpacity: 0.4 });
    });
}
