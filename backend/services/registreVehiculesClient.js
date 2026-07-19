/**
 * ============================================================================
 * POINT D'INTÉGRATION — Registre National des Véhicules (carte grise)
 * ============================================================================
 *
 * C'est le SEUL fichier à modifier le jour où le vrai registre des véhicules
 * est accessible. Aucune autre partie du système n'a besoin de changer : tout
 * passe par `trouverProprietaire(plaque)` ci-dessous.
 *
 * Rôle : à partir d'une PLAQUE d'immatriculation (la seule chose dont dispose
 * l'agent sur le terrain), retrouver le NIU du propriétaire. Le NIU permet
 * ensuite d'obtenir le téléphone via le RNP (services/rnpClient.js), pour
 * envoyer le lien de paiement par SMS.
 *
 * ----------------------------------------------------------------------------
 * SIMULATION ACTUELLE (développement/démonstration)
 * ----------------------------------------------------------------------------
 * Interroge la table locale `vehicules`, qui contient des données fictives.
 *
 * ----------------------------------------------------------------------------
 * POUR BRANCHER LE VRAI REGISTRE
 * ----------------------------------------------------------------------------
 * Remplacez le corps de `trouverProprietaire` par un appel réel (souvent une
 * API REST/SOAP protégée par certificat client, comme le RNP), par exemple :
 *
 *   async function trouverProprietaire(plaque) {
 *     const res = await fetch(`${process.env.VEHICULES_API_URL}/plaques/${normaliserPlaque(plaque)}`, { agent });
 *     if (res.status === 404) return null;
 *     if (!res.ok) throw new Error("Registre des véhicules indisponible");
 *     const data = await res.json();
 *     return { plaque: data.plaque, niu: data.niuProprietaire, marque: data.marque, modele: data.modele, couleur: data.couleur };
 *   }
 *
 * Variables d'environnement à prévoir : VEHICULES_API_URL (+ certificats mTLS).
 * ============================================================================
 */
const db = require("../db/store");
const { normaliserPlaque } = require("../middleware/validators");

/**
 * Retrouve le véhicule et le NIU de son propriétaire à partir d'une plaque.
 * @returns {Promise<{plaque, niu, marque, modele, couleur} | null>}
 *          null si la plaque est inconnue du registre.
 */
async function trouverProprietaire(plaque) {
  const vehicule = await db.vehicules.findByPlaque(normaliserPlaque(plaque));
  if (!vehicule) return null;
  return {
    plaque: vehicule.plaque,
    niu: vehicule.niu,
    marque: vehicule.marque,
    modele: vehicule.modele,
    couleur: vehicule.couleur
  };
}

module.exports = { trouverProprietaire };
