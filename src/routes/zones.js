const express = require('express');
const path = require('path');
const { getZoneStatus } = require('../services/geo/zone-checker');
const { checkProximity, findVesselsInRange } = require('../services/geo/proximity');

const router = express.Router();

// Serve GeoJSON files for map rendering
router.get('/jwc-zones', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'config', 'jwc-zones.geojson'));
});

router.get('/corridors', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'config', 'corridors.geojson'));
});

router.get('/irtc', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'config', 'irtc.geojson'));
});

// Check zone status for a specific point
router.get('/check', (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon query params required' });
  }
  const status = getZoneStatus(parseFloat(lat), parseFloat(lon));
  res.json(status);
});

// Check proximity between a vessel and an incident
router.get('/proximity', (req, res) => {
  const { vesselLat, vesselLon, incidentLat, incidentLon } = req.query;
  if (!vesselLat || !vesselLon || !incidentLat || !incidentLon) {
    return res.status(400).json({ error: 'vesselLat, vesselLon, incidentLat, incidentLon required' });
  }
  const result = checkProximity(
    parseFloat(vesselLat), parseFloat(vesselLon),
    parseFloat(incidentLat), parseFloat(incidentLon)
  );
  res.json(result);
});

module.exports = router;
