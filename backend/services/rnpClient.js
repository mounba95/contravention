/**
 * ============================================================================
 * POINT D'INTÉGRATION RNP — Registre National de la Population
 * ============================================================================
 *
 * C'est le SEUL fichier à modifier le jour où le vrai RNP est opérationnel.
 * Aucune autre partie du système (routes, apps mobiles, interfaces web) n'a
 * besoin de changer : elles appellent toutes `verifierIdentite(niu)`
 * ci-dessous, jamais le RNP directement.
 *
 * ----------------------------------------------------------------------------
 * SIMULATION ACTUELLE (développement/démonstration)
 * ----------------------------------------------------------------------------
 * Interroge la table locale `citoyens`, qui contient des données fictives.
 *
 * ----------------------------------------------------------------------------
 * POUR BRANCHER LE VRAI RNP
 * ----------------------------------------------------------------------------
 * Remplacez le corps de `verifierIdentite` par un appel réel, généralement :
 *
 *   const https = require("https");
 *   const fs = require("fs");
 *
 *   const agent = new https.Agent({
 *     cert: fs.readFileSync(process.env.RNP_CLIENT_CERT_PATH),  // certificat client (mTLS)
 *     key: fs.readFileSync(process.env.RNP_CLIENT_KEY_PATH),
 *     ca: fs.readFileSync(process.env.RNP_CA_CERT_PATH)         // certificat de l'autorité RNP
 *   });
 *
 *   async function verifierIdentite(niu) {
 *     const res = await fetch(`${process.env.RNP_API_URL}/citoyens/${niu}`, { agent });
 *     if (res.status === 404) return null;
 *     if (!res.ok) throw new Error("RNP indisponible");
 *     const data = await res.json();
 *     return {
 *       niu: data.niu,
 *       nom: data.nomFamille,
 *       prenom: data.prenoms,
 *       date_naissance: data.dateNaissance,
 *       telephone: data.telephoneContact
 *     };
 *   }
 *
 * Le format exact des champs dépendra de la documentation fournie par le RNP
 * (souvent une API SOAP ou REST protégée par certificat client). Variables
 * d'environnement à prévoir dans backend/.env : RNP_API_URL,
 * RNP_CLIENT_CERT_PATH, RNP_CLIENT_KEY_PATH, RNP_CA_CERT_PATH.
 *
 * Le reste du système (contraventions.js, usagerAuth.js) reste inchangé :
 * il continuera d'appeler `verifierIdentite(niu)` exactement comme avant.
 * ============================================================================
 */
const db = require("../db/store");

/**
 * Vérifie l'identité associée à un NIU.
 * @returns {Promise<{niu, nom, prenom, date_naissance, telephone} | null>}
 *          null si le NIU n'existe pas au RNP.
 */
async function verifierIdentite(niu) {
  const citoyen = await db.citoyens.findByNiu(niu);
  if (!citoyen) return null;
  return {
    niu: citoyen.niu,
    nom: citoyen.nom,
    prenom: citoyen.prenom,
    date_naissance: citoyen.date_naissance,
    telephone: citoyen.telephone
  };
}

module.exports = { verifierIdentite };
