-- Meta Connect: store per-business page token and display name; pending OAuth state.

-- Businesses: page access token (for sending replies) and display name (for Settings UX).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS meta_page_access_token text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS meta_page_name text;
COMMENT ON COLUMN businesses.meta_page_access_token IS 'Page access token from Connect Facebook flow; used to send Messenger/Instagram replies.';
COMMENT ON COLUMN businesses.meta_page_name IS 'Display name of connected Facebook Page (e.g. for Settings).';

-- Temporary store for OAuth callback: list of pages + tokens until user selects one.
CREATE TABLE IF NOT EXISTS meta_connection_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  pages jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meta_connection_pending_business_id ON meta_connection_pending(business_id);
CREATE INDEX IF NOT EXISTS idx_meta_connection_pending_created_at ON meta_connection_pending(created_at);
COMMENT ON TABLE meta_connection_pending IS 'Stores Facebook Pages list after OAuth until user selects one; cleared after connect-complete or expiry.';
