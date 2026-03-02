-- Migration 003: Enhanced Notice System

CREATE TABLE IF NOT EXISTS notice_recipients (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    email        TEXT NOT NULL,
    role         TEXT NOT NULL CHECK(role IN ('INSURER','BROKER','P_AND_I','DPA','MASTER','OPERATIONS','BOARD')),
    company      TEXT,
    vessel_imo   TEXT,
    notice_types TEXT,
    active       INTEGER DEFAULT 1,
    created_at   TEXT DEFAULT (datetime('now')),
    updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS notice_deliveries (
    id              TEXT PRIMARY KEY,
    notice_id       INTEGER NOT NULL,
    recipient_id    TEXT NOT NULL REFERENCES notice_recipients(id),
    recipient_email TEXT NOT NULL,
    method          TEXT DEFAULT 'EMAIL',
    status          TEXT DEFAULT 'QUEUED',
    attempt_count   INTEGER DEFAULT 0,
    last_attempt_at TEXT,
    sent_at         TEXT,
    error_message   TEXT,
    message_id      TEXT
);

CREATE TABLE IF NOT EXISTS notice_templates (
    id                 TEXT PRIMARY KEY,
    notice_type        TEXT NOT NULL,
    name               TEXT NOT NULL,
    subject_template   TEXT NOT NULL,
    body_html_template TEXT NOT NULL,
    body_text_template TEXT NOT NULL,
    version            INTEGER DEFAULT 1,
    active             INTEGER DEFAULT 1,
    created_at         TEXT DEFAULT (datetime('now')),
    updated_at         TEXT
);

CREATE INDEX IF NOT EXISTS idx_notice_recipients_role ON notice_recipients(role);
CREATE INDEX IF NOT EXISTS idx_notice_deliveries_notice ON notice_deliveries(notice_id);
CREATE INDEX IF NOT EXISTS idx_notice_deliveries_status ON notice_deliveries(status);
