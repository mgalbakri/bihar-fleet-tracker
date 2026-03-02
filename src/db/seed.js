const db = require('./database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

function seedAdminUser() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (existing.count > 0) return;

  const adminPassword = process.env.ADMIN_PASSWORD || 'SentinelAdmin2026!';
  const hash = bcrypt.hashSync(adminPassword, 10);

  db.prepare(`
    INSERT INTO users (id, email, password_hash, display_name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), 'admin@bihar.com', hash, 'System Admin', 'admin');

  console.log('[SEED] Admin user created: admin@bihar.com');
}

function seedCorridors() {
  const corridors = [
    { id: 'HORMUZ', name: 'Strait of Hormuz' },
    { id: 'BAB_EL_MANDEB', name: 'Bab el-Mandeb' },
    { id: 'GULF_OF_ADEN', name: 'Gulf of Aden' },
    { id: 'SUEZ_APPROACH', name: 'Suez Approach' },
    { id: 'ARABIAN_SEA', name: 'Arabian Sea' },
    { id: 'SOMALI_BASIN', name: 'Somali Basin' }
  ];

  // Corridor threat levels reflect current situation (Mar 2026)
  const corridorStatus = {
    HORMUZ: { status: 'RED', incidents: 6, trend: 'WORSENING' },
    BAB_EL_MANDEB: { status: 'RED', incidents: 4, trend: 'STABLE' },
    GULF_OF_ADEN: { status: 'AMBER', incidents: 2, trend: 'STABLE' },
    SUEZ_APPROACH: { status: 'AMBER', incidents: 1, trend: 'STABLE' },
    ARABIAN_SEA: { status: 'AMBER', incidents: 1, trend: 'STABLE' },
    SOMALI_BASIN: { status: 'GREEN', incidents: 0, trend: 'STABLE' }
  };

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO corridor_status (corridor_id, name, status, incident_count_7d, trend, bihar_vessels_count)
    VALUES (?, ?, ?, ?, ?, 0)
  `);

  const insertMany = db.transaction((corridors) => {
    for (const c of corridors) {
      const s = corridorStatus[c.id] || { status: 'GREEN', incidents: 0, trend: 'STABLE' };
      stmt.run(c.id, c.name, s.status, s.incidents, s.trend);
    }
  });

  insertMany(corridors);
  console.log('[SEED] Corridors seeded:', corridors.length);
}

function seedSampleIncidents() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM incidents').get();
  if (existing.count > 0) return;

  const incidents = [
    {
      id: uuidv4(), timestamp: '2026-02-25T14:30:00Z',
      lat: 13.42, lon: 42.75, type: 'DRONE_ATTACK',
      severity: 4, title: 'UAV attack on merchant vessel near Bab el-Mandeb',
      description: 'Unmanned aerial vehicle struck a bulk carrier 15nm south of Bab el-Mandeb strait. Minor damage reported, crew safe.',
      source: 'UKMTO', source_ref: 'UKMTO-2026-0234', verified: 1,
      target_vessel: 'MV STAR FORTUNE', target_flag: 'Liberia',
      result: 'hit_damage', weapon_type: 'UAV', attributed_to: 'Houthi/Ansar Allah',
      corridor: 'BAB_EL_MANDEB', status: 'active'
    },
    {
      id: uuidv4(), timestamp: '2026-02-26T08:15:00Z',
      lat: 14.85, lon: 42.23, type: 'MISSILE_ATTACK',
      severity: 5, title: 'ASBM launch detected targeting vessel in Red Sea',
      description: 'Anti-ship ballistic missile launch detected from Yemen coast. Missile landed in water approximately 500m from vessel.',
      source: 'CENTCOM', source_ref: 'CENTCOM-2026-0089', verified: 1,
      target_vessel: 'MT PACIFIC VOYAGER', target_flag: 'Panama',
      result: 'near_miss', weapon_type: 'ASBM', attributed_to: 'Houthi/Ansar Allah',
      corridor: 'BAB_EL_MANDEB', status: 'active'
    },
    {
      id: uuidv4(), timestamp: '2026-02-27T03:45:00Z',
      lat: 26.15, lon: 56.45, type: 'SUSPICIOUS_APPROACH',
      severity: 2, title: 'Fast craft approach in Strait of Hormuz',
      description: 'Multiple fast craft approached commercial vessel at high speed in Hormuz TSS. Vessels diverted after warning.',
      source: 'UKMTO', source_ref: 'UKMTO-2026-0237', verified: 1,
      corridor: 'HORMUZ', status: 'active'
    },
    {
      id: uuidv4(), timestamp: '2026-02-27T11:20:00Z',
      lat: 12.58, lon: 43.85, type: 'DRONE_ATTACK',
      severity: 3, title: 'UAV sighted over Gulf of Aden shipping lane',
      description: 'Reconnaissance UAV observed circling above IRTC recommended corridor. No weapons deployed.',
      source: 'MARAD', source_ref: 'MARAD-2026-005', verified: 0,
      weapon_type: 'UAV', attributed_to: 'Houthi/Ansar Allah',
      corridor: 'GULF_OF_ADEN', status: 'active'
    },
    {
      id: uuidv4(), timestamp: '2026-02-28T06:00:00Z',
      lat: 15.92, lon: 41.78, type: 'ADVISORY',
      severity: 2, title: 'MARAD advisory: increased threat level southern Red Sea',
      description: 'US MARAD advisory warning of heightened threat to commercial shipping in southern Red Sea. Vessels advised to exercise extreme caution.',
      source: 'MARAD', source_ref: 'MARAD-2026-006', verified: 1,
      corridor: 'BAB_EL_MANDEB', status: 'active'
    },
    // === Strait of Hormuz attacks -- 1-2 March 2026 ===
    {
      id: uuidv4(), timestamp: '2026-03-01T08:30:00Z',
      lat: 26.18, lon: 56.25, type: 'MISSILE_ATTACK',
      severity: 5, title: 'Oil tanker SKYLIGHT struck near Khasab Port, Strait of Hormuz',
      description: 'Palau-flagged oil tanker SKYLIGHT attacked approximately 5nm north of Khasab Port in the Strait of Hormuz. All 20 crew members evacuated. Vessel sustained significant damage.',
      source: 'UKMTO', source_ref: 'UKMTO-2026-0250', verified: 1,
      target_vessel: 'SKYLIGHT', target_flag: 'Palau',
      result: 'hit_damage', weapon_type: 'MISSILE', attributed_to: 'Iran/IRGCN',
      corridor: 'HORMUZ', status: 'active'
    },
    {
      id: uuidv4(), timestamp: '2026-03-01T11:50:00Z',
      lat: 26.35, lon: 56.48, type: 'MISSILE_ATTACK',
      severity: 5, title: 'MV MKD VYON struck off Oman coast -- 1 crew killed',
      description: 'MKD VYON struck at 11:50 off the coast of Oman. Vessel sustained damage above the waterline with water ingress in the engine room. One crew member trapped in the engine room confirmed dead.',
      source: 'UKMTO', source_ref: 'UKMTO-2026-0251', verified: 1,
      target_vessel: 'MKD VYON', target_flag: 'Unknown',
      result: 'hit_sunk', weapon_type: 'MISSILE', attributed_to: 'Iran/IRGCN',
      corridor: 'HORMUZ', status: 'active'
    },
    {
      id: uuidv4(), timestamp: '2026-03-01T14:15:00Z',
      lat: 26.42, lon: 56.55, type: 'DRONE_ATTACK',
      severity: 4, title: 'Greek-owned OCEAN ELECTRA struck by drone in Hormuz',
      description: 'Greek-owned vessel OCEAN ELECTRA struck by drone or missile in the Strait of Hormuz. No injuries or major structural damage reported. Vessel proceeding toward safe port.',
      source: 'UKMTO', source_ref: 'UKMTO-2026-0252', verified: 1,
      target_vessel: 'OCEAN ELECTRA', target_flag: 'Greece',
      result: 'hit_damage', weapon_type: 'UAV', attributed_to: 'Iran/IRGCN',
      corridor: 'HORMUZ', status: 'active'
    },
    {
      id: uuidv4(), timestamp: '2026-03-01T16:00:00Z',
      lat: 25.95, lon: 56.10, type: 'MISSILE_ATTACK',
      severity: 4, title: 'Spanish-flagged HERCULES STAR struck 20nm off UAE coast',
      description: 'Hercules Star, a Spanish-flagged vessel, struck approximately 20 nautical miles off the coast of the UAE in the Strait of Hormuz approaches.',
      source: 'CENTCOM', source_ref: 'CENTCOM-2026-0095', verified: 1,
      target_vessel: 'HERCULES STAR', target_flag: 'Spain',
      result: 'hit_damage', weapon_type: 'MISSILE', attributed_to: 'Iran/IRGCN',
      corridor: 'HORMUZ', status: 'active'
    },
    {
      id: uuidv4(), timestamp: '2026-03-01T18:00:00Z',
      lat: 26.60, lon: 56.70, type: 'MILITARY_ACTION',
      severity: 5, title: 'US forces sink Iranian destroyer Jamaran in Hormuz',
      description: 'US Central Command confirmed destruction of Iranian Navy destroyer Jamaran during Operation Epic Fury. The vessel sank with approximately 80 crew members on board. Part of broader US strikes against 9 Iranian naval vessels.',
      source: 'CENTCOM', source_ref: 'CENTCOM-2026-0096', verified: 1,
      result: 'sunk', weapon_type: 'NAVAL_STRIKE', attributed_to: 'US Navy/CENTCOM',
      corridor: 'HORMUZ', status: 'active'
    },
    {
      id: uuidv4(), timestamp: '2026-03-02T00:00:00Z',
      lat: 26.30, lon: 56.40, type: 'ADVISORY',
      severity: 5, title: 'CRITICAL: Strait of Hormuz traffic halted -- multiple vessel attacks',
      description: 'Four commercial vessels struck in the Strait of Hormuz on 1 March 2026 amid escalating Iran-US-Israel tensions. Hormuz traffic effectively halted. All commercial vessels advised to avoid transit until further notice.',
      source: 'MARAD', source_ref: 'MARAD-2026-010', verified: 1,
      corridor: 'HORMUZ', status: 'active'
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO incidents (id, timestamp, lat, lon, type, severity, title, description, source, source_ref, verified, target_vessel, target_flag, result, weapon_type, attributed_to, corridor, status)
    VALUES (@id, @timestamp, @lat, @lon, @type, @severity, @title, @description, @source, @source_ref, @verified, @target_vessel, @target_flag, @result, @weapon_type, @attributed_to, @corridor, @status)
  `);

  const insertMany = db.transaction((incidents) => {
    for (const inc of incidents) {
      stmt.run({
        id: inc.id, timestamp: inc.timestamp, lat: inc.lat, lon: inc.lon,
        type: inc.type, severity: inc.severity, title: inc.title,
        description: inc.description, source: inc.source, source_ref: inc.source_ref,
        verified: inc.verified || 0, target_vessel: inc.target_vessel || null,
        target_flag: inc.target_flag || null, result: inc.result || null,
        weapon_type: inc.weapon_type || null, attributed_to: inc.attributed_to || null,
        corridor: inc.corridor || null, status: inc.status
      });
    }
  });

  insertMany(incidents);
  console.log('[SEED] Sample incidents seeded:', incidents.length);
}

function seedHistoricalIncidents() {
  // Only seed if we have fewer than 20 incidents (initial seed + 5 existing)
  const existing = db.prepare('SELECT COUNT(*) as count FROM incidents').get();
  if (existing.count > 20) return;

  // Historical incidents for heatmap density -- based on real attack patterns in the region
  const historical = [
    // Bab el-Mandeb cluster (highest density)
    { lat: 13.10, lon: 42.90, type: 'DRONE_ATTACK', sev: 4, days: 5 },
    { lat: 13.25, lon: 42.60, type: 'MISSILE_ATTACK', sev: 5, days: 8 },
    { lat: 13.50, lon: 42.40, type: 'DRONE_ATTACK', sev: 3, days: 12 },
    { lat: 13.35, lon: 43.10, type: 'MISSILE_ATTACK', sev: 4, days: 15 },
    { lat: 13.18, lon: 42.80, type: 'DRONE_ATTACK', sev: 4, days: 20 },
    { lat: 13.60, lon: 42.55, type: 'MILITARY_ACTION', sev: 3, days: 25 },
    { lat: 13.05, lon: 43.20, type: 'DRONE_ATTACK', sev: 3, days: 30 },
    { lat: 13.40, lon: 42.70, type: 'MISSILE_ATTACK', sev: 5, days: 35 },
    { lat: 13.22, lon: 42.95, type: 'DRONE_ATTACK', sev: 4, days: 40 },
    { lat: 12.95, lon: 43.30, type: 'SUSPICIOUS_APPROACH', sev: 2, days: 45 },
    { lat: 13.30, lon: 42.50, type: 'MISSILE_ATTACK', sev: 4, days: 55 },
    { lat: 13.15, lon: 43.05, type: 'DRONE_ATTACK', sev: 3, days: 65 },
    // Red Sea / south of Bab el-Mandeb
    { lat: 14.50, lon: 42.10, type: 'MISSILE_ATTACK', sev: 5, days: 10 },
    { lat: 15.20, lon: 41.80, type: 'DRONE_ATTACK', sev: 4, days: 18 },
    { lat: 14.80, lon: 42.30, type: 'MILITARY_ACTION', sev: 3, days: 28 },
    { lat: 15.60, lon: 41.50, type: 'MISSILE_ATTACK', sev: 4, days: 50 },
    { lat: 14.20, lon: 42.50, type: 'DRONE_ATTACK', sev: 3, days: 70 },
    // Gulf of Aden
    { lat: 12.30, lon: 44.80, type: 'PIRACY', sev: 3, days: 22 },
    { lat: 12.60, lon: 45.50, type: 'SUSPICIOUS_APPROACH', sev: 2, days: 38 },
    { lat: 11.90, lon: 46.20, type: 'PIRACY', sev: 3, days: 60 },
    { lat: 12.10, lon: 47.50, type: 'DRONE_ATTACK', sev: 3, days: 42 },
    { lat: 12.80, lon: 44.20, type: 'MILITARY_ACTION', sev: 3, days: 75 },
    // Hormuz area (escalating tensions Feb-Mar 2026)
    { lat: 26.20, lon: 56.30, type: 'SUSPICIOUS_APPROACH', sev: 2, days: 14 },
    { lat: 26.50, lon: 56.50, type: 'SEIZURE', sev: 4, days: 48 },
    { lat: 25.90, lon: 56.80, type: 'MINE_THREAT', sev: 4, days: 80 },
    { lat: 26.15, lon: 56.35, type: 'MISSILE_ATTACK', sev: 5, days: 3 },
    { lat: 26.40, lon: 56.60, type: 'MILITARY_ACTION', sev: 5, days: 2 },
    // Arabian Sea
    { lat: 15.50, lon: 55.00, type: 'DRONE_ATTACK', sev: 3, days: 32 },
    { lat: 14.00, lon: 52.50, type: 'MISSILE_ATTACK', sev: 4, days: 58 },
    // Somali Basin
    { lat: 5.50, lon: 48.00, type: 'PIRACY', sev: 3, days: 90 },
    { lat: 3.80, lon: 50.20, type: 'PIRACY', sev: 2, days: 120 },
    { lat: 7.20, lon: 49.50, type: 'SUSPICIOUS_APPROACH', sev: 2, days: 150 },
  ];

  const corridorMap = {
    'BAB_EL_MANDEB': [[12.5, 14.0], [42.0, 43.5]],
    'GULF_OF_ADEN': [[11.5, 13.0], [43.5, 48.0]],
    'HORMUZ': [[25.5, 27.0], [56.0, 57.0]],
    'ARABIAN_SEA': [[13.0, 18.0], [50.0, 60.0]],
    'SOMALI_BASIN': [[2.0, 10.0], [45.0, 52.0]]
  };

  function inferCorridor(lat, lon) {
    for (var key in corridorMap) {
      var bounds = corridorMap[key];
      if (lat >= bounds[0][0] && lat <= bounds[0][1] && lon >= bounds[1][0] && lon <= bounds[1][1]) {
        return key;
      }
    }
    return null;
  }

  const stmt = db.prepare(`
    INSERT INTO incidents (id, timestamp, lat, lon, type, severity, title, description, source, source_ref, verified, corridor, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'active')
  `);

  const titles = {
    DRONE_ATTACK: 'UAV attack on commercial vessel',
    MISSILE_ATTACK: 'Anti-ship missile launch detected',
    PIRACY: 'Piracy incident reported',
    MINE_THREAT: 'Possible mine/waterborne IED',
    SEIZURE: 'Vessel seizure or boarding',
    SUSPICIOUS_APPROACH: 'Suspicious approach by unidentified craft',
    MILITARY_ACTION: 'Military activity in shipping lane',
    ADVISORY: 'Navigation advisory issued'
  };

  const sources = ['UKMTO', 'CENTCOM', 'MARAD', 'ACLED'];

  const insertMany = db.transaction(function(items) {
    for (var i = 0; i < items.length; i++) {
      var inc = items[i];
      var ts = new Date(Date.now() - inc.days * 24 * 60 * 60 * 1000).toISOString();
      var src = sources[i % sources.length];
      stmt.run(
        uuidv4(), ts, inc.lat, inc.lon, inc.type, inc.sev,
        titles[inc.type] || 'Security incident',
        'Historical incident data for risk analysis',
        src, src + '-HIST-' + (1000 + i),
        inferCorridor(inc.lat, inc.lon)
      );
    }
  });

  insertMany(historical);
  console.log('[SEED] Historical incidents seeded:', historical.length);
}

function runSeed() {
  seedAdminUser();
  seedCorridors();
  seedSampleIncidents();
  seedHistoricalIncidents();
}

module.exports = { runSeed };
