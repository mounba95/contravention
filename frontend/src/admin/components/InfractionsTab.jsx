import { useState, useEffect, useCallback } from "react";
import { api } from "../../shared/api";
import Card from "../../shared/components/Card";
import Message from "../../shared/components/Message";

export default function InfractionsTab() {
  const [liste, setListe] = useState(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [editionId, setEditionId] = useState(null);
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [message, setMessage] = useState(null);
  const [chargement, setChargement] = useState(false);

  const charger = useCallback(async () => {
    const data = await api("/api/contraventions/types-infraction", "GET");
    setListe(data);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  function reinitialiser() {
    setLibelle(""); setMontant(""); setEditionId(null); setFormulaireOuvert(false);
  }

  function ouvrirEdition(t) {
    setEditionId(t.id);
    setLibelle(t.libelle);
    setMontant(String(t.montant));
    setFormulaireOuvert(true);
  }

  async function soumettre(e) {
    e.preventDefault();
    setMessage(null);
    if (!libelle.trim() || !montant || Number(montant) <= 0) {
      setMessage({ texte: "Libellé et montant (positif) requis.", ok: false });
      return;
    }
    setChargement(true);
    try {
      if (editionId) {
        await api(`/api/contraventions/types-infraction/${editionId}`, "PUT", { libelle: libelle.trim(), montant: Number(montant) });
        setMessage({ texte: "Type d'infraction modifié.", ok: true });
      } else {
        await api("/api/contraventions/types-infraction", "POST", { libelle: libelle.trim(), montant: Number(montant) });
        setMessage({ texte: "Type d'infraction créé.", ok: true });
      }
      reinitialiser();
      charger();
    } catch (err) {
      setMessage({ texte: err.message, ok: false });
    } finally {
      setChargement(false);
    }
  }

  async function basculerActif(t) {
    try {
      await api(`/api/contraventions/types-infraction/${t.id}/statut`, "PUT", { actif: !t.actif });
      charger();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Card title="🚦 Types d'infraction">
      <button className="primary" style={{ marginTop: 0, marginBottom: 18 }} onClick={() => { formulaireOuvert ? reinitialiser() : setFormulaireOuvert(true); }}>
        {formulaireOuvert ? "Annuler" : "+ Ajouter un type d'infraction"}
      </button>

      {formulaireOuvert && (
        <form onSubmit={soumettre} style={{ background: "var(--surface-2)", padding: 18, borderRadius: 14, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
            <div>
              <label>Libellé</label>
              <input value={libelle} onChange={e => setLibelle(e.target.value)} placeholder="Ex : Non-respect d'un stop" required />
            </div>
            <div>
              <label>Montant (FCFA)</label>
              <input type="number" min="1" value={montant} onChange={e => setMontant(e.target.value)} placeholder="10000" required />
            </div>
          </div>
          <button className="primary" disabled={chargement}>{chargement ? "Enregistrement…" : editionId ? "Enregistrer les modifications" : "Créer"}</button>
          <Message texte={message?.texte} ok={message?.ok} />
        </form>
      )}

      {!liste && <div className="empty-state">Chargement…</div>}
      {liste && (
        <table>
          <thead><tr><th>Libellé</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>
            {liste.map(t => (
              <tr key={t.id}>
                <td>{t.libelle}</td>
                <td>{t.montant.toLocaleString("fr-FR")} FCFA</td>
                <td><span className={`stamp ${t.actif ? "PAYEE" : "ANNULEE"}`}>{t.actif ? "Actif" : "Désactivé"}</span></td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button className="secondary" onClick={() => ouvrirEdition(t)}>Modifier</button>
                  <button className="secondary" onClick={() => basculerActif(t)}>{t.actif ? "Désactiver" : "Réactiver"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
