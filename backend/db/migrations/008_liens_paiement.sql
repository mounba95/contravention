-- Migration 008 : liens de paiement par SMS (paiement sans compte ni
-- téléchargement d'application). À la création d'une contravention, un lien
-- contenant un jeton unique et imprévisible est envoyé par SMS au téléphone
-- enrôlé au RNP. Le jeton (stocké haché en SHA-256) donne accès à UNE seule
-- contravention, expire, et devient inutilisable une fois le paiement effectué.

CREATE TABLE IF NOT EXISTS liens_paiement (
  id UUID PRIMARY KEY,
  contravention_id UUID NOT NULL REFERENCES contraventions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,      -- SHA-256 du jeton ; le jeton en clair n'existe que dans le SMS
  expire_le TIMESTAMPTZ NOT NULL,
  utilise BOOLEAN NOT NULL DEFAULT false,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_liens_paiement_token ON liens_paiement(token_hash);
CREATE INDEX IF NOT EXISTS idx_liens_paiement_contravention ON liens_paiement(contravention_id);
