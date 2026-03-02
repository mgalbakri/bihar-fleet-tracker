// In-memory AIS position cache with TTL

class AISCache {
  constructor() {
    this.cache = new Map();
  }

  get(imo) {
    const entry = this.cache.get(imo);
    if (!entry) return null;
    return entry.position;
  }

  set(imo, position) {
    this.cache.set(imo, {
      position,
      updatedAt: Date.now()
    });
  }

  isStale(imo, thresholdMinutes) {
    const entry = this.cache.get(imo);
    if (!entry) return true;
    const ageMs = Date.now() - entry.updatedAt;
    return ageMs > thresholdMinutes * 60 * 1000;
  }

  getAll() {
    const result = [];
    for (const [imo, entry] of this.cache) {
      result.push({ imo, ...entry.position, cacheAge: Date.now() - entry.updatedAt });
    }
    return result;
  }

  size() {
    return this.cache.size;
  }
}

module.exports = new AISCache();
