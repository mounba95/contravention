const express = require("express");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { v4: uuid } = require("uuid");
const db = require("../db/store");
const rnpClient = require("../services/rnpClient");
const registreVehiculesClient = require("../services/registreVehiculesClient");
const smsClient = require("../services/smsClient");
const paiementService = require("../services/paiementService");
const { authenticate, requireRole } = require("../middleware/auth");
const { logAction } = require("../middleware/audit");
const { isValidNiu, isValidPlaque, cleanText } = require("../middleware/validators");

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "preuves");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/** Décode une data URL "data:image/xxx;base64,...." et l'écrit sur disque. Retourne le chemin relatif. */
function sauvegarderPhoto(dataUrl, numeroUnique) {
  const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const buffer = Buffer.from(match[2], "base64");
  const filename = `${numeroUnique}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return filename;
}

function genererNumeroUnique() {
  const annee = new Date().getFullYear();
  const suffixe = Math.floor(100000 + Math.random() * 899999);
  return `CTV-${annee}-${suffixe}`;
}

/**
 * Crée un lien de paiement à usage unique et l'envoie par SMS au numéro
 * enrôlé au RNP. Le citoyen paie depuis une simple page web, sans compte ni
 * application. Renvoie le lien en clair (utile pour la démo hors production) ;
 * le jeton n'est stocké que haché (SHA-256).
 */
async function creerEtEnvoyerLienPaiement(contravention, telephone) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.liensPaiement.creer({
    id: uuid(),
    contravention_id: contravention.id,
    token_hash: crypto.createHash("sha256").update(token).digest("hex"),
    expire_le: contravention.date_echeance // le lien vit jusqu'à l'échéance
  });
  const base = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");
  const lien = `${base}/payer.html?t=${token}`;
  await smsClient.envoyerLienPaiement(telephone, lien, {
    numero: contravention.numero_unique,
    montant: contravention.montant,
    dateEcheance: contravention.date_echeance,
    tauxMajoration: await paiementService.tauxMajorationRetard()
  });
  return lien;
}

function statutReel(c) {
  if (c.statut === "PAYEE" || c.statut === "CONTESTEE" || c.statut === "ANNULEE") return c.statut;
  const echeance = new Date(c.date_echeance);
  if (new Date() > echeance) return "EN_RETARD";
  return "NON_PAYEE";
}

function withStatutReel(c, tauxMajoration) {
  // On n'expose jamais le chemin disque brut ni le contenu — seulement un indicateur.
  const { photo_path, ...rest } = c;
  return {
    ...rest,
    statut: statutReel(c),
    montant_du: paiementService.calculerMontantDu(c, tauxMajoration),
    a_une_photo: !!photo_path
  };
}

// Types d'infraction (référentiel) — ?actifs=true pour ne récupérer que les types actifs
router.get("/types-infraction", authenticate, async (req, res) => {
  res.json(req.query.actifs === "true" ? await db.typesInfraction.allActifs() : await db.typesInfraction.all());
});

// Créer un nouveau type d'infraction (admin uniquement)
router.post("/types-infraction", authenticate, requireRole("admin"), async (req, res) => {
  try {
    const { libelle, montant } = req.body;
    if (!libelle || !montant || montant <= 0) {
      return res.status(400).json({ error: "Libellé et montant (positif) sont requis." });
    }
    const type = { id: uuid(), libelle: cleanText(libelle, 150), montant: Math.round(montant), actif: true };
    await db.typesInfraction.insert(type);
    await logAction({
      userId: req.user.id, username: req.user.username, role: req.user.role,
      action: "CREATION_TYPE_INFRACTION", details: { libelle: type.libelle, montant: type.montant }
    });
    res.status(201).json(type);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la création du type d'infraction." });
  }
});

// Modifier un type d'infraction existant (admin uniquement)
router.put("/types-infraction/:id", authenticate, requireRole("admin"), async (req, res) => {
  const { libelle, montant } = req.body;
  if (!libelle || !montant || montant <= 0) {
    return res.status(400).json({ error: "Libellé et montant (positif) sont requis." });
  }
  const existant = await db.typesInfraction.findById(req.params.id);
  if (!existant) return res.status(404).json({ error: "Type d'infraction introuvable." });

  await db.typesInfraction.update(req.params.id, { libelle: cleanText(libelle, 150), montant: Math.round(montant) });
  await logAction({
    userId: req.user.id, username: req.user.username, role: req.user.role,
    action: "MODIFICATION_TYPE_INFRACTION", details: { id: req.params.id, libelle, montant }
  });
  res.json({ ok: true });
});

// Activer / désactiver un type d'infraction (admin uniquement) — ne supprime jamais
// (les contraventions déjà émises gardent leur libellé/montant historique intact)
router.put("/types-infraction/:id/statut", authenticate, requireRole("admin"), async (req, res) => {
  const { actif } = req.body;
  if (typeof actif !== "boolean") {
    return res.status(400).json({ error: "Le champ 'actif' doit être un booléen." });
  }
  const existant = await db.typesInfraction.findById(req.params.id);
  if (!existant) return res.status(404).json({ error: "Type d'infraction introuvable." });

  await db.typesInfraction.setActif(req.params.id, actif);
  await logAction({
    userId: req.user.id, username: req.user.username, role: req.user.role,
    action: actif ? "REACTIVATION_TYPE_INFRACTION" : "DESACTIVATION_TYPE_INFRACTION",
    details: { libelle: existant.libelle }
  });
  res.json({ ok: true });
});

// Créer une contravention (agent uniquement) — une ou plusieurs infractions combinées sur un seul ticket
router.post("/", authenticate, requireRole("agent"), async (req, res) => {
  try {
    const { niu_usager, plaque, type_infraction_ids, lieu, latitude, longitude, notes, photo_preuve } = req.body;

    // Identification : par PLAQUE (cas normal sur le terrain — l'agent n'a pas
    // le NIU) ou, à défaut, directement par NIU (piéton, véhicule non
    // immatriculé, secours). La plaque est prioritaire si les deux sont fournis.
    if ((!plaque && !niu_usager) || !Array.isArray(type_infraction_ids) || type_infraction_ids.length === 0 || !lieu) {
      return res.status(400).json({ error: "La plaque (ou le NIU), au moins un type d'infraction et le lieu sont requis." });
    }
    if (photo_preuve && photo_preuve.length > 6_000_000) {
      return res.status(413).json({ error: "Photo trop volumineuse." });
    }

    let niuCible = niu_usager;
    let plaqueNormalisee = null;
    if (plaque) {
      if (!isValidPlaque(plaque)) {
        return res.status(400).json({ error: "Format de plaque invalide." });
      }
      const vehicule = await registreVehiculesClient.trouverProprietaire(plaque);
      if (!vehicule) {
        return res.status(404).json({ error: "Plaque inconnue au registre des véhicules." });
      }
      niuCible = vehicule.niu;
      plaqueNormalisee = vehicule.plaque;
    } else if (!isValidNiu(niu_usager)) {
      return res.status(400).json({ error: "Format de NIU invalide (attendu : NIU-XXXXXXXXX)." });
    }

    const identite = await rnpClient.verifierIdentite(niuCible);
    if (!identite) {
      return res.status(404).json({ error: "Propriétaire non reconnu par le Registre National de la Population." });
    }

    const infractions = [];
    for (const typeId of type_infraction_ids) {
      const type = await db.typesInfraction.findById(typeId);
      if (!type) return res.status(404).json({ error: "Un des types d'infraction sélectionnés est inconnu." });
      infractions.push({ type_infraction_id: type.id, libelle: type.libelle, montant: type.montant });
    }
    const montantTotal = infractions.reduce((sum, i) => sum + i.montant, 0);
    const libelleResume = infractions.map(i => i.libelle).join(", ");

    const now = new Date();
    const echeance = new Date(now.getTime() + 15 * 24 * 3600 * 1000); // 15 jours
    const numeroUnique = genererNumeroUnique();

    let photoPath = null;
    if (photo_preuve) {
      try {
        photoPath = sauvegarderPhoto(photo_preuve, numeroUnique);
      } catch (e) {
        console.error("Échec de sauvegarde de la photo :", e.message);
      }
    }

    const contravention = {
      id: uuid(),
      numero_unique: numeroUnique,
      niu_usager: niuCible,
      plaque: plaqueNormalisee,
      citoyen_nom: identite.nom,
      citoyen_prenom: identite.prenom,
      agent_id: req.user.id,
      agent_nom: req.user.nom,
      type_infraction_libelle: libelleResume,
      montant: montantTotal,
      lieu: cleanText(lieu, 200),
      latitude: latitude || null,
      longitude: longitude || null,
      notes: cleanText(notes, 1000),
      photo_path: photoPath,
      date_heure: now.toISOString(),
      date_echeance: echeance.toISOString(),
      statut: "NON_PAYEE",
      infractions
    };

    await db.contraventions.insert(contravention);
    await logAction({
      userId: req.user.id,
      username: req.user.username,
      role: req.user.role,
      action: "CREATION_CONTRAVENTION",
      details: { numero_unique: contravention.numero_unique, niu_usager: niuCible, plaque: plaqueNormalisee, montant: montantTotal, nb_infractions: infractions.length }
    });

    // Envoi automatique du lien de paiement par SMS. Un échec d'envoi ne doit
    // jamais empêcher l'émission de la contravention (le lien pourra être
    // renvoyé plus tard, et le paiement reste possible via l'app usager).
    let lienPaiement = null;
    try {
      lienPaiement = await creerEtEnvoyerLienPaiement(contravention, identite.telephone);
    } catch (e) {
      console.error("Échec de l'envoi du lien de paiement par SMS :", e.message);
    }

    const reponse = withStatutReel({ ...contravention, infractions }, await paiementService.tauxMajorationRetard());
    // Hors production uniquement : permet de tester le paiement sans vrai SMS.
    if (lienPaiement && process.env.NODE_ENV !== "production") {
      reponse.lien_paiement_demo = lienPaiement;
    }
    res.status(201).json(reponse);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la création de la contravention." });
  }
});

// Liste paginée et filtrée — admin voit tout, agent voit uniquement les siennes
router.get("/", authenticate, async (req, res) => {
  try {
    const { statut, niu, numero, date_debut, date_fin, page, limit } = req.query;
    const result = await db.contraventions.search({
      agentId: req.user.role === "agent" ? req.user.id : undefined,
      statut, niu, numero,
      dateDebut: date_debut, dateFin: date_fin,
      page, limit
    });
    const taux = await paiementService.tauxMajorationRetard();
    res.json({ ...result, rows: result.rows.map(c => withStatutReel(c, taux)) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur lors de la recherche." });
  }
});

// Historique par usager — réservé au personnel (agent/admin), ex: vérification sur le terrain
router.get("/usager/:niu", authenticate, requireRole("admin", "agent"), async (req, res) => {
  if (!isValidNiu(req.params.niu)) {
    return res.status(400).json({ error: "Format de NIU invalide." });
  }
  const list = await db.contraventions.byUsager(req.params.niu);
  const taux = await paiementService.tauxMajorationRetard();
  res.json(list.map(c => withStatutReel(c, taux)));
});

// Détail d'une contravention par numéro unique
router.get("/numero/:numero", async (req, res) => {
  const c = await db.contraventions.byNumero(req.params.numero);
  if (!c) return res.status(404).json({ error: "Contravention introuvable." });
  res.json(withStatutReel(c, await paiementService.tauxMajorationRetard()));
});

// QR code (PNG en data URL) encodant le numéro de contravention
router.get("/numero/:numero/qrcode", async (req, res) => {
  const c = await db.contraventions.byNumero(req.params.numero);
  if (!c) return res.status(404).json({ error: "Contravention introuvable." });
  try {
    const payload = JSON.stringify({ numero: c.numero_unique, niu: c.niu_usager, montant: c.montant });
    const dataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 220 });
    res.json({ dataUrl });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur lors de la génération du QR code." });
  }
});

// Preuve photo — accès authentifié uniquement (agent ou admin), jamais public
router.get("/numero/:numero/photo", authenticate, async (req, res) => {
  const c = await db.contraventions.byNumero(req.params.numero);
  if (!c || !c.photo_path) return res.status(404).json({ error: "Aucune photo pour cette contravention." });
  if (req.user.role === "agent" && c.agent_id !== req.user.id) {
    return res.status(403).json({ error: "Accès refusé." });
  }
  const filePath = path.join(UPLOAD_DIR, c.photo_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Fichier introuvable." });
  res.sendFile(filePath);
});

router.get("/:id", authenticate, async (req, res) => {
  const c = await db.contraventions.byId(req.params.id);
  if (!c) return res.status(404).json({ error: "Contravention introuvable." });
  res.json(withStatutReel(c, await paiementService.tauxMajorationRetard()));
});

module.exports = router;

