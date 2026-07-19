-- Migration 007 : remplace la méthode générique "MOBILE_MONEY" par les
-- fournisseurs réels nommés (MyNita, AmanaTa), conformément à l'écosystème
-- de paiement mobile nigérien.

ALTER TABLE paiements DROP CONSTRAINT IF EXISTS paiements_methode_check;

-- Les paiements déjà enregistrés en "MOBILE_MONEY" sont conservés tels quels
-- (valeur historique) ; seule la contrainte change pour les nouveaux paiements.
ALTER TABLE paiements ADD CONSTRAINT paiements_methode_check
  CHECK (methode IN ('MYNITA', 'AMANATA', 'BANQUE', 'WALLET', 'MOBILE_MONEY'));
