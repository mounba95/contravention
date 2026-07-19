-- Migration 002 : ajout du statut ANNULEE, distinct de PAYEE, pour les
-- contraventions annulées suite à une contestation acceptée par l'administration.
-- Corrige un bug où une contestation acceptée marquait à tort la contravention
-- comme "payée" (impact sur les statistiques du tableau de bord).

ALTER TABLE contraventions DROP CONSTRAINT IF EXISTS contraventions_statut_check;
ALTER TABLE contraventions ADD CONSTRAINT contraventions_statut_check
  CHECK (statut IN ('NON_PAYEE', 'PAYEE', 'EN_RETARD', 'CONTESTEE', 'ANNULEE'));

-- Corrige les données déjà erronées : toute contravention actuellement
-- "PAYEE" mais liée à une contestation ACCEPTEE doit devenir ANNULEE.
UPDATE contraventions c
SET statut = 'ANNULEE'
FROM contestations ct
WHERE ct.contravention_id = c.id
  AND ct.statut = 'ACCEPTEE'
  AND c.statut = 'PAYEE';
