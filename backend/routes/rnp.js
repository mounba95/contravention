const express = require("express");
const rnpClient = require("../services/rnpClient");
const { authenticate } = require("../middleware/auth");
const { isValidNiu } = require("../middleware/validators");

const router = express.Router();

/**
 * Point d'entrée utilisé par les agents pour vérifier l'identité d'un usager
 * avant d'émettre une contravention. Toute la logique d'accès au RNP (réel
 * ou simulé) vit dans services/rnpClient.js — voir ce fichier pour brancher
 * le vrai RNP le jour venu.
 */
router.get("/verify/:niu", authenticate, async (req, res) => {
  try {
    if (!isValidNiu(req.params.niu)) {
      return res.status(400).json({ found: false, error: "Format de NIU invalide (attendu : NIU-XXXXXXXXX)." });
    }
    const identite = await rnpClient.verifierIdentite(req.params.niu);
    if (!identite) {
      return res.status(404).json({ found: false, error: "NIU inconnu du Registre National de la Population." });
    }
    res.json({
      found: true,
      niu: identite.niu,
      nom: identite.nom,
      prenom: identite.prenom,
      date_naissance: identite.date_naissance,
      telephone_masque: identite.telephone.slice(0, 5) + "****" + identite.telephone.slice(-2),
      statut: "ACTIF"
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la vérification RNP." });
  }
});

module.exports = router;
