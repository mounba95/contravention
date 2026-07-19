-- Migration 006 : réinitialisation de mot de passe pour les usagers (code
-- à usage unique envoyé par SMS — simulé pour l'instant, voir services/smsClient.js).

CREATE TABLE IF NOT EXISTS usager_otp (
  id UUID PRIMARY KEY,
  niu TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expire_le TIMESTAMPTZ NOT NULL,
  utilise BOOLEAN NOT NULL DEFAULT false,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usager_otp_niu ON usager_otp(niu);
