// zones.js -- Zone overlay rendering for JWC, corridors, and IRTC
// Loads GeoJSON from API and renders on Leaflet map
// Supports multiple map instances (overview + threat map)

// Per-map zone layer storage: keyed by Leaflet map _leaflet_id
var _zoneLayersPerMap = {};

function initZoneOverlays(mapInstance) {
  if (!mapInstance) return;

  var mapId = mapInstance._leaflet_id;
  _zoneLayersPerMap[mapId] = { jwc: null, corridors: null, irtc: null };

  var headers = {};
  var token = sessionStorage.getItem('sentinel_access_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;

  Promise.all([
    fetch('/api/zones/jwc-zones', { headers: headers }).then(function(r) { return r.json(); }),
    fetch('/api/zones/corridors', { headers: headers }).then(function(r) { return r.json(); }),
    fetch('/api/zones/irtc', { headers: headers }).then(function(r) { return r.json(); })
  ]).then(function(results) {
    var layers = _zoneLayersPerMap[mapId];

    // JWC Zones
    layers.jwc = L.geoJSON(results[0], {
      style: function(feature) {
        var riskLevel = feature.properties.riskLevel;
        var opacity = riskLevel === 'CRITICAL' ? 0.12 : 0.08;
        var borderWidth = riskLevel === 'CRITICAL' ? 2.5 : 2;
        return {
          color: '#ef4444', weight: borderWidth, dashArray: '6 4',
          fillColor: '#ef4444', fillOpacity: opacity, opacity: 0.6
        };
      },
      onEachFeature: function(feature, layer) {
        var props = feature.properties;
        var tooltipEl = document.createElement('div');
        var title = document.createElement('strong');
        title.textContent = props.name;
        tooltipEl.appendChild(title);
        tooltipEl.appendChild(document.createElement('br'));
        var jwcLabel = document.createElement('span');
        jwcLabel.style.color = '#ef4444';
        jwcLabel.textContent = 'JWC LISTED AREA';
        tooltipEl.appendChild(jwcLabel);
        tooltipEl.appendChild(document.createElement('br'));
        var risk = document.createElement('span');
        risk.textContent = 'Risk: ' + props.riskLevel;
        tooltipEl.appendChild(risk);
        tooltipEl.appendChild(document.createElement('br'));
        var awrp = document.createElement('span');
        awrp.textContent = 'AWRP: ' + props.awrpRange;
        tooltipEl.appendChild(awrp);
        layer.bindTooltip(tooltipEl, { sticky: true, className: 'zone-tooltip' });
      }
    }).addTo(mapInstance);

    // Corridors (hidden by default)
    layers.corridors = L.geoJSON(results[1], {
      style: function() {
        return {
          color: '#f59e0b', weight: 1.5, dashArray: '4 6',
          fillColor: '#f59e0b', fillOpacity: 0.03, opacity: 0.4
        };
      },
      onEachFeature: function(feature, layer) {
        var props = feature.properties;
        var tooltipEl = document.createElement('div');
        var title = document.createElement('strong');
        title.textContent = props.name;
        tooltipEl.appendChild(title);
        tooltipEl.appendChild(document.createElement('br'));
        var desc = document.createElement('span');
        desc.style.color = '#94a3b8';
        desc.textContent = props.description;
        tooltipEl.appendChild(desc);
        layer.bindTooltip(tooltipEl, { sticky: true, className: 'zone-tooltip' });
      }
    });

    // IRTC / TSS
    layers.irtc = L.geoJSON(results[2], {
      style: function(feature) {
        var id = feature.properties.id;
        if (id.startsWith('TSS_HORMUZ')) {
          return { color: '#3b82f6', weight: 2, dashArray: '8 6', opacity: 0.6 };
        }
        var isMain = id === 'IRTC_MAIN';
        return {
          color: '#22c55e', weight: isMain ? 3 : 1.5,
          dashArray: isMain ? '10 6' : '4 4', opacity: isMain ? 0.7 : 0.4
        };
      },
      onEachFeature: function(feature, layer) {
        layer.bindTooltip(feature.properties.name, { sticky: true, className: 'zone-tooltip' });
      }
    }).addTo(mapInstance);

    console.log('[ZONES] Zone overlays loaded for map', mapId);
  }).catch(function(err) {
    console.error('[ZONES] Failed to load zone data:', err.message);
  });
}
