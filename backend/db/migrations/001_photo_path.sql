-- Migration 001 : passage du stockage de la preuve photo de base64 (en base)
-- vers un fichier sur disque (chemin stocké en base).
-- À exécuter sur une installation existante créée avant cette mise à jour.

ALTER TABLE contraventions ADD COLUMN IF NOT EXISTS photo_path TEXT;

-- Si une colonne photo_preuve (ancien format base64) existe encore, on la
-- laisse en place pour ne pas perdre de données historiques, mais elle
-- n'est plus utilisée par l'application. Vous pouvez la supprimer une fois
-- certain de ne plus en avoir besoin :
-- ALTER TABLE contraventions DROP COLUMN IF EXISTS photo_preuve;
