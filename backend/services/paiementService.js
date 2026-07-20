/**
 * Logique de paiement d'une contravention. Le paiement se fait exclusivement
 * via le lien reçu par SMS, sans compte (routes/paiementLien.js).
 *
 * Ne fait aucune vérification d'autorisation : l'appelant a déjà établi que
 * l'acteur a le droit de payer CETTE contravention (token de lien valide).
 */
const { v4: uuid } = require("uuid");
const db = require("../db/store");
const paiementClient = require("./paiementClient");
const { logAction } = require("../middleware/audit");
const { isValidTelephone } = require("../middleware/validators");

const FOURNISSEURS_VALIDES = ["MYNITA", "AMANATA", "WALLET", "BANQUE"];
const FOURNISSEURS_TELEPHONE = ["MYNITA", "AMANATA"];
const TAUX_MAJORATION_DEFAUT = 5; // % — utilisé si le paramètre n'existe pas encore en base

function genererReference() {
  return "REC-" + Date.now().toString(36).toUpperCase() + "-" + Math.floor(1000 + Math.random() * 8999);
}

function estEnRetard(contravention) {
  return new Date() > new Date(contravention.date_echeance);
}

/**
 * Taux de majoration de retard COURANT (%), modifiable depuis
 * l'Administration. N'est utilisé que pour figer le taux sur une NOUVELLE
 * contravention au moment de sa création (voir routes/contraventions.js) —
 * jamais pour recalculer une contravention déjà émise, sous peine de rendre
 * un changement de taux rétroactif.
 */
async function tauxMajorationRetard() {
  const valeur = await db.parametres.get("taux_majoration_retard");
  const taux = valeur !== null ? Number(valeur) : NaN;
  return Number.isFinite(taux) ? taux : TAUX_MAJORATION_DEFAUT;
}

/**
 * Montant réellement dû aujourd'hui pour une contravention : le montant
 * initial, majoré une seule fois (pas de cumul dans le temps) si l'échéance
 * est dépassée et que la contravention n'est ni payée, ni contestée, ni
 * annulée. Utilise le taux FIGÉ sur la contravention elle-même (celui en
 * vigueur au moment de son émission) — pas le taux courant du paramètre,
 * qui a pu changer depuis sans effet rétroactif sur cette contravention.
 */
function calculerMontantDu(contravention) {
  if (["PAYEE", "CONTESTEE", "ANNULEE"].includes(contravention.statut)) return contravention.montant;
  if (!estEnRetard(contravention)) return contravention.montant;
  const taux = Number(contravention.taux_majoration_retard);
  const tauxEffectif = Number.isFinite(taux) ? taux : TAUX_MAJORATION_DEFAUT;
  return Math.round(contravention.montant * (1 + tauxEffectif / 100));
}

/** Alias asynchrone de calculerMontantDu (conservé pour les appelants existants). */
async function montantDu(contravention) {
  return calculerMontantDu(contravention);
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

  // Montant réellement dû : majoré une seule fois si l'échéance est dépassée
  // (voir calculerMontantDu ci-dessus) — c'est ce montant qui est collecté et
  // enregistré, pas le montant initial de la contravention.
  const montantAPayer = await montantDu(contravention);

  // Déclenche la demande de collecte auprès du fournisseur (simulée pour
  // l'instant — approuvée instantanément ; en réel, asynchrone via webhook,
  // voir services/paiementClient.js).
  if (FOURNISSEURS_TELEPHONE.includes(methode)) {
    const resultat = await paiementClient.demanderCollecte({
      telephone: numero_telephone,
      montant: montantAPayer,
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
    montant: montantAPayer,
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
      montant_initial: contravention.montant,
      montant_paye: montantAPayer,
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
      montant: montantAPayer,
      type_infraction: contravention.type_infraction_libelle,
      reference: paiement.reference,
      date: paiement.date_paiement
    }
  };
}

module.exports = { payerContravention, FOURNISSEURS_VALIDES, montantDu, calculerMontantDu, tauxMajorationRetard };
