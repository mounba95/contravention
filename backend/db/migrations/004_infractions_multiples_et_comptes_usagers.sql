-- Migration 004 : types d'infraction modifiables, contraventions multi-infractions,
-- et comptes usagers (inscription/connexion).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Types d'infraction : ajout du statut actif/inactif
ALTER TABLE types_infraction ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;

-- 2. Contraventions multi-infractions
ALTER TABLE contraventions ALTER COLUMN type_infraction_id DROP NOT NULL;

CREATE TABLE IF NOT EXISTS contravention_infractions (
  id UUID PRIMARY KEY,
  contravention_id UUID NOT NULL REFERENCES contraventions(id) ON DELETE CASCADE,
  type_infraction_id UUID NOT NULL REFERENCES types_infraction(id),
  type_infraction_libelle TEXT NOT NULL,
  montant INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contravention_infractions_contravention ON contravention_infractions(contravention_id);

-- Migre les contraventions existantes (une seule infraction) vers la nouvelle table de détail
INSERT INTO contravention_infractions (id, contravention_id, type_infraction_id, type_infraction_libelle, montant)
SELECT gen_random_uuid(), c.id, c.type_infraction_id, c.type_infraction_libelle, c.montant
FROM contraventions c
WHERE c.type_infraction_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM contravention_infractions ci WHERE ci.contravention_id = c.id);

-- 3. Comptes usagers (inscription/connexion sur l'application mobile)
ALTER TABLE citoyens ADD COLUMN IF NOT EXISTS password_hash TEXT;
