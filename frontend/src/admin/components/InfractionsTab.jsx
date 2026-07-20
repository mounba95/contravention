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

  const [tauxMajoration, setTauxMajoration] = useState("");
  const [messageTaux, setMessageTaux] = useState(null);
  const [chargementTaux, setChargementTaux] = useState(false);

  const charger = useCallback(async () => {
    const data = await api("/api/contraventions/types-infraction", "GET");
    setListe(data);
  }, []);

  const chargerParametres = useCallback(async () => {
    const params = await api("/api/parametres", "GET");
    const taux = params.find(p => p.cle === "taux_majoration_retard");
    setTauxMajoration(taux ? taux.valeur : "5");
  }, []);

  useEffect(() => { charger(); chargerParametres(); }, [charger, chargerParametres]);

  async function enregistrerTaux(e) {
    e.preventDefault();
    setMessageTaux(null);
    const n = Number(tauxMajoration);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setMessageTaux({ texte: "Le taux doit être un nombre entre 0 et 100.", ok: false });
      return;
    }
    setChargementTaux(true);
    try {
      await api("/api/parametres/taux_majoration_retard", "PUT", { valeur: n });
      setMessageTaux({ texte: "Taux de majoration mis à jour.", ok: true });
    } catch (err) {
      setMessageTaux({ texte: err.message, ok: false });
    } finally {
      setChargementTaux(false);
    }
  }

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
    <>
      <Card title="⏰ Majoration de retard">
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 0 }}>
          Si une contravention n'est pas payée avant son échéance (15 jours), le montant à payer
          augmente automatiquement une seule fois de ce pourcentage.
        </p>
        <form onSubmit={enregistrerTaux} style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div>
            <label>Taux de majoration (%)</label>
            <input type="number" min="0" max="100" step="0.1" value={tauxMajoration} onChange={e => setTauxMajoration(e.target.value)} style={{ width: 120 }} />
          </div>
          <button className="primary" style={{ marginTop: 0 }} disabled={chargementTaux}>
            {chargementTaux ? "Enregistrement…" : "Enregistrer"}
          </button>
        </form>
        <Message texte={messageTaux?.texte} ok={messageTaux?.ok} />
      </Card>

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
    </>
  );
}
