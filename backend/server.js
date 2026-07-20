require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");

const seed = require("./db/seed");

const authRoutes = require("./routes/auth");
const rnpRoutes = require("./routes/rnp");
const vehiculesRoutes = require("./routes/vehicules");
const contraventionRoutes = require("./routes/contraventions");
const paiementRoutes = require("./routes/paiements");
const contestationRoutes = require("./routes/contestations");
const dashboardRoutes = require("./routes/dashboard");
const auditRoutes = require("./routes/audit");
const exportRoutes = require("./routes/export");
const usersRoutes = require("./routes/users");
const paiementLienRoutes = require("./routes/paiementLien");
const parametresRoutes = require("./routes/parametres");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "changez-moi-en-production") {
  console.warn(
    "\n⚠️  ATTENTION : JWT_SECRET n'est pas défini ou utilise la valeur par défaut du modèle.\n" +
    "   Définissez une valeur forte et unique dans backend/.env avant toute mise en production.\n"
  );
}

const app = express();

// Indispensable en production derrière un reverse proxy (Nginx) : permet à
// Express de lire correctement l'IP réelle du client via X-Forwarded-For
// (sinon express-rate-limit applique la limite à toutes les requêtes
// confondues, ou refuse même de démarrer selon la version).
// "1" = fait confiance au premier proxy en amont (le Nginx local).
app.set("trust proxy", 1);

// En-têtes de sécurité HTTP standards (CSP désactivée : nécessaire pour les
// interfaces statiques qui chargent des polices Google Fonts et exécutent du JS inline)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS_ORIGIN configurable en production (ex: https://contraventions.dgecmr.ne).
// En développement (variable absente), autorise toutes origines pour simplifier.
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));

app.use(express.json({ limit: "8mb" })); // preuve photo en base64

// Limite les tentatives de connexion pour se prémunir contre le bruteforce
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives de connexion. Réessayez dans quelques minutes." }
});
app.use("/api/auth/login", loginLimiter);

// Limite générale sur l'API publique (paiement/contestation par lien SMS, sans authentification)
const publicApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/", publicApiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/rnp", rnpRoutes);
app.use("/api/vehicules", vehiculesRoutes);
app.use("/api/contraventions", contraventionRoutes);
app.use("/api/paiements", paiementRoutes);
app.use("/api/contestations", contestationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/parametres", parametresRoutes);
// Paiement par lien SMS (public, autorisé par le jeton dans l'URL — pas de
// login). On ne met PAS de limiteur strict ici : les opérateurs mobiles
// partagent une même IP entre de nombreux abonnés (CGNAT), un plafond serré
// bloquerait des citoyens légitimes. Le jeton de 256 bits rend de toute façon
// le brute-force inutile ; le limiteur général /api/ ci-dessus s'applique.
app.use("/api/p", paiementLienRoutes);

app.get("/api/health", (req, res) => res.json({ status: "ok", horodatage: new Date().toISOString() }));

// La racine va directement à la connexion Administration (pas de page d'accueil séparée).
app.get("/", (req, res) => res.redirect("/admin.html"));

// Sert les interfaces web statiques (Agent, Admin, page de paiement/contestation par lien SMS)
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

seed()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Système de gestion des contraventions — API démarrée sur http://localhost:${PORT}`);
      console.log(`Interfaces : /agent.html | /admin.html | /payer.html`);
    });
  })
  .catch(err => {
    console.error("Échec de l'amorçage de la base de données :", err.message);
    console.error("Vérifiez que PostgreSQL est démarré et accessible (voir README).");
    process.exit(1);
  });
