// port-coords.js -- Backend port coordinate lookup for simulation engine
// BIHAR SENTINEL

const PORT_COORDINATES = {
  // UAE
  'FUJAIRAH':     [25.12, 56.35],
  'JEBEL ALI':    [25.01, 55.06],
  'RUWAIS':       [24.11, 52.73],
  'KHOR FAKKAN':  [25.34, 56.35],

  // Saudi Arabia
  'JEDDAH':       [21.48, 39.17],
  'JUBAIL':       [27.00, 49.66],
  'RAS TANURA':   [26.64, 50.16],
  'YANBU':        [24.09, 38.06],
  'SHOAIBA':      [20.67, 39.50],
  'RABIGH':       [22.79, 39.02],

  // India
  'MUNDRA':       [22.74, 69.72],
  'KANDLA':       [23.03, 70.22],
  'PIPAVAV':      [20.91, 71.52],
  'MUMBAI':       [18.95, 72.84],
  'COCHIN':       [9.97, 76.27],
  'CHENNAI':      [13.08, 80.29],

  // Singapore & SE Asia
  'SINGAPORE':    [1.27, 103.82],
  'PORT KLANG':   [3.00, 101.39],
  'TANJUNG BURAS':[2.35, 111.83],
  'PENANG':       [5.42, 100.35],
  'PRAI':         [5.38, 100.39],
  'HO CHI MINH':  [10.77, 106.71],

  // East Asia
  'SHANGHAI':     [31.36, 121.62],
  'YOKOHAMA':     [35.44, 139.64],
  'SHENAO':       [25.13, 121.82],
  'KAOHSIUNG':    [22.62, 120.27],
  'BUSAN':        [35.10, 129.04],

  // Mediterranean
  'VENICE':       [45.42, 12.34],
  'AUGUSTA':      [37.23, 15.22],
  'SINES':        [37.95, -8.87],
  'ALGECIRAS':    [36.13, -5.43],

  // Red Sea & Egypt
  'SUEZ STS':     [29.97, 32.55],
  'SUEZ':         [29.97, 32.55],
  'AQABA':        [29.52, 35.01],
  'PORT SUDAN':   [19.62, 37.22],

  // East Africa
  'DURBAN':       [-29.86, 31.02],
  'MOMBASA':      [-4.04, 39.67],
  'DAR ES SALAAM':[-6.83, 39.29],

  // Europe
  'ANTWERP':      [51.22, 4.40],
  'ROTTERDAM':    [51.90, 4.50],
  'HOUSTON':      [29.73, -95.02],

  // Persian Gulf
  'BAHRAIN':      [26.23, 50.55],
  'KUWAIT':       [29.34, 47.96],
  'BASRA':        [30.50, 47.82],
  'BANDAR ABBAS': [27.18, 56.28],
  'SOHAR':        [24.36, 56.74],

  // Oman
  'MUSCAT':       [23.61, 58.54],
  'SALALAH':      [16.94, 54.00]
};

/**
 * Look up port coordinates by name.
 * Returns [lat, lng] or null if not found.
 */
function getDestinationCoords(destination) {
  if (!destination) return null;
  const key = destination.toUpperCase().trim();
  if (key === 'DRY DOCK' || key === 'ORDERS' || key === 'IN PORT' || key === '-' || key === 'AWAITING') return null;
  return PORT_COORDINATES[key] || null;
}

module.exports = { PORT_COORDINATES, getDestinationCoords };
