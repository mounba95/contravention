import { useState, useEffect } from "react";
import { api } from "../../shared/api";
import Card from "../../shared/components/Card";
import StatusPill from "../../shared/components/StatusPill";

export default function HistoriqueTab({ refreshKey }) {
  const [liste, setListe] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    api("/api/contraventions?limit=50", "GET")
      .then(data => setListe(data.rows))
      .catch(() => setErreur("Liste indisponible hors ligne."));
  }, [refreshKey]);

  return (
    <Card title="📋 Mes contraventions émises">
      {erreur && <div className="empty-state">{erreur}</div>}
      {!erreur && liste === null && <div className="empty-state">Chargement…</div>}
      {!erreur && liste && liste.length === 0 && <div className="empty-state">Aucune contravention émise pour le moment.</div>}
      {!erreur && liste && liste.length > 0 && (
        <table>
          <thead>
            <tr><th>N°</th><th>Usager</th><th>Infraction</th><th>Montant</th><th>Statut</th><th>Date</th></tr>
          </thead>
          <tbody>
            {liste.map(c => (
              <tr key={c.id}>
                <td>{c.numero_unique}</td>
                <td>{c.citoyen_prenom} {c.citoyen_nom}</td>
                <td>{c.type_infraction_libelle}</td>
                <td>{c.montant.toLocaleString("fr-FR")} FCFA</td>
                <td><StatusPill statut={c.statut} /></td>
                <td>{new Date(c.date_heure).toLocaleDateString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
