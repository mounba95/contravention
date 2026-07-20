const express = require("express");
const db = require("../db/store");
const paiementService = require("../services/paiementService");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");

const router = express.Router();

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(row.map(csvEscape).join(","));
  }
  // BOM UTF-8 pour un affichage correct des accents dans Excel
  return "\uFEFF" + lines.join("\r\n");
}

function statutCalcule(c) {
  if (c.statut === "PAYEE" || c.statut === "CONTESTEE" || c.statut === "ANNULEE") return c.statut;
  return new Date(c.date_echeance) < new Date() ? "EN_RETARD" : "NON_PAYEE";
}

// Export CSV des contraventions (filtrable via les mêmes paramètres que la recherche)
router.get("/contraventions.csv", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { statut, niu, numero, date_debut, date_fin } = req.query;
    const rows = await db.contraventions.searchAll({ statut, niu, numero, dateDebut: date_debut, dateFin: date_fin });

    const csv = toCsv(
      ["Numero", "Plaque", "NIU_Usager", "Nom_Usager", "Agent", "Infraction", "Montant_Initial_FCFA", "Montant_Du_FCFA", "Lieu", "Statut", "Date_Emission", "Date_Echeance"],
      rows.map(c => [
        c.numero_unique, c.plaque || "", c.niu_usager, `${c.citoyen_prenom} ${c.citoyen_nom}`, c.agent_nom,
        c.type_infraction_libelle, c.montant, paiementService.calculerMontantDu(c), c.lieu, statutCalcule(c),
        new Date(c.date_heure).toLocaleString("fr-FR"), new Date(c.date_echeance).toLocaleDateString("fr-FR")
      ])
    );

    await logAction({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      action: "EXPORT_CSV", details: { type: "contraventions", nb_lignes: rows.length }
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="contraventions_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de l'export CSV." });
  }
});

// Export CSV des paiements (utile pour la remontée vers le Trésor public)
router.get("/paiements.csv", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const rows = await db.paiements.all();
    const csv = toCsv(
      ["Reference", "Numero_Contravention", "Montant_FCFA", "Methode", "Date_Paiement", "Statut"],
      rows.map(p => [
        p.reference, p.numero_contravention, p.montant, p.methode,
        new Date(p.date_paiement).toLocaleString("fr-FR"), p.statut
      ])
    );

    await logAction({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      action: "EXPORT_CSV", details: { type: "paiements", nb_lignes: rows.length }
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="paiements_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de l'export CSV." });
  }
});

module.exports = router;
