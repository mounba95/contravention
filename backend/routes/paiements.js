const express = require("express");
const db = require("../db/store");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

// Liste des paiements (admin — tableau de bord). Le paiement lui-même se fait
// exclusivement via le lien reçu par SMS, sans compte : voir routes/paiementLien.js.
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  res.json(await db.paiements.all());
});

module.exports = router;
