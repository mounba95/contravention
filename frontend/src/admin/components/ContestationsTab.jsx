import { useState, useEffect, useCallback } from "react";
import { api } from "../../shared/api";
import Card from "../../shared/components/Card";

function statutBadgeClass(statut) {
  if (statut === "EN_ATTENTE") return "NON_PAYEE";
  if (statut === "ACCEPTEE") return "ANNULEE";
  return "EN_RETARD";
}

export default function ContestationsTab() {
  const [liste, setListe] = useState(null);

  const charger = useCallback(async () => {
    const data = await api("/api/contestations", "GET");
    setListe(data);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  async function decider(id, decision) {
    const commentaire = prompt(decision === "ACCEPTEE" ? "Commentaire (motif d'acceptation) :" : "Commentaire (motif de rejet) :") || "";
    try {
      await api(`/api/contestations/${id}/decision`, "PUT", { decision, commentaire });
      charger();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <Card title="⚖️ Contestations à traiter">
      {!liste && <div className="empty-state">Chargement…</div>}
      {liste && liste.length === 0 && <div className="empty-state">Aucune contestation en attente.</div>}
      {liste && liste.map(c => (
        <div className="card" key={c.id} style={{ marginBottom: 12, boxShadow: "none", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <strong>{c.numero_contravention}</strong> — NIU {c.niu_usager}<br />
              <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>Déposée le {new Date(c.date_creation).toLocaleDateString("fr-FR")}</span>
            </div>
            <span className={`stamp ${statutBadgeClass(c.statut)}`}>{c.statut.replace("_", " ")}</span>
          </div>
          <p style={{ margin: "12px 0" }}><em>Motif :</em> {c.motif}</p>
          {c.statut === "EN_ATTENTE" ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button className="secondary" onClick={() => decider(c.id, "ACCEPTEE")}>Accepter (annuler l'amende)</button>
              <button className="secondary" onClick={() => decider(c.id, "REJETEE")}>Rejeter</button>
            </div>
          ) : (
            <div style={{ color: "var(--ink-soft)", fontSize: 13 }}>Décision : {c.decision_commentaire || "—"}</div>
          )}
        </div>
      ))}
    </Card>
  );
}
