// Proximity calculator -- haversine distance and proximity tier checks
const turfDistance = require('@turf/distance').default;
const config = require('../../../config/default');

/**
 * Calculate distance in nautical miles between two points
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in nautical miles
 */
function distanceNm(lat1, lon1, lat2, lon2) {
  const from = [lon1, lat1]; // turf uses [lon, lat]
  const to = [lon2, lat2];
  const km = turfDistance(from, to, { units: 'kilometers' });
  return km / 1.852; // km to nautical miles
}

/**
 * Determine proximity tier based on distance
 * @param {number} nm - Distance in nautical miles
 * @returns {{ tier: string, nm: number } | null}
 */
function getProximityTier(nm) {
  const tiers = config.proximity.tiers;

  if (nm <= tiers.DANGER) return { tier: 'DANGER', nm };
  if (nm <= tiers.CRITICAL) return { tier: 'CRITICAL', nm };
  if (nm <= tiers.WARNING) return { tier: 'WARNING', nm };
  if (nm <= tiers.WATCH) return { tier: 'WATCH', nm };
  return null; // Outside all tiers
}

/**
 * Check vessel proximity to an incident
 * @param {number} vesselLat
 * @param {number} vesselLon
 * @param {number} incidentLat
 * @param {number} incidentLon
 * @returns {{ distance: number, tier: string|null }}
 */
function checkProximity(vesselLat, vesselLon, incidentLat, incidentLon) {
  const nm = distanceNm(vesselLat, vesselLon, incidentLat, incidentLon);
  const tierResult = getProximityTier(nm);

  return {
    distance: Math.round(nm * 10) / 10, // 1 decimal place
    tier: tierResult ? tierResult.tier : null
  };
}

/**
 * Find all vessels within a given range of an incident
 * @param {Array<{imo: string, lat: number, lon: number}>} vessels
 * @param {number} incidentLat
 * @param {number} incidentLon
 * @param {number} maxNm - Maximum range in nautical miles (defaults to WATCH tier)
 * @returns {Array<{imo: string, distance: number, tier: string}>}
 */
function findVesselsInRange(vessels, incidentLat, incidentLon, maxNm) {
  const range = maxNm || config.proximity.tiers.WATCH;
  const results = [];

  for (const v of vessels) {
    if (!v.lat || !v.lon) continue;
    const { distance, tier } = checkProximity(v.lat, v.lon, incidentLat, incidentLon);
    if (distance <= range && tier) {
      results.push({ imo: v.imo, distance, tier });
    }
  }

  // Sort by distance (closest first)
  results.sort((a, b) => a.distance - b.distance);
  return results;
}

module.exports = { distanceNm, getProximityTier, checkProximity, findVesselsInRange };
