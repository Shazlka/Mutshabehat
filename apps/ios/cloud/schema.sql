CREATE TABLE IF NOT EXISTS qiraat_progress (
    account_id text NOT NULL,
    dataset text NOT NULL CHECK (dataset IN ('khatma', 'memorization')),
    revision integer NOT NULL CHECK (revision > 0),
    snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (account_id, dataset)
);
ALTER TABLE qiraat_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE qiraat_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY qiraat_progress_owner ON qiraat_progress
    USING (account_id = current_setting('qiraat.account_id', true))
    WITH CHECK (account_id = current_setting('qiraat.account_id', true));

DO $$ BEGIN
    CREATE ROLE qiraat_sync_runtime NOLOGIN NOBYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
GRANT qiraat_sync_runtime TO neondb_owner;
GRANT SELECT, INSERT, UPDATE ON qiraat_progress TO qiraat_sync_runtime;
