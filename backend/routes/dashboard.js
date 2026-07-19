const express = require("express");
const db = require("../db/store");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/stats", authenticate, requireRole("admin"), async (req, res) => {
  const contraventions = await db.contraventions.all();
  const paiements = await db.paiements.all();

  const montantCollecte = paiements.reduce((sum, p) => sum + p.montant, 0);

  const parStatut = { NON_PAYEE: 0, PAYEE: 0, EN_RETARD: 0, CONTESTEE: 0, ANNULEE: 0 };
  const now = new Date();
  contraventions.forEach(c => {
    let statut = c.statut;
    if (statut === "NON_PAYEE" && new Date(c.date_echeance) < now) statut = "EN_RETARD";
    parStatut[statut] = (parStatut[statut] || 0) + 1;
  });

  const parZone = {};
  contraventions.forEach(c => { parZone[c.lieu] = (parZone[c.lieu] || 0) + 1; });

  const parAgent = {};
  contraventions.forEach(c => { parAgent[c.agent_nom] = (parAgent[c.agent_nom] || 0) + 1; });

  const parInfraction = {};
  contraventions.forEach(c => {
    (c.infractions || []).forEach(inf => {
      parInfraction[inf.libelle] = (parInfraction[inf.libelle] || 0) + 1;
    });
  });

  const tauxPaiement = contraventions.length > 0
    ? Math.round((parStatut.PAYEE / contraventions.length) * 100)
    : 0;

  res.json({
    total_contraventions: contraventions.length,
    montant_collecte: montantCollecte,
    taux_paiement: tauxPaiement,
    par_statut: parStatut,
    par_zone: parZone,
    par_agent: parAgent,
    par_infraction: parInfraction,
    agents_actifs: await db.users.countByRole("agent")
  });
});

module.exports = router;
