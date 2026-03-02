module.exports = {
  port: process.env.PORT || 3000,

  ais: {
    provider: process.env.AIS_PROVIDER || 'datalastic',
    pollIntervalMs: parseInt(process.env.AIS_POLL_INTERVAL_MS) || 5 * 60 * 1000,
    staleThresholdMinutes: 30,
    darkThresholdMinutes: 360,
    darkThresholdMinutesJWC: 30
  },

  weather: {
    pollIntervalMs: 30 * 60 * 1000
  },

  threat: {
    pollIntervalMs: 5 * 60 * 1000
  },

  news: {
    pollIntervalMs: 15 * 60 * 1000
  },

  proximity: {
    tiers: {
      DANGER: 10,
      CRITICAL: 25,
      WARNING: 50,
      WATCH: 100
    }
  },

  risk: {
    weights: {
      proximity: 0.30,
      corridor: 0.25,
      jwcPresence: 0.15,
      aisHealth: 0.15,
      vulnerability: 0.10,
      historical: 0.05
    }
  },

  corridors: {
    statusThresholds: {
      GREEN: { maxIncidents7d: 0 },
      AMBER: { maxIncidents7d: 3 },
      RED: { maxIncidents7d: 7 },
      BLACK: { minIncidents7d: 8 }
    }
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    accessExpiresIn: '15m',
    refreshExpiresIn: '24h'
  },

  websocket: {
    heartbeatIntervalMs: 30000
  }
};
