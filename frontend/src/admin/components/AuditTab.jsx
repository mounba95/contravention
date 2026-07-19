import { useState, useEffect } from "react";
import { api } from "../../shared/api";
import Card from "../../shared/components/Card";

export default function AuditTab() {
  const [liste, setListe] = useState(null);
  const [integrite, setIntegrite] = useState(null);

  useEffect(() => {
    api("/api/audit", "GET").then(setListe);
    api("/api/audit/verify", "GET").then(setIntegrite);
  }, []);

  return (
    <Card title="🔒 Journal d'audit (chaîne infalsifiable)">
      {integrite && (
        <div className={`msg ${integrite.valid ? "ok" : "err"}`} style={{ marginBottom: 14 }}>
          {integrite.valid ? "✓ Intégrité de la chaîne vérifiée — aucune altération détectée." : "⚠ Rupture de chaîne détectée — altération possible du journal."}
        </div>
      )}
      {!liste && <div className="empty-state">Chargement…</div>}
      {liste && liste.length === 0 && <div className="empty-state">Aucune entrée d'audit.</div>}
      {liste && liste.length > 0 && (
        <table>
          <thead>
            <tr><th>Horodatage</th><th>Utilisateur</th><th>Rôle</th><th>Action</th><th>Détails</th></tr>
          </thead>
          <tbody>
            {liste.map(e => (
              <tr key={e.id}>
                <td>{new Date(e.timestamp).toLocaleString("fr-FR")}</td>
                <td>{e.username}</td>
                <td>{e.role}</td>
                <td>{e.action}</td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: 11.5 }}>{JSON.stringify(e.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
