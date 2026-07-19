-- Migration 005 : sépare les comptes usagers (mot de passe) de la table
-- citoyens (qui simule le RNP). Cette séparation prépare le remplacement
-- futur de la simulation RNP par un vrai appel au Registre National de la
-- Population, sans toucher à la gestion des comptes de l'application.

CREATE TABLE IF NOT EXISTS comptes_usagers (
  niu TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL
);

-- Récupère les mots de passe déjà créés (le cas échéant) depuis l'ancienne colonne
INSERT INTO comptes_usagers (niu, password_hash)
SELECT niu, password_hash FROM citoyens
WHERE password_hash IS NOT NULL
ON CONFLICT (niu) DO NOTHING;

-- La colonne password_hash de citoyens n'est plus utilisée par l'application
-- (conservée pour ne rien casser ; peut être supprimée manuellement plus tard) :
-- ALTER TABLE citoyens DROP COLUMN IF EXISTS password_hash;
