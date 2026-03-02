-- Migration 001: Recommendation Engine Tables

CREATE TABLE IF NOT EXISTS recommendations (
    id                    TEXT PRIMARY KEY,
    vessel_imo            TEXT NOT NULL,
    incident_id           TEXT,
    risk_score            REAL,
    urgency               TEXT NOT NULL CHECK(urgency IN ('IMMEDIATE','URGENT','HIGH','MEDIUM')),
    action_type           TEXT NOT NULL CHECK(action_type IN ('DIVERT_PORT','REDUCE_SPEED','MAINTAIN_COURSE','REQUEST_ESCORT','CHANGE_ROUTE','INCREASE_WATCH','EMERGENCY_PROCEDURES','RADIO_CONTACT','AVOID_AREA')),
    recommendation_text   TEXT NOT NULL,
    rationale             TEXT,
    suggested_actions     TEXT,
    alternative_ports     TEXT,
    estimated_delay_hours REAL,
    confidence_score      REAL,
    status                TEXT DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ACKNOWLEDGED','EXECUTING','COMPLETED','DISMISSED','SUPERSEDED')),
    created_at            TEXT DEFAULT (datetime('now')),
    acknowledged_at       TEXT,
    acknowledged_by       TEXT,
    executed_at           TEXT,
    outcome               TEXT,
    outcome_notes         TEXT
);

CREATE TABLE IF NOT EXISTS response_actions (
    id                  TEXT PRIMARY KEY,
    recommendation_id   TEXT NOT NULL REFERENCES recommendations(id),
    vessel_imo          TEXT NOT NULL,
    action_taken        TEXT NOT NULL,
    taken_by            TEXT,
    taken_at            TEXT DEFAULT (datetime('now')),
    notes               TEXT,
    outcome             TEXT
);

CREATE INDEX IF NOT EXISTS idx_recommendations_vessel ON recommendations(vessel_imo);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_urgency ON recommendations(urgency);
CREATE INDEX IF NOT EXISTS idx_recommendations_created ON recommendations(created_at);
CREATE INDEX IF NOT EXISTS idx_response_actions_rec ON response_actions(recommendation_id);
