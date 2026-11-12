-- Early-access sign-ups. One row per person: contact_key is the lower-cased email,
-- or the last 10 digits of a phone number, so "+91 98765 43210" and "9876543210" match.
CREATE TABLE signups (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_key    TEXT NOT NULL UNIQUE,
  name           TEXT NOT NULL,
  contact        TEXT NOT NULL,
  contact_type   TEXT NOT NULL CHECK (contact_type IN ('email', 'phone')),
  mode           TEXT,
  clients        TEXT,
  page           TEXT,
  referrer       TEXT,
  source         TEXT NOT NULL DEFAULT 'form',      -- 'form' or 'sheet'
  created_at     TEXT NOT NULL,                     -- UTC, ISO 8601 (storage only; never shown)
  updated_at     TEXT NOT NULL,
  -- Push to Loops: 'pending' → 'synced', or 'skipped' (no email / already followed up by hand)
  -- or 'failed' after too many attempts.
  loops_status   TEXT NOT NULL DEFAULT 'pending'
                 CHECK (loops_status IN ('pending', 'synced', 'skipped', 'failed')),
  loops_attempts INTEGER NOT NULL DEFAULT 0,
  loops_synced_at TEXT,
  loops_error    TEXT
);

CREATE INDEX signups_loops_queue ON signups (loops_status, id);
