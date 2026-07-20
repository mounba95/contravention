const express = require("express");
const db = require("../db/store");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

// Statistiques filtrables par période (date_debut/date_fin sur la date
// d'émission) et par agent (agent_id) — la recette suit le même périmètre.
router.get("/stats", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { date_debut, date_fin, agent_id } = req.query;
    const data = await db.dashboardStats.get({ dateDebut: date_debut, dateFin: date_fin, agentId: agent_id });

    const t = data.total;
    const parStatut = {
      NON_PAYEE: t.non_payees,
      PAYEE: t.payees,
      EN_RETARD: t.en_retard,
      CONTESTEE: t.contestees,
      ANNULEE: t.annulees
    };
    const parZone = {};
    data.parZone.forEach(r => { parZone[r.lieu] = r.n; });
    const parAgent = {};
    data.parAgent.forEach(r => { parAgent[r.agent_nom] = r.n; });
    const parInfraction = {};
    data.parInfraction.forEach(r => { parInfraction[r.libelle] = r.n; });

    res.json({
      total_contraventions: t.total,
      montant_collecte: data.montantCollecte,
      taux_paiement: t.total > 0 ? Math.round((t.payees / t.total) * 100) : 0,
      par_statut: parStatut,
      par_zone: parZone,
      par_agent: parAgent,
      par_infraction: parInfraction,
      agents_actifs: await db.users.countByRole("agent")
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors du calcul des statistiques." });
  }
});

module.exports = router;
