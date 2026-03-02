// Zone Checker -- determines if a vessel is inside JWC Listed Areas or corridors
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const fs = require('fs');
const path = require('path');

// Load GeoJSON data once at startup (can't use require() for .geojson -- Node treats it as JS)
const jwcZones = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'config', 'jwc-zones.geojson'), 'utf8'));
const corridors = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'config', 'corridors.geojson'), 'utf8'));

/**
 * Check which JWC zones a point falls within
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Array<{id: string, name: string, riskLevel: string, awrpRange: string}>}
 */
function checkJWCZones(lat, lon) {
  const point = [lon, lat]; // GeoJSON uses [lon, lat]
  const zones = [];

  for (const feature of jwcZones.features) {
    if (booleanPointInPolygon(point, feature)) {
      zones.push({
        id: feature.properties.id,
        name: feature.properties.name,
        riskLevel: feature.properties.riskLevel,
        awrpRange: feature.properties.awrpRange
      });
    }
  }

  return zones;
}

/**
 * Check which corridor a point falls within
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Array<{id: string, name: string}>}
 */
function checkCorridors(lat, lon) {
  const point = [lon, lat];
  const matched = [];

  for (const feature of corridors.features) {
    if (booleanPointInPolygon(point, feature)) {
      matched.push({
        id: feature.properties.id,
        name: feature.properties.name
      });
    }
  }

  return matched;
}

/**
 * Check if a vessel is in any JWC zone
 * @param {number} lat
 * @param {number} lon
 * @returns {boolean}
 */
function isInJWCZone(lat, lon) {
  return checkJWCZones(lat, lon).length > 0;
}

/**
 * Get full zone status for a vessel position
 * @param {number} lat
 * @param {number} lon
 * @returns {{ inJWC: boolean, jwcZones: Array, corridors: Array, highestRisk: string|null }}
 */
function getZoneStatus(lat, lon) {
  const zones = checkJWCZones(lat, lon);
  const corrs = checkCorridors(lat, lon);

  // Determine highest risk level
  const riskOrder = { CRITICAL: 4, HIGH: 3, ELEVATED: 2, LOW: 1 };
  let highestRisk = null;
  let highestScore = 0;
  for (const z of zones) {
    const score = riskOrder[z.riskLevel] || 0;
    if (score > highestScore) {
      highestScore = score;
      highestRisk = z.riskLevel;
    }
  }

  return {
    inJWC: zones.length > 0,
    jwcZones: zones,
    corridors: corrs,
    highestRisk
  };
}

module.exports = { checkJWCZones, checkCorridors, isInJWCZone, getZoneStatus };
