-- ============================================================
-- Automated similarity candidates (read-only, shared across users)
-- ============================================================
-- These come from the old Mini's 114 surah-NNN.js files.
-- Anyone can SELECT; only the service role can INSERT/UPDATE/DELETE.

CREATE TABLE IF NOT EXISTS automated_groups (
  id           bigserial PRIMARY KEY,
  legacy_id    text,                 -- original numeric id from automated-data.js
  title        text NOT NULL,
  color        text DEFAULT '#888',
  surahs       text[] DEFAULT '{}',
  payload      jsonb NOT NULL,        -- full { verses, note, unote, etc. } blob
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automated_groups_legacy_idx ON automated_groups (legacy_id);
CREATE INDEX IF NOT EXISTS automated_groups_surahs_idx ON automated_groups USING GIN (surahs);

-- RLS: everyone reads, nobody writes (only service role via migration)
ALTER TABLE automated_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automated_groups_read_all" ON automated_groups;
CREATE POLICY "automated_groups_read_all" ON automated_groups
  FOR SELECT USING (true);
