// OpenWeatherMap API adapter

class OpenWeatherMapProvider {
  constructor() {
    this.apiKey = process.env.OPENWEATHERMAP_API_KEY;
    this.baseUrl = 'https://api.openweathermap.org/data/2.5/weather';
  }

  isConfigured() {
    // Re-check env var in case it was set after construction
    if (!this.apiKey) this.apiKey = process.env.OPENWEATHERMAP_API_KEY;
    return !!this.apiKey && this.apiKey !== 'your-owm-api-key';
  }

  async getWeather(lat, lon) {
    if (!this.isConfigured()) return null;

    const url = `${this.baseUrl}?lat=${lat}&lon=${lon}&units=metric&appid=${this.apiKey}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        var body = '';
        try { body = await response.text(); } catch (e) {}
        console.error('[WEATHER] API error ' + response.status + ' for ' + lat + ',' + lon + ': ' + body.slice(0, 200));
        return null;
      }

      const data = await response.json();
      return {
        temp: Math.round(data.main.temp),
        condition: data.weather[0].main,
        description: data.weather[0].description,
        wind: Math.round(data.wind.speed * 1.944), // m/s to knots
        windDir: data.wind.deg,
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        visibility: data.visibility ? Math.round(data.visibility / 1000) : null,
        icon: this._mapIcon(data.weather[0].id),
        source: 'openweathermap',
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      console.error(`[WEATHER] Fetch error for ${lat},${lon}:`, err.message);
      return null;
    }
  }

  _mapIcon(conditionCode) {
    if (conditionCode >= 200 && conditionCode < 300) return '\u26C8\uFE0F';  // thunderstorm
    if (conditionCode >= 300 && conditionCode < 400) return '\uD83C\uDF27\uFE0F';  // drizzle
    if (conditionCode >= 500 && conditionCode < 600) return '\uD83C\uDF27\uFE0F';  // rain
    if (conditionCode >= 600 && conditionCode < 700) return '\u2744\uFE0F';  // snow
    if (conditionCode >= 700 && conditionCode < 800) return '\uD83C\uDF2B\uFE0F';  // fog/mist
    if (conditionCode === 800) return '\u2600\uFE0F';  // clear
    if (conditionCode === 801) return '\u26C5';  // few clouds
    if (conditionCode >= 802) return '\u2601\uFE0F';  // cloudy
    return '\u2600\uFE0F';
  }
}

module.exports = OpenWeatherMapProvider;
