-- Migration 002: Incident Enrichment

ALTER TABLE incidents ADD COLUMN lifecycle_status TEXT DEFAULT 'REPORTED';
ALTER TABLE incidents ADD COLUMN impact_area TEXT;
ALTER TABLE incidents ADD COLUMN confidence_score REAL DEFAULT 50;
ALTER TABLE incidents ADD COLUMN source_reliability TEXT DEFAULT 'UNKNOWN';
ALTER TABLE incidents ADD COLUMN casualty_type TEXT;
ALTER TABLE incidents ADD COLUMN casualty_count INTEGER DEFAULT 0;
ALTER TABLE incidents ADD COLUMN vessel_damage TEXT;
ALTER TABLE incidents ADD COLUMN environmental_impact TEXT;
ALTER TABLE incidents ADD COLUMN cargo_impact TEXT;
ALTER TABLE incidents ADD COLUMN attack_method TEXT;
ALTER TABLE incidents ADD COLUMN suspect_actor_type TEXT;
ALTER TABLE incidents ADD COLUMN evidence_sources TEXT;
ALTER TABLE incidents ADD COLUMN related_incident_ids TEXT;
ALTER TABLE incidents ADD COLUMN impact_radius_nm REAL;
ALTER TABLE incidents ADD COLUMN recommended_clearance_nm REAL DEFAULT 50;
ALTER TABLE incidents ADD COLUMN escalation_potential TEXT DEFAULT 'UNKNOWN';

CREATE TABLE IF NOT EXISTS threat_sources (
    id                    TEXT PRIMARY KEY,
    name                  TEXT NOT NULL UNIQUE,
    type                  TEXT NOT NULL,
    url                   TEXT,
    reliability_score     REAL DEFAULT 50,
    total_reports         INTEGER DEFAULT 0,
    confirmed_reports     INTEGER DEFAULT 0,
    false_reports         INTEGER DEFAULT 0,
    last_poll_at          TEXT,
    last_success_at       TEXT,
    poll_interval_minutes INTEGER DEFAULT 5,
    enabled               INTEGER DEFAULT 1,
    config                TEXT,
    created_at            TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS threat_actors (
    id                  TEXT PRIMARY KEY,
    name                TEXT NOT NULL,
    type                TEXT NOT NULL,
    description         TEXT,
    known_ttps          TEXT,
    active_regions      TEXT,
    threat_level        TEXT DEFAULT 'UNKNOWN',
    last_activity_date  TEXT,
    incident_count      INTEGER DEFAULT 0,
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT
);

CREATE TABLE IF NOT EXISTS incident_actors (
    incident_id TEXT NOT NULL REFERENCES incidents(id),
    actor_id    TEXT NOT NULL REFERENCES threat_actors(id),
    confidence  TEXT DEFAULT 'SUSPECTED',
    PRIMARY KEY (incident_id, actor_id)
);

CREATE INDEX IF NOT EXISTS idx_incidents_lifecycle ON incidents(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_incidents_confidence ON incidents(confidence_score);
CREATE INDEX IF NOT EXISTS idx_threat_sources_name ON threat_sources(name);
