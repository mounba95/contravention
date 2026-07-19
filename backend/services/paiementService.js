/**
 * Logique de paiement d'une contravention, commune aux deux voies d'accès :
 *   - usager connecté (routes/paiements.js)
 *   - lien de paiement reçu par SMS, sans compte (routes/paiementLien.js)
 *
 * Ne fait aucune vérification d'autorisation : l'appelant a déjà établi que
 * l'acteur a le droit de payer CETTE contravention (token de lien valide, ou
 * contravention appartenant à l'usager connecté).
 */
const { v4: uuid } = require("uuid");
const db = require("../db/store");
const paiementClient = require("./paiementClient");
const { logAction } = require("../middleware/audit");
const { isValidTelephone } = require("../middleware/validators");

const FOURNISSEURS_VALIDES = ["MYNITA", "AMANATA", "WALLET", "BANQUE"];
const FOURNISSEURS_TELEPHONE = ["MYNITA", "AMANATA"];

function genererReference() {
  return "REC-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 8999);
}

/**
 * Effectue le paiement d'une contravention déjà chargée depuis la base.
 * @returns {Promise<{ok: true, paiement, recu} | {ok: false, status: number, error: string}>}
 */
async function payerContravention({ contravention, methode, numero_telephone, acteur, canal }) {
  if (!methode) {
    return { ok: false, status: 400, error: "Méthode de paiement requise." };
  }
  if (!FOURNISSEURS_VALIDES.includes(methode)) {
    return { ok: false, status: 400, error: "Méthode de paiement invalide." };
  }
  if (FOURNISSEURS_TELEPHONE.includes(methode) && !numero_telephone) {
    return { ok: false, status: 400, error: "Le numéro de téléphone est requis pour ce mode de paiement." };
  }
  if (numero_telephone && !isValidTelephone(numero_telephone)) {
    return { ok: false, status: 400, error: "Format de numéro de téléphone invalide." };
  }

  // Le statut stocké fait foi : une contravention EN_RETARD reste "NON_PAYEE"
  // en base et donc payable (l'échéance dépassée ne l'empêche pas).
  if (contravention.statut === "PAYEE") {
    return { ok: false, status: 409, error: "Cette contravention a déjà été payée." };
  }
  if (contravention.statut === "CONTESTEE") {
    return { ok: false, status: 409, error: "Cette contravention est en cours de contestation et ne peut être payée." };
  }
  if (contravention.statut === "ANNULEE") {
    return { ok: false, status: 409, error: "Cette contravention a été annulée et ne peut être payée." };
  }

  // Déclenche la demande de collecte auprès du fournisseur (simulée pour
  // l'instant — approuvée instantanément ; en réel, asynchrone via webhook,
  // voir services/paiementClient.js).
  if (FOURNISSEURS_TELEPHONE.includes(methode)) {
    const resultat = await paiementClient.demanderCollecte({
      telephone: numero_telephone,
      montant: contravention.montant,
      reference: contravention.numero_unique,
      fournisseur: methode
    });
    if (!resultat.approuve) {
      return { ok: false, status: 402, error: "Le paiement n'a pas été approuvé. Vérifiez votre solde et réessayez." };
    }
  }

  const paiement = {
    id: uuid(),
    contravention_id: contravention.id,
    numero_contravention: contravention.numero_unique,
    montant: contravention.montant,
    methode,
    numero_telephone: numero_telephone || null,
    reference: genererReference(),
    date_paiement: new Date().toISOString(),
    statut: "CONFIRME"
  };

  await db.paiements.insert(paiement);
  await db.contraventions.updateStatut(contravention.id, "PAYEE");

  await logAction({
    userId: acteur.userId,
    username: acteur.username,
    role: acteur.role,
    action: "PAIEMENT_CONTRAVENTION",
    details: {
      numero_contravention: contravention.numero_unique,
      montant: contravention.montant,
      methode,
      reference: paiement.reference,
      canal: canal || "APP"
    }
  });

  return {
    ok: true,
    paiement,
    recu: {
      numero_contravention: contravention.numero_unique,
      montant: contravention.montant,
      type_infraction: contravention.type_infraction_libelle,
      reference: paiement.reference,
      date: paiement.date_paiement
    }
  };
}

module.exports = { payerContravention, FOURNISSEURS_VALIDES };
