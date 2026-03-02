// Base class for AIS data providers
// Subclasses implement getVesselPosition and getFleetPositions

class AISProvider {
  constructor(name) {
    this.name = name;
  }

  async getVesselPosition(imo) {
    throw new Error(`${this.name}: getVesselPosition not implemented`);
  }

  async getFleetPositions(imos) {
    throw new Error(`${this.name}: getFleetPositions not implemented`);
  }
}

module.exports = AISProvider;
