-- Migration 011 : le taux de majoration de retard doit être figé au moment
-- de l'émission de chaque contravention, PAS relu depuis le paramètre
-- courant à chaque calcul. Sans ça, changer le taux dans l'Administration
-- s'appliquerait rétroactivement aux contraventions déjà émises — ce qui
-- n'est pas légitime : un usager doit payer le taux en vigueur au moment où
-- son infraction lui a été notifiée, pas un taux décidé après coup.
--
-- Valeur de repli (5) pour les contraventions déjà émises avant cette
-- migration : c'est le seul taux qui ait jamais été en vigueur jusqu'ici.

ALTER TABLE contraventions ADD COLUMN IF NOT EXISTS taux_majoration_retard NUMERIC NOT NULL DEFAULT 5;
