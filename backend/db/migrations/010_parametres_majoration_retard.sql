-- Migration 010 : paramètres système + majoration de retard.
-- Table générique clé/valeur pour les réglages modifiables depuis
-- l'Administration sans toucher au code. Premier usage : le taux de
-- majoration appliqué au montant d'une contravention lorsque l'échéance de
-- paiement est dépassée (majoration fixe, appliquée une seule fois — voir
-- services/paiementService.js).

CREATE TABLE IF NOT EXISTS parametres (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

INSERT INTO parametres (cle, valeur) VALUES ('taux_majoration_retard', '5')
ON CONFLICT (cle) DO NOTHING;
