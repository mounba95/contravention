const NIU_REGEX = /^NIU-\d{9}$/;
const TELEPHONE_REGEX = /^\+?[0-9\s]{8,15}$/;

function isValidNiu(niu) {
  return typeof niu === "string" && NIU_REGEX.test(niu.trim());
}

function isValidTelephone(tel) {
  if (!tel) return true; // optionnel selon les endpoints
  return typeof tel === "string" && TELEPHONE_REGEX.test(tel.trim());
}

/** Coupe et limite la longueur d'un champ texte libre pour éviter les abus. */
function cleanText(value, maxLength = 500) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

/**
 * Normalise une plaque d'immatriculation pour la comparaison/stockage :
 * majuscules, sans espaces ni séparateurs. Ex: "1a 2345-rn" -> "1A2345RN".
 */
function normaliserPlaque(plaque) {
  if (typeof plaque !== "string") return "";
  return plaque.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Plaque plausible : 4 à 12 caractères alphanumériques une fois normalisée. */
function isValidPlaque(plaque) {
  const n = normaliserPlaque(plaque);
  return n.length >= 4 && n.length <= 12;
}

module.exports = { isValidNiu, isValidTelephone, cleanText, normaliserPlaque, isValidPlaque };
