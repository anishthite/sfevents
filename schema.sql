CREATE TABLE IF NOT EXISTS events (
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  title TEXT NOT NULL,
  start_at TEXT,
  end_at TEXT,
  timezone TEXT,
  location TEXT,
  image_url TEXT,
  rsvp_status TEXT,
  sources TEXT NOT NULL,
  raw TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (source, source_id)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  event_count INTEGER,
  error TEXT,
  finished_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_start_at ON events(start_at);
