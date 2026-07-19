const LIBELLES = {
  NON_PAYEE: "Non payée",
  PAYEE: "Payée",
  EN_RETARD: "En retard",
  CONTESTEE: "Contestée",
  ANNULEE: "Annulée"
};

export default function StatusPill({ statut }) {
  return <span className={`stamp ${statut}`}>{LIBELLES[statut] || statut}</span>;
}

export { LIBELLES };
