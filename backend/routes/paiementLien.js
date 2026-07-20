/**
 * Paiement par lien SMS — SANS compte ni application.
 *
 * À la création d'une contravention, un lien contenant un jeton unique est
 * envoyé par SMS au numéro enrôlé au RNP. Le citoyen clique et arrive ici :
 * le jeton (dans l'URL) tient lieu d'autorisation — il donne accès à UNE
 * seule contravention, expire, et n'expose aucune donnée d'un tiers.
 *
 * Le jeton n'est jamais stocké en clair : on n'en garde que le SHA-256. On
 * retrouve donc le lien en re-hachant le jeton reçu et en comparant les hash.
 */
const express = require("express");
const crypto = require("crypto");
const { v4: uuid } = require("uuid");
const db = require("../db/store");
const paiementService = require("../services/paiementService");
const { logAction } = require("../middleware/audit");
const { cleanText } = require("../middleware/validators");

const router = express.Router();

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

/** Statut réel affiché au citoyen (EN_RETARD est calculé, pas stocké). */
function statutReel(c) {
  if (c.statut === "PAYEE" || c.statut === "CONTESTEE" || c.statut === "ANNULEE") return c.statut;
  return new Date() > new Date(c.date_echeance) ? "EN_RETARD" : "NON_PAYEE";
}

/**
 * Charge le lien valide + sa contravention à partir du jeton d'URL.
 * Renvoie null si le jeton est inconnu/expiré ou la contravention absente.
 */
async function chargerDepuisToken(token) {
  const lien = await db.liensPaiement.findParToken(hashToken(token));
  if (!lien) return null;
  const contravention = await db.contraventions.byId(lien.contravention_id);
  if (!contravention) return null;
  return { lien, contravention };
}

// Infos minimales de la contravention (aucune donnée personnelle : ni nom, ni
// NIU, ni téléphone — seulement de quoi reconnaître et payer l'amende).
router.get("/:token", async (req, res) => {
  try {
    const data = await chargerDepuisToken(req.params.token);
    if (!data) return res.status(404).json({ error: "Lien de paiement invalide ou expiré." });
    const c = data.contravention;
    res.json({
      numero_unique: c.numero_unique,
      type_infraction_libelle: c.type_infraction_libelle,
      infractions: c.infractions,
      montant: c.montant,
      montant_du: paiementService.calculerMontantDu(c),
      // Taux figé à l'émission de CETTE contravention — pas le taux courant
      // du paramètre, qui a pu changer depuis sans effet rétroactif.
      taux_majoration_retard: Number(c.taux_majoration_retard),
      lieu: c.lieu,
      date_heure: c.date_heure,
      date_echeance: c.date_echeance,
      statut: statutReel(c)
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

// Paiement (mêmes méthodes que l'app : MyNita / AmanaTa / Wallet / Banque).
router.post("/:token", async (req, res) => {
  try {
    const data = await chargerDepuisToken(req.params.token);
    if (!data) return res.status(404).json({ error: "Lien de paiement invalide ou expiré." });
    const { contravention, lien } = data;
    const { methode, numero_telephone } = req.body;

    const resultat = await paiementService.payerContravention({
      contravention,
      methode,
      numero_telephone,
      // L'acteur est le titulaire de la contravention ; la traçabilité note
      // que le paiement provient du lien SMS et non de l'app connectée.
      acteur: { userId: contravention.niu_usager, username: contravention.niu_usager, role: "usager" },
      canal: "LIEN_SMS"
    });
    if (!resultat.ok) {
      return res.status(resultat.status).json({ error: resultat.error });
    }

    // Prolonge la validité du lien (voir db/store.js) : l'usager doit pouvoir
    // rouvrir le lien reçu par SMS pour retrouver son reçu, même après la
    // date d'échéance d'origine. Le statut PAYEE de la contravention empêche
    // déjà tout nouveau paiement ou contestation via ce même lien.
    await db.liensPaiement.marquerUtilise(lien.id);

    res.status(201).json({ ...resultat.paiement, recu: resultat.recu });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors du paiement." });
  }
});

// Contestation — même accès que le paiement : le jeton du lien SMS tient
// lieu d'autorisation, aucun identifiant ni mot de passe n'est demandé.
router.post("/:token/contester", async (req, res) => {
  try {
    const data = await chargerDepuisToken(req.params.token);
    if (!data) return res.status(404).json({ error: "Lien de paiement invalide ou expiré." });
    const { contravention } = data;
    const { motif } = req.body;

    const motifNettoye = cleanText(motif, 1000);
    if (motifNettoye.length < 5) {
      return res.status(400).json({ error: "Merci de préciser un motif plus détaillé (5 caractères minimum)." });
    }
    if (contravention.statut === "PAYEE") {
      return res.status(409).json({ error: "Une contravention déjà payée ne peut être contestée." });
    }
    if (contravention.statut === "CONTESTEE") {
      return res.status(409).json({ error: "Cette contravention est déjà en cours de contestation." });
    }
    if (contravention.statut === "ANNULEE") {
      return res.status(409).json({ error: "Cette contravention a déjà été annulée." });
    }

    const contestation = {
      id: uuid(),
      contravention_id: contravention.id,
      numero_contravention: contravention.numero_unique,
      niu_usager: contravention.niu_usager,
      motif: motifNettoye,
      date_creation: new Date().toISOString(),
      statut: "EN_ATTENTE",
      decision_commentaire: null,
      date_decision: null
    };

    await db.contestations.insert(contestation);
    await db.contraventions.updateStatut(contravention.id, "CONTESTEE");

    await logAction({
      userId: contravention.niu_usager,
      username: contravention.niu_usager,
      role: "usager",
      action: "DEPOT_CONTESTATION",
      details: { numero_contravention: contravention.numero_unique, motif: motifNettoye, canal: "LIEN_SMS" }
    });

    res.status(201).json(contestation);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors du dépôt de la contestation." });
  }
});

module.exports = router;
