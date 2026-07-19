import { useState, useEffect, useCallback } from "react";
import { api, getSession, telechargerExport } from "../../shared/api";
import Card from "../../shared/components/Card";
import StatusPill from "../../shared/components/StatusPill";

export default function ContraventionsTab() {
  const [filtres, setFiltres] = useState({ niu: "", numero: "", statut: "", dateDebut: "", dateFin: "" });
  const [donnees, setDonnees] = useState(null);
  const [page, setPage] = useState(1);

  const charger = useCallback(async (p = page) => {
    const params = new URLSearchParams({ page: p, limit: 20 });
    if (filtres.niu) params.set("niu", filtres.niu);
    if (filtres.numero) params.set("numero", filtres.numero);
    if (filtres.statut) params.set("statut", filtres.statut);
    if (filtres.dateDebut) params.set("date_debut", filtres.dateDebut);
    if (filtres.dateFin) params.set("date_fin", filtres.dateFin + "T23:59:59");
    const data = await api(`/api/contraventions?${params.toString()}`, "GET");
    setDonnees(data);
    setPage(data.page);
  }, [filtres, page]);

  useEffect(() => { charger(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function voirPhoto(numero) {
    try {
      const session = getSession();
      const res = await fetch(`/api/contraventions/numero/${numero}/photo`, {
        headers: { Authorization: `Bearer ${session.token}` }
      });
      if (!res.ok) { alert("Impossible de charger la photo."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {
      alert("Erreur lors du chargement de la photo.");
    }
  }

  function construireQueryExport() {
    const params = new URLSearchParams();
    if (filtres.niu) params.set("niu", filtres.niu);
    if (filtres.numero) params.set("numero", filtres.numero);
    if (filtres.statut) params.set("statut", filtres.statut);
    if (filtres.dateDebut) params.set("date_debut", filtres.dateDebut);
    if (filtres.dateFin) params.set("date_fin", filtres.dateFin + "T23:59:59");
    return params.toString();
  }

  return (
    <Card title="🎟️ Toutes les contraventions">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 6 }}>
        <div><label>NIU</label><input value={filtres.niu} onChange={e => setFiltres({ ...filtres, niu: e.target.value })} placeholder="NIU-..." /></div>
        <div><label>N° contravention</label><input value={filtres.numero} onChange={e => setFiltres({ ...filtres, numero: e.target.value })} placeholder="CTV-..." /></div>
        <div>
          <label>Statut</label>
          <select value={filtres.statut} onChange={e => setFiltres({ ...filtres, statut: e.target.value })}>
            <option value="">Tous</option>
            <option value="NON_PAYEE">Non payée</option>
            <option value="PAYEE">Payée</option>
            <option value="EN_RETARD">En retard</option>
            <option value="CONTESTEE">Contestée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
        </div>
        <div><label>Du</label><input type="date" value={filtres.dateDebut} onChange={e => setFiltres({ ...filtres, dateDebut: e.target.value })} /></div>
        <div><label>Au</label><input type="date" value={filtres.dateFin} onChange={e => setFiltres({ ...filtres, dateFin: e.target.value })} /></div>
      </div>

      <div style={{ display: "flex", gap: 10, margin: "14px 0 6px", flexWrap: "wrap" }}>
        <button className="primary" style={{ marginTop: 0 }} onClick={() => charger(1)}>Filtrer</button>
        <button className="secondary" onClick={() => { setFiltres({ niu: "", numero: "", statut: "", dateDebut: "", dateFin: "" }); charger(1); }}>Réinitialiser</button>
        <button className="secondary" onClick={() => telechargerExport(`/api/export/contraventions.csv?${construireQueryExport()}`, `contraventions_${new Date().toISOString().slice(0, 10)}.csv`)}>Exporter CSV (contraventions)</button>
        <button className="secondary" onClick={() => telechargerExport("/api/export/paiements.csv", `paiements_${new Date().toISOString().slice(0, 10)}.csv`)}>Exporter CSV (paiements)</button>
      </div>

      {!donnees && <div className="empty-state">Chargement…</div>}
      {donnees && donnees.rows.length === 0 && <div className="empty-state">Aucune contravention ne correspond à ces critères.</div>}
      {donnees && donnees.rows.length > 0 && (
        <>
          <table>
            <thead>
              <tr><th>N°</th><th>Usager</th><th>Agent</th><th>Infraction</th><th>Lieu</th><th>Montant</th><th>Statut</th><th>Date</th><th>Preuve</th></tr>
            </thead>
            <tbody>
              {donnees.rows.map(c => (
                <tr key={c.id}>
                  <td>{c.numero_unique}</td>
                  <td>{c.citoyen_prenom} {c.citoyen_nom}</td>
                  <td>{c.agent_nom}</td>
                  <td>{c.type_infraction_libelle}</td>
                  <td>{c.lieu}</td>
                  <td>{c.montant.toLocaleString("fr-FR")} FCFA</td>
                  <td><StatusPill statut={c.statut} /></td>
                  <td>{new Date(c.date_heure).toLocaleDateString("fr-FR")}</td>
                  <td>{c.a_une_photo ? <a href="#" onClick={e => { e.preventDefault(); voirPhoto(c.numero_unique); }}>Voir</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, fontSize: 12.5 }}>
            <span>{donnees.total} résultat(s) — page {donnees.page}/{donnees.totalPages}</span>
            <span>
              <button className="secondary" disabled={donnees.page <= 1} onClick={() => charger(donnees.page - 1)}>← Précédent</button>{" "}
              <button className="secondary" disabled={donnees.page >= donnees.totalPages} onClick={() => charger(donnees.page + 1)}>Suivant →</button>
            </span>
          </div>
        </>
      )}
    </Card>
  );
}
