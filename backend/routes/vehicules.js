const express = require("express");
const registreVehiculesClient = require("../services/registreVehiculesClient");
const rnpClient = require("../services/rnpClient");
const { authenticate } = require("../middleware/auth");
const { isValidPlaque } = require("../middleware/validators");

const router = express.Router();

/**
 * Vérification d'une plaque par l'agent avant d'émettre une contravention.
 * Retourne le véhicule (pour confirmer qu'il correspond à celui contrôlé) et
 * le propriétaire. Toute la logique d'accès au registre vit dans
 * services/registreVehiculesClient.js (simulé aujourd'hui, réel demain).
 */
router.get("/verify/:plaque", authenticate, async (req, res) => {
  try {
    if (!isValidPlaque(req.params.plaque)) {
      return res.status(400).json({ found: false, error: "Format de plaque invalide." });
    }
    const vehicule = await registreVehiculesClient.trouverProprietaire(req.params.plaque);
    if (!vehicule) {
      return res.status(404).json({ found: false, error: "Plaque inconnue au registre des véhicules." });
    }
    const identite = await rnpClient.verifierIdentite(vehicule.niu);
    res.json({
      found: true,
      plaque: vehicule.plaque,
      marque: vehicule.marque,
      modele: vehicule.modele,
      couleur: vehicule.couleur,
      niu: vehicule.niu,
      proprietaire: identite ? { nom: identite.nom, prenom: identite.prenom } : null,
      // Téléphone masqué : confirme qu'un numéro existe pour le SMS, sans l'exposer.
      telephone_masque: identite && identite.telephone
        ? identite.telephone.slice(0, 5) + "****" + identite.telephone.slice(-2)
        : null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la vérification de la plaque." });
  }
});

module.exports = router;
