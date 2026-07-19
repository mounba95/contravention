const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/store");
const { JWT_SECRET } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Nom d'utilisateur et mot de passe requis." });
    }
    const user = await db.users.findByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Identifiants incorrects." });
    }
    if (!user.actif) {
      return res.status(403).json({ error: "Ce compte a été désactivé. Contactez un administrateur." });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, nom: user.nom },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
    await logAction({ userId: user.id, username: user.username, role: user.role, action: "LOGIN", details: {} });
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, nom: user.nom, station: user.station }
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la connexion." });
  }
});

module.exports = router;
