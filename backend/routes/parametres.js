/**
 * Réglages système modifiables depuis l'Administration (ex: taux de
 * majoration de retard) — voir db/store.js (table `parametres`, clé/valeur
 * générique) et services/paiementService.js pour l'usage du taux.
 */
const express = require("express");
const db = require("../db/store");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");

const router = express.Router();

// Validation spécifique par clé connue — évite qu'une valeur absurde soit
// enregistrée (ex: taux négatif ou non numérique).
const VALIDATEURS = {
  taux_majoration_retard(valeur) {
    const n = Number(valeur);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return "Le taux doit être un nombre entre 0 et 100.";
    }
    return null;
  }
};

router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  res.json(await db.parametres.all());
});

router.put("/:cle", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { valeur } = req.body;
    if (valeur === undefined || valeur === null || String(valeur).trim() === "") {
      return res.status(400).json({ error: "Une valeur est requise." });
    }
    const valider = VALIDATEURS[req.params.cle];
    if (valider) {
      const erreur = valider(valeur);
      if (erreur) return res.status(400).json({ error: erreur });
    }

    await db.parametres.set(req.params.cle, String(valeur).trim());
    await logAction({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      action: "MODIFICATION_PARAMETRE", details: { cle: req.params.cle, valeur }
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la mise à jour du paramètre." });
  }
});

module.exports = router;
