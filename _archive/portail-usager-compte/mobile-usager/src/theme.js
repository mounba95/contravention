export const colors = {
  bg: "#F3F5FA",
  surface: "#FFFFFF",
  surface2: "#F8F9FD",
  ink: "#131B33",
  inkSoft: "#626B85",
  border: "#E5E9F2",

  primary: "#3A5CF0",
  primaryDark: "#2541C4",
  primarySoft: "#3A5CF014",

  success: "#12B886",
  successSoft: "#12B88616",
  warning: "#F5A524",
  warningSoft: "#F5A52418",
  danger: "#F0453A",
  dangerSoft: "#F0453A16",
  violet: "#8B5CF6",
  violetSoft: "#8B5CF616",
  slate: "#8A93AC",
  slateSoft: "#8A93AC1A",

  // alias conservés pour compatibilité avec du code existant
  paper: "#F3F5FA",
  paperRaised: "#FFFFFF",
  line: "#E5E9F2",
  stampRed: "#F0453A",
  stampRedSoft: "#F0453A16",
  ledgerGreen: "#12B886",
  ledgerGreenSoft: "#12B88616",
  amber: "#F5A524",
  amberSoft: "#F5A52418"
};

export const typography = {
  head: { fontWeight: "800" },
  mono: { fontFamily: "monospace" }
};

export function couleurStatut(statut) {
  switch (statut) {
    case "PAYEE": return colors.success;
    case "NON_PAYEE": return colors.warning;
    case "EN_RETARD": return colors.danger;
    case "CONTESTEE": return colors.violet;
    case "ANNULEE": return colors.slate;
    default: return colors.inkSoft;
  }
}

export function libelleStatut(statut) {
  return {
    NON_PAYEE: "Non payée",
    PAYEE: "Payée",
    EN_RETARD: "En retard",
    CONTESTEE: "Contestée",
    ANNULEE: "Annulée"
  }[statut] || statut;
}
