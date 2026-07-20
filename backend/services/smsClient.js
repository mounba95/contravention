/**
 * ============================================================================
 * POINT D'INTÉGRATION SMS — envoi du lien de paiement/contestation
 * ============================================================================
 *
 * C'est le SEUL fichier à modifier pour brancher un vrai envoi de SMS
 * (via un agrégateur télécom local, Twilio, Africa's Talking, etc.).
 * Aucune autre partie du système n'a besoin de changer.
 *
 * ----------------------------------------------------------------------------
 * SIMULATION ACTUELLE (développement/démonstration)
 * ----------------------------------------------------------------------------
 * N'envoie aucun vrai SMS. Le lien est simplement journalisé (console) et,
 * hors production (NODE_ENV !== "production"), renvoyé directement par l'API
 * pour permettre de tester sans téléphone réel (voir routes/contraventions.js).
 *
 * ----------------------------------------------------------------------------
 * POUR BRANCHER UN VRAI ENVOI DE SMS
 * ----------------------------------------------------------------------------
 * Remplacez le corps de `envoyerLienPaiement` par un appel réel à
 * l'agrégateur choisi, par exemple avec Africa's Talking (courant en Afrique
 * de l'Ouest) :
 *
 *   async function envoyerLienPaiement(telephone, lien, { numero, montant, message }) {
 *     const res = await fetch("https://api.africastalking.com/version1/messaging", {
 *       method: "POST",
 *       headers: {
 *         apiKey: process.env.SMS_API_KEY,
 *         "Content-Type": "application/x-www-form-urlencoded"
 *       },
 *       body: new URLSearchParams({
 *         username: process.env.SMS_USERNAME,
 *         to: telephone,
 *         message
 *       })
 *     });
 *     if (!res.ok) throw new Error("Échec de l'envoi du SMS");
 *   }
 *
 * Variables d'environnement à prévoir dans backend/.env : SMS_API_KEY,
 * SMS_USERNAME (ou équivalent selon le fournisseur retenu).
 * ============================================================================
 */

/**
 * Envoie le lien de paiement d'une contravention. Appelé automatiquement à la
 * création d'une contravention (voir routes/contraventions.js) vers le numéro
 * de téléphone enrôlé au RNP. Le citoyen clique et paie depuis une simple page
 * web — sans compte ni installation d'application. Le message prévient dès
 * l'envoi qu'un retard de paiement après l'échéance entraîne une majoration,
 * pour que le citoyen soit informé avant, pas seulement une fois en retard.
 */
async function envoyerLienPaiement(telephone, lien, { numero, montant, dateEcheance, tauxMajoration } = {}) {
  const echeanceTexte = dateEcheance
    ? new Date(dateEcheance).toLocaleDateString("fr-FR")
    : null;
  const message = `Contravention ${numero || "?"} : ${montant != null ? montant + " FCFA" : "?"}.` +
    (echeanceTexte ? ` A payer avant le ${echeanceTexte}` : "") +
    (tauxMajoration ? ` (majoration de ${tauxMajoration}% passé ce délai)` : "") +
    `. Payez en ligne : ${lien}`;

  console.log(`[SIMULATION SMS] Envoyé à ${telephone} : ${message}`);
  // Branchement réel : voir l'exemple Africa's Talking ci-dessus, en passant
  // `message` construit ci-dessus comme corps du SMS.
}

module.exports = { envoyerLienPaiement };
