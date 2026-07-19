/**
 * ============================================================================
 * POINT D'INTÉGRATION PAIEMENT — MyNita / AmanaTa (collecte par téléphone)
 * ============================================================================
 *
 * Au Niger, MyNita propose une vraie API marchande ("API de paiement en
 * ligne simple, sécurisée et facilement intégrable" — confirmé par NITA lors
 * de leur Meet-Up B2B de juin 2025, déjà utilisée par d'autres apps
 * nigériennes comme DirectGo). C'est ce modèle qu'on prépare ici :
 *
 *   1. L'usager tape juste son numéro de téléphone dans NOTRE application.
 *   2. Notre serveur appelle l'API du fournisseur (MyNita ou AmanaTa) avec
 *      ce numéro + le montant + une référence.
 *   3. Le fournisseur envoie une demande d'approbation directement sur le
 *      compte de l'usager (dans SON application MyNita/AmanaTa) — jamais
 *      dans la nôtre, il valide avec son propre code PIN.
 *   4. Le fournisseur nous confirme (webhook) → on marque la contravention payée.
 *
 * L'usager ne quitte jamais visuellement notre application (contrairement à
 * un QR code à scanner) — il tape son numéro, le reste se passe côté fournisseur.
 *
 * C'est le SEUL fichier à modifier une fois qu'un accord marchand est signé
 * avec NITA (MyNita) et/ou Amana Transfert (AmanaTa). Aucune autre partie du
 * système n'a besoin de changer.
 *
 * ----------------------------------------------------------------------------
 * SIMULATION ACTUELLE (développement/démonstration)
 * ----------------------------------------------------------------------------
 * Approuve instantanément (pas de vrai appel réseau, pas de vraie demande
 * envoyée). Permet de tester tout le flux (interface, statut, reçu) sans
 * accès réel à l'API MyNita/AmanaTa.
 *
 * ----------------------------------------------------------------------------
 * POUR BRANCHER LA VRAIE COLLECTE MYNITA / AMANATA
 * ----------------------------------------------------------------------------
 * 1. Ouvrir un compte marchand chez NITA et/ou Amana Transfert, récupérer les
 *    identifiants API (clé marchand, secret).
 * 2. Remplacer `demanderCollecte` par l'appel réel, par exemple :
 *
 *   async function demanderCollecte({ telephone, montant, reference, fournisseur }) {
 *     const url = fournisseur === "MYNITA"
 *       ? "https://api.mynita.ne/v1/collecte"
 *       : "https://api.amanata.ne/v1/collecte";
 *     const res = await fetch(url, {
 *       method: "POST",
 *       headers: { Authorization: `Bearer ${process.env.MYNITA_API_KEY}`, "Content-Type": "application/json" },
 *       body: JSON.stringify({ telephone, montant, reference })
 *     });
 *     if (!res.ok) throw new Error("Échec de la demande de paiement.");
 *     return await res.json(); // ex: { statut: "EN_ATTENTE", id_transaction: "..." }
 *   }
 *
 * 3. Ajouter une route qui reçoit le webhook de confirmation du fournisseur
 *    et appelle `db.contraventions.updateStatut(id, "PAYEE")` automatiquement
 *    — remplace alors la confirmation instantanée simulée ci-dessous, qui
 *    devient une confirmation asynchrone (l'usager attend quelques secondes
 *    à quelques minutes selon le fournisseur).
 *
 * Variables d'environnement à prévoir : MYNITA_API_KEY, MYNITA_MERCHANT_ID,
 * AMANATA_API_KEY, AMANATA_MERCHANT_ID (selon les fournisseurs retenus).
 * ============================================================================
 */

async function demanderCollecte({ telephone, montant, reference, fournisseur }) {
  console.log(`[SIMULATION PAIEMENT] Demande de collecte ${fournisseur} — ${telephone} — ${montant} FCFA — réf ${reference}`);
  // Simulation : approuvé instantanément. En réel, ceci serait asynchrone
  // (l'usager valide dans son app MyNita/AmanaTa, puis un webhook confirme).
  return { approuve: true };
}

/**
 * Génère le contenu d'un QR code de paiement — option de secours conservée
 * pour les fournisseurs qui n'offrent qu'un paiement par QR marchand (sans
 * API de collecte directe).
 */
function genererPayloadQr({ numeroContravention, montant }) {
  return JSON.stringify({
    marchand: process.env.CODE_MARCHAND_DGECMR || "DGECMR-DEMO",
    reference: numeroContravention,
    montant
  });
}

module.exports = { demanderCollecte, genererPayloadQr };

