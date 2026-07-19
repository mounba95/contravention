-- Migration 003 : ajout d'un statut actif/inactif pour les comptes utilisateurs
-- (permet à l'administrateur de désactiver un agent sans supprimer son historique).

ALTER TABLE users ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;
