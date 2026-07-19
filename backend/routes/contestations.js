const express = require("express");
const db = require("../db/store");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");
const { cleanText } = require("../middleware/validators");

const router = express.Router();

// Le dépôt d'une contestation se fait exclusivement via le lien reçu par SMS,
// sans compte : voir routes/paiementLien.js (déposerContestation).

// Liste des contestations (admin)
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  res.json(await db.contestations.all());
});

// Décision administrative (admin uniquement)
router.put("/:id/decision", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { decision, commentaire } = req.body;
    if (!["ACCEPTEE", "REJETEE"].includes(decision)) {
      return res.status(400).json({ error: "Décision invalide (ACCEPTEE ou REJETEE attendu)." });
    }
    const contestation = await db.contestations.byId(req.params.id);
    if (!contestation) return res.status(404).json({ error: "Contestation introuvable." });

    await db.contestations.updateDecision(contestation.id, decision, cleanText(commentaire, 1000) || "");

    const nouveauStatutContravention = decision === "ACCEPTEE" ? "ANNULEE" : "NON_PAYEE";
    await db.contraventions.updateStatut(contestation.contravention_id, nouveauStatutContravention);

    await logAction({
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: "DECISION_CONTESTATION",
      details: { numero_contravention: contestation.numero_contravention, decision, commentaire }
    });

    res.json({ ...contestation, statut: decision, decision_commentaire: commentaire });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la décision." });
  }
});

module.exports = router;
