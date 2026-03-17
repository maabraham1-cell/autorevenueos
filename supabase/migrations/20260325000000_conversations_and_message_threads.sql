-- Conversations model and message threading

-- 1) conversations table

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  channel text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'open',
  started_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  missed_call_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_business_id
  ON conversations(business_id);

CREATE INDEX IF NOT EXISTS idx_conversations_contact_id
  ON conversations(contact_id);

CREATE INDEX IF NOT EXISTS idx_conversations_channel
  ON conversations(channel);

CREATE INDEX IF NOT EXISTS idx_conversations_status
  ON conversations(status);

-- 2) messages.conversation_id (nullable for backwards compatibility)

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages(conversation_id);

-- 3) Simple backfill: create one conversation per (business_id, contact_id, channel)
--    for historical messages that don't yet have a conversation_id.

INSERT INTO conversations (
  business_id,
  contact_id,
  channel,
  source,
  status,
  started_at,
  last_message_at,
  last_message_preview,
  metadata
)
SELECT
  m.business_id,
  m.contact_id,
  m.channel,
  NULL::text AS source,
  'open'::text AS status,
  MIN(m.created_at) AS started_at,
  MAX(m.created_at) AS last_message_at,
  substring(MAX(COALESCE(m.body, '')) for 200) AS last_message_preview,
  NULL::jsonb AS metadata
FROM messages m
LEFT JOIN conversations c
  ON c.business_id = m.business_id
 AND c.contact_id = m.contact_id
 AND c.channel = m.channel
WHERE
  m.contact_id IS NOT NULL
  AND m.channel IS NOT NULL
  AND m.conversation_id IS NULL
  AND c.id IS NULL
GROUP BY
  m.business_id,
  m.contact_id,
  m.channel;

-- 4) Backfill messages.conversation_id to point at the matching conversation row.

UPDATE messages m
SET conversation_id = c.id
FROM conversations c
WHERE
  m.conversation_id IS NULL
  AND m.contact_id IS NOT NULL
  AND m.channel IS NOT NULL
  AND m.business_id = c.business_id
  AND m.contact_id = c.contact_id
  AND m.channel = c.channel;

