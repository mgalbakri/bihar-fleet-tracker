const AISProvider = require('./ais-provider');

class DatalasticProvider extends AISProvider {
  constructor() {
    super('Datalastic');
    this.apiKey = process.env.DATALASTIC_API_KEY;
    this.baseUrl = 'https://api.datalastic.com/api/v0';
  }

  isConfigured() {
    if (!this.apiKey) this.apiKey = process.env.DATALASTIC_API_KEY;
    return !!this.apiKey && this.apiKey !== 'your-datalastic-api-key';
  }

  async getVesselPosition(imo) {
    if (!this.isConfigured()) return null;

    const url = `${this.baseUrl}/vessel_pro?api-key=${this.apiKey}&imo=${imo}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`[AIS:Datalastic] Rate limited for IMO ${imo}`);
          return null;
        }
        console.error(`[AIS:Datalastic] HTTP ${response.status} for IMO ${imo}`);
        return null;
      }

      const data = await response.json();
      if (!data || !data.data) return null;

      const v = data.data;
      return {
        imo: imo,
        mmsi: v.mmsi || null,
        lat: parseFloat(v.lat) || null,
        lon: parseFloat(v.lon) || null,
        sog: parseFloat(v.speed) || 0,
        cog: parseFloat(v.course) || 0,
        heading: parseFloat(v.heading) || null,
        draught: parseFloat(v.current_draught) || null,
        navStatus: v.navigation_status || null,
        destination: v.destination || null,
        eta: v.eta_UTC || null,
        shipName: v.name || null,
        shipType: v.type_specific || v.type || null,
        aisTimestamp: v.last_position_epoch
          ? new Date(v.last_position_epoch * 1000).toISOString()
          : new Date().toISOString(),
        source: 'datalastic'
      };
    } catch (err) {
      console.error(`[AIS:Datalastic] Fetch error for IMO ${imo}:`, err.message);
      return null;
    }
  }

  async getFleetPositions(imos) {
    if (!this.isConfigured()) return [];

    const results = [];
    for (const imo of imos) {
      const position = await this.getVesselPosition(imo);
      if (position) results.push(position);
      // 200ms delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    return results;
  }
}

module.exports = DatalasticProvider;
