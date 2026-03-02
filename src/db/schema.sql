-- BIHAR SENTINEL Database Schema
-- SQLite with WAL mode for concurrent reads

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL DEFAULT 'readonly',  -- admin | dpa | operations | readonly | master
    display_name    TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    last_login      TEXT,
    locked_until    TEXT,
    failed_attempts INTEGER DEFAULT 0
);

-- Vessel positions from AIS
CREATE TABLE IF NOT EXISTS vessel_positions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vessel_imo      TEXT NOT NULL,
    lat             REAL NOT NULL,
    lon             REAL NOT NULL,
    sog             REAL,
    cog             REAL,
    heading         REAL,
    draught         REAL,
    nav_status      TEXT,
    destination     TEXT,
    eta             TEXT,
    ais_timestamp   DATETIME NOT NULL,
    received_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    source          TEXT
);

-- Security incidents
CREATE TABLE IF NOT EXISTS incidents (
    id              TEXT PRIMARY KEY,
    timestamp       DATETIME NOT NULL,
    lat             REAL NOT NULL,
    lon             REAL NOT NULL,
    type            TEXT NOT NULL,
    severity        INTEGER NOT NULL,
    title           TEXT NOT NULL,
    description     TEXT,
    source          TEXT NOT NULL,
    source_ref      TEXT,
    verified        BOOLEAN DEFAULT FALSE,
    target_vessel   TEXT,
    target_imo      TEXT,
    target_type     TEXT,
    target_flag     TEXT,
    result          TEXT,
    weapon_type     TEXT,
    attributed_to   TEXT,
    corridor        TEXT,
    expiry_hours    INTEGER DEFAULT 168,
    status          TEXT DEFAULT 'active',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by      TEXT DEFAULT 'system'
);

-- Incident update log
CREATE TABLE IF NOT EXISTS incident_updates (
    id              TEXT PRIMARY KEY,
    incident_id     TEXT NOT NULL REFERENCES incidents(id),
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
    note            TEXT NOT NULL,
    source          TEXT,
    updated_by      TEXT DEFAULT 'system'
);

-- Proximity alerts
CREATE TABLE IF NOT EXISTS proximity_alerts (
    id              TEXT PRIMARY KEY,
    vessel_imo      TEXT NOT NULL,
    vessel_name     TEXT NOT NULL,
    incident_id     TEXT NOT NULL REFERENCES incidents(id),
    alert_level     TEXT NOT NULL,
    distance_nm     REAL NOT NULL,
    bearing         REAL,
    vessel_lat      REAL NOT NULL,
    vessel_lon      REAL NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME,
    acknowledged_by TEXT,
    status          TEXT DEFAULT 'active'
);

-- JWC zone entry/exit events
CREATE TABLE IF NOT EXISTS jwc_zone_events (
    id              TEXT PRIMARY KEY,
    vessel_imo      TEXT NOT NULL,
    vessel_name     TEXT NOT NULL,
    zone_id         TEXT NOT NULL,
    event_type      TEXT NOT NULL,
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
    lat             REAL NOT NULL,
    lon             REAL NOT NULL
);

-- AIS signal gaps
CREATE TABLE IF NOT EXISTS ais_gaps (
    id              TEXT PRIMARY KEY,
    vessel_imo      TEXT NOT NULL,
    vessel_name     TEXT NOT NULL,
    gap_start       DATETIME NOT NULL,
    gap_end         DATETIME,
    last_known_lat  REAL NOT NULL,
    last_known_lon  REAL NOT NULL,
    in_jwc_zone     BOOLEAN DEFAULT FALSE,
    zone_id         TEXT,
    alert_generated BOOLEAN DEFAULT FALSE,
    duration_minutes INTEGER
);

-- Risk scores per vessel
CREATE TABLE IF NOT EXISTS risk_scores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vessel_imo      TEXT NOT NULL,
    timestamp       DATETIME DEFAULT CURRENT_TIMESTAMP,
    composite_score INTEGER NOT NULL,
    proximity_score INTEGER,
    corridor_score  INTEGER,
    jwc_score       INTEGER,
    ais_score       INTEGER,
    vulnerability   INTEGER,
    historical_score INTEGER,
    risk_level      TEXT
);

-- Corridor status
CREATE TABLE IF NOT EXISTS corridor_status (
    corridor_id     TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    status          TEXT NOT NULL,
    incident_count_7d INTEGER DEFAULT 0,
    incident_count_prev_7d INTEGER DEFAULT 0,
    trend           TEXT,
    bihar_vessels_count INTEGER DEFAULT 0,
    last_incident_date DATETIME,
    last_incident_type TEXT,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insurer notices
CREATE TABLE IF NOT EXISTS insurer_notices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    notice_type     TEXT NOT NULL,
    vessel_imo      TEXT NOT NULL,
    vessel_name     TEXT NOT NULL,
    trigger_event   TEXT NOT NULL,
    trigger_timestamp TEXT NOT NULL,
    generated_at    TEXT NOT NULL,
    due_by          TEXT,
    status          TEXT NOT NULL,
    reviewed_by     TEXT,
    reviewed_at     TEXT,
    sent_at         TEXT,
    sent_to         TEXT,
    notice_content  TEXT NOT NULL,
    pdf_path        TEXT,
    dismiss_reason  TEXT,
    policy_ref      TEXT,
    zone_id         TEXT,
    incident_id     TEXT REFERENCES incidents(id)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON incidents(timestamp);
CREATE INDEX IF NOT EXISTS idx_incidents_corridor ON incidents(corridor);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_positions_imo ON vessel_positions(vessel_imo);
CREATE INDEX IF NOT EXISTS idx_positions_time ON vessel_positions(ais_timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_vessel ON proximity_alerts(vessel_imo);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON proximity_alerts(status);
CREATE INDEX IF NOT EXISTS idx_jwc_vessel ON jwc_zone_events(vessel_imo);
CREATE INDEX IF NOT EXISTS idx_risk_vessel ON risk_scores(vessel_imo);
CREATE INDEX IF NOT EXISTS idx_gaps_vessel ON ais_gaps(vessel_imo);
CREATE INDEX IF NOT EXISTS idx_notices_status ON insurer_notices(status);
CREATE INDEX IF NOT EXISTS idx_notices_vessel ON insurer_notices(vessel_imo);
CREATE INDEX IF NOT EXISTS idx_notices_type ON insurer_notices(notice_type);
CREATE INDEX IF NOT EXISTS idx_notices_date ON insurer_notices(generated_at);
