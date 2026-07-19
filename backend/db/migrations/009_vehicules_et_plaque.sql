-- Migration 009 : identification par plaque d'immatriculation.
-- Sur le terrain, l'agent n'a pas le NIU de l'usager : il ne dispose que de la
-- PLAQUE. Celle-ci est reliée, dans le registre des véhicules, au NIU du
-- propriétaire — d'où l'on retrouve ensuite son téléphone via le RNP.
--
-- La table `vehicules` SIMULE le registre national des véhicules (carte grise).
-- ⚠️ En production, elle sera remplacée par un vrai appel à ce registre via
-- services/registreVehiculesClient.js — comme la table `citoyens` l'est pour le RNP.

CREATE TABLE IF NOT EXISTS vehicules (
  plaque TEXT PRIMARY KEY,                       -- normalisée : majuscules, sans espaces
  niu TEXT NOT NULL REFERENCES citoyens(niu),    -- propriétaire (source d'identité)
  marque TEXT,
  modele TEXT,
  couleur TEXT
);
CREATE INDEX IF NOT EXISTS idx_vehicules_niu ON vehicules(niu);

-- Plaque à l'origine de la contravention (l'agent la saisit ; le NIU en est
-- déduit). NULL pour les contraventions créées directement par NIU (piéton,
-- véhicule non immatriculé, secours).
ALTER TABLE contraventions ADD COLUMN IF NOT EXISTS plaque TEXT;
