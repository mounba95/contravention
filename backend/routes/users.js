const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const db = require("../db/store");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");
const { cleanText } = require("../middleware/validators");

const router = express.Router();

const USERNAME_REGEX = /^[a-zA-Z0-9._-]{3,32}$/;

function sansMotDePasse(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

// Liste des comptes (admin uniquement)
router.get("/", authenticate, requireRole("admin"), async (req, res) => {
  const list = await db.users.all();
  res.json(list.map(sansMotDePasse));
});

// Créer un compte agent ou admin (admin uniquement)
router.post("/", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { username, password, role, nom, matricule, station } = req.body;

    if (!username || !password || !role || !nom) {
      return res.status(400).json({ error: "Identifiant, mot de passe, rôle et nom sont requis." });
    }
    if (!USERNAME_REGEX.test(username.trim())) {
      return res.status(400).json({ error: "Identifiant invalide (3 à 32 caractères : lettres, chiffres, points, tirets)." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
    }
    if (!["agent", "admin"].includes(role)) {
      return res.status(400).json({ error: "Rôle invalide (agent ou admin attendu)." });
    }
    const existant = await db.users.findByUsername(username.trim());
    if (existant) {
      return res.status(409).json({ error: "Cet identifiant est déjà utilisé." });
    }

    const nouvelUtilisateur = {
      id: uuid(),
      username: username.trim(),
      password_hash: bcrypt.hashSync(password, 8),
      role,
      nom: cleanText(nom, 120),
      matricule: matricule ? cleanText(matricule, 60) : null,
      station: station ? cleanText(station, 120) : null,
      actif: true
    };

    await db.users.insert(nouvelUtilisateur);
    await logAction({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      action: "CREATION_UTILISATEUR",
      details: { username: nouvelUtilisateur.username, role: nouvelUtilisateur.role, nom: nouvelUtilisateur.nom }
    });

    res.status(201).json(sansMotDePasse(nouvelUtilisateur));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la création du compte." });
  }
});

// Activer / désactiver un compte (admin uniquement)
router.put("/:id/statut", authenticate, requireRole("admin"), async (req, res) => {
  const { actif } = req.body;
  if (typeof actif !== "boolean") {
    return res.status(400).json({ error: "Le champ 'actif' doit être un booléen." });
  }
  const cible = await db.users.findById(req.params.id);
  if (!cible) return res.status(404).json({ error: "Compte introuvable." });
  if (cible.id === req.user.id) {
    return res.status(400).json({ error: "Vous ne pouvez pas désactiver votre propre compte." });
  }

  await db.users.setActif(cible.id, actif);
  await logAction({
    userId: req.user.id, username: req.user.username, role: req.user.role,
    action: actif ? "REACTIVATION_UTILISATEUR" : "DESACTIVATION_UTILISATEUR",
    details: { username: cible.username }
  });

  res.json({ ok: true });
});

// Réinitialiser le mot de passe d'un compte (admin uniquement)
router.put("/:id/password", authenticate, requireRole("admin"), async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: "Le mot de passe doit contenir au moins 6 caractères." });
  }
  const cible = await db.users.findById(req.params.id);
  if (!cible) return res.status(404).json({ error: "Compte introuvable." });

  await db.users.setPassword(cible.id, bcrypt.hashSync(password, 8));
  await logAction({
    userId: req.user.id, username: req.user.username, role: req.user.role,
    action: "REINITIALISATION_MOT_DE_PASSE",
    details: { username: cible.username }
  });

  res.json({ ok: true });
});

module.exports = router;
