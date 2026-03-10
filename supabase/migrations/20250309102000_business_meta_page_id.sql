-- Add meta_page_id to businesses for Meta/Instagram webhook routing.
-- This is used by app/api/meta-webhook/route.ts to identify the correct business.

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS meta_page_id text;

CREATE INDEX IF NOT EXISTS idx_businesses_meta_page_id ON businesses(meta_page_id);

