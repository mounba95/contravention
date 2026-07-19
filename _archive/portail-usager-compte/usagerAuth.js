const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const db = require("../db/store");
const rnpClient = require("../services/rnpClient");
const smsClient = require("../services/smsClient");
const { JWT_SECRET } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");
const { isValidNiu, isValidTelephone } = require("../middleware/validators");

const router = express.Router();

/**
 * Inscription d'un usager sur l'application. Le NIU doit exister au RNP (via
 * rnpClient — simulé aujourd'hui, réel demain, sans changement ici), et le
 * numéro de téléphone fourni doit correspondre à celui du RNP — c'est la
 * vérification d'identité qui empêche quelqu'un de s'inscrire avec le NIU
 * d'un tiers. Le mot de passe est stocké séparément (table comptes_usagers),
 * jamais mêlé aux données d'identité RNP.
 */
router.post("/inscription", async (req, res) => {
  try {
    const { niu, telephone, password } = req.body;
    if (!niu || !telephone || !password) {
      return res.status(400).json({ error: "NIU, téléphone et mot de passe sont requis." });
    }
    if (!isValidNiu(niu)) {
      return res.status(400).json({ error: "Format de NIU invalide (attendu : NIU-XXXXXXXXX)." });
    }
    if (!isValidTelephone(telephone)) {
      return res.status(400).json({ error: "Format de numéro de téléphone invalide." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    const identite = await rnpClient.verifierIdentite(niu);
    if (!identite) {
      return res.status(404).json({ error: "NIU non reconnu par le Registre National de la Population." });
    }
    if (await db.comptesUsagers.existe(niu)) {
      return res.status(409).json({ error: "Un compte existe déjà pour ce NIU. Utilisez la connexion." });
    }
    // Vérifie que le téléphone fourni correspond à celui du RNP (les espaces
    // et le préfixe international ne sont pas exigés à l'identique).
    const normaliser = (t) => t.replace(/[\s+]/g, "").slice(-8);
    if (normaliser(telephone) !== normaliser(identite.telephone)) {
      return res.status(403).json({ error: "Le numéro de téléphone ne correspond pas à celui enregistré au RNP pour ce NIU." });
    }

    await db.comptesUsagers.creer(niu, bcrypt.hashSync(password, 8));
    await logAction({ userId: niu, username: niu, role: "usager", action: "INSCRIPTION_USAGER", details: {} });

    res.status(201).json({ ok: true, message: "Inscription réussie. Vous pouvez maintenant vous connecter." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de l'inscription." });
  }
});

router.post("/connexion", async (req, res) => {
  try {
    const { niu, password } = req.body;
    if (!niu || !password) {
      return res.status(400).json({ error: "NIU et mot de passe sont requis." });
    }
    const compte = await db.comptesUsagers.findByNiu(niu);
    if (!compte || !bcrypt.compareSync(password, compte.password_hash)) {
      return res.status(401).json({ error: "NIU ou mot de passe incorrect." });
    }
    const identite = await rnpClient.verifierIdentite(niu);
    if (!identite) {
      // Cas très improbable (compte local existant mais identité disparue du RNP)
      return res.status(404).json({ error: "Identité introuvable au RNP pour ce compte." });
    }

    const token = jwt.sign({ niu, role: "usager" }, JWT_SECRET, { expiresIn: "12h" });
    await logAction({ userId: niu, username: niu, role: "usager", action: "CONNEXION_USAGER", details: {} });

    res.json({
      token,
      user: { niu, nom: identite.nom, prenom: identite.prenom, role: "usager" }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la connexion." });
  }
});

/**
 * Demande d'un code de réinitialisation (envoyé par SMS — simulé, voir
 * services/smsClient.js). Répond toujours le même message générique, que le
 * compte existe ou non, pour ne pas révéler quels NIU sont inscrits.
 */
router.post("/mot-de-passe-oublie", async (req, res) => {
  try {
    const { niu } = req.body;
    if (!niu || !isValidNiu(niu)) {
      return res.status(400).json({ error: "Format de NIU invalide (attendu : NIU-XXXXXXXXX)." });
    }

    const messageGenerique = { ok: true, message: "Si un compte existe pour ce NIU, un code a été envoyé au téléphone associé." };

    const compte = await db.comptesUsagers.findByNiu(niu);
    const identite = await rnpClient.verifierIdentite(niu);
    if (!compte || !identite) {
      return res.json(messageGenerique); // réponse identique, pas d'indice sur l'existence du compte
    }

    const code = String(Math.floor(100000 + Math.random() * 900000)); // code à 6 chiffres
    await db.usagerOtp.creer({
      id: uuid(),
      niu,
      code_hash: bcrypt.hashSync(code, 8),
      expire_le: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
    });
    await smsClient.envoyerCode(identite.telephone, code);
    await logAction({ userId: niu, username: niu, role: "usager", action: "DEMANDE_REINITIALISATION_MDP", details: {} });

    const reponse = { ...messageGenerique };
    // Hors production uniquement : permet de tester sans vrai envoi de SMS.
    if (process.env.NODE_ENV !== "production") {
      reponse.code_demo = code;
    }
    res.json(reponse);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la demande de réinitialisation." });
  }
});

router.post("/reinitialiser-mot-de-passe", async (req, res) => {
  try {
    const { niu, code, nouveauMotDePasse } = req.body;
    if (!niu || !code || !nouveauMotDePasse) {
      return res.status(400).json({ error: "NIU, code et nouveau mot de passe sont requis." });
    }
    if (nouveauMotDePasse.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
    }

    const otp = await db.usagerOtp.dernierValide(niu);
    if (!otp || !bcrypt.compareSync(code, otp.code_hash)) {
      return res.status(400).json({ error: "Code invalide ou expiré." });
    }

    await db.comptesUsagers.setPassword(niu, bcrypt.hashSync(nouveauMotDePasse, 8));
    await db.usagerOtp.marquerUtilise(otp.id);
    await logAction({ userId: niu, username: niu, role: "usager", action: "REINITIALISATION_MDP_USAGER", details: {} });

    res.json({ ok: true, message: "Mot de passe réinitialisé. Vous pouvez maintenant vous connecter." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la réinitialisation." });
  }
});

module.exports = router;
