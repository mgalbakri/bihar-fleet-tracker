// Weather Poller -- fetches real-time weather at vessel positions
// Uses OpenWeatherMap free tier API
// BIHAR SENTINEL

const cron = require('node-cron');
const path = require('path');
const config = require('../../../config/default');
const OpenWeatherMapProvider = require('./openweathermap');
const aisCache = require('../ais/ais-cache');

const provider = new OpenWeatherMapProvider();
const weatherCache = new Map(); // imo -> { data, updatedAt }
let wsService = null;
let vessels = [];

function init(ws) {
  wsService = ws;
  var vesselsPath = path.join(__dirname, '..', '..', '..', 'config', 'vessels.json');
  vessels = require(vesselsPath);

  if (!provider.isConfigured()) {
    console.log('[WEATHER] No OpenWeatherMap API key -- no weather data available');
    return;
  }

  console.log('[WEATHER] OpenWeatherMap configured -- live weather polling enabled');

  // Delay first poll by 15 seconds to let AIS positions load
  setTimeout(function() { pollNow(); }, 15000);

  // Schedule every 30 minutes
  var intervalMinutes = Math.round(config.weather.pollIntervalMs / 60000);
  cron.schedule('*/' + intervalMinutes + ' * * * *', function() { pollNow(); });
}

async function pollNow() {
  if (!provider.isConfigured()) return;

  var updated = 0;
  var skipped = 0;
  var failed = 0;

  // Re-read API key in case it was set after initial construction
  if (!provider.apiKey && process.env.OPENWEATHERMAP_API_KEY) {
    provider.apiKey = process.env.OPENWEATHERMAP_API_KEY;
  }

  for (var v of vessels) {
    // Use live AIS position if available, otherwise fall back to vessels.json
    var aisPos = aisCache.get(v.imo);
    var lat = aisPos ? aisPos.lat : v.lat;
    var lon = aisPos ? aisPos.lon : v.lng;

    if (lat == null || lon == null) { skipped++; continue; }

    var weather = await provider.getWeather(lat, lon);
    if (weather) {
      weatherCache.set(v.imo, { data: weather, updatedAt: Date.now() });
      updated++;
    } else {
      failed++;
    }
    // 150ms delay between requests (stay within free tier rate limits)
    await new Promise(function(resolve) { setTimeout(resolve, 150); });
  }

  console.log('[WEATHER] Poll complete: ' + updated + '/' + vessels.length + ' updated' + (failed ? ', ' + failed + ' failed' : '') + (skipped ? ', ' + skipped + ' no coords' : ''));
  broadcastWeather();
}

function broadcastWeather() {
  if (!wsService) return;
  var weatherData = {};
  for (var entry of weatherCache) {
    weatherData[entry[0]] = entry[1].data;
  }
  wsService.broadcast('weather', weatherData);
}

function getWeather(imo) {
  var entry = weatherCache.get(imo);
  return entry ? entry.data : null;
}

function getAllWeather() {
  var result = {};
  for (var entry of weatherCache) {
    result[entry[0]] = entry[1].data;
  }
  return result;
}

module.exports = { init, pollNow, getWeather, getAllWeather };
