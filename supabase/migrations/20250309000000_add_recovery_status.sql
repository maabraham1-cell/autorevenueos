-- Add persistent status tracking for recoveries.
-- This does not change how recoveries are created; it only adds
-- an optional status field that can be updated later from the UI.

ALTER TABLE recoveries
ADD COLUMN IF NOT EXISTS status text;

CREATE INDEX IF NOT EXISTS idx_recoveries_status ON recoveries(status);

