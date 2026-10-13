ALTER TABLE events ADD COLUMN first_seen_at TEXT;
UPDATE events SET first_seen_at = updated_at WHERE first_seen_at IS NULL;
