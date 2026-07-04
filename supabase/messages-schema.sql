-- supabase/messages-schema.sql
-- Exécuter dans l'éditeur SQL Supabase

CREATE TABLE messages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inscription_id   uuid NOT NULL REFERENCES inscriptions(id) ON DELETE CASCADE,
  motif_refus      text NOT NULL,
  token            uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  token_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  contenu          text,
  lu               boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_messages_inscription_id ON messages(inscription_id);
CREATE INDEX idx_messages_token ON messages(token);
