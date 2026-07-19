import { useState, useEffect, useCallback } from "react";
import { api } from "../../shared/api";
import Card from "../../shared/components/Card";
import Message from "../../shared/components/Message";

export default function AgentsTab() {
  const [liste, setListe] = useState(null);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");
  const [nom, setNom] = useState("");
  const [matricule, setMatricule] = useState("");
  const [station, setStation] = useState("");
  const [message, setMessage] = useState(null);
  const [chargement, setChargement] = useState(false);

  const charger = useCallback(async () => {
    const data = await api("/api/users", "GET");
    setListe(data);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  function reinitialiserFormulaire() {
    setUsername(""); setPassword(""); setRole("agent"); setNom(""); setMatricule(""); setStation("");
  }

  async function creerCompte(e) {
    e.preventDefault();
    setMessage(null);
    setChargement(true);
    try {
      await api("/api/users", "POST", {
        username: username.trim(), password, role,
        nom: nom.trim(), matricule: matricule.trim(), station: station.trim()
      });
      setMessage({ texte: "Compte créé avec succès.", ok: true });
      reinitialiserFormulaire();
      setFormulaireOuvert(false);
      charger();
    } catch (err) {
      setMessage({ texte: err.message, ok: false });
    } finally {
      setChargement(false);
    }
  }

  async function basculerActif(u) {
    if (!confirm(u.actif ? `Désactiver le compte ${u.username} ?` : `Réactiver le compte ${u.username} ?`)) return;
    try {
      await api(`/api/users/${u.id}/statut`, "PUT", { actif: !u.actif });
      charger();
    } catch (err) {
      alert(err.message);
    }
  }

  async function reinitialiserMotDePasse(u) {
    const nouveauMdp = prompt(`Nouveau mot de passe pour ${u.username} (6 caractères minimum) :`);
    if (!nouveauMdp) return;
    try {
      await api(`/api/users/${u.id}/password`, "PUT", { password: nouveauMdp });
      alert("Mot de passe réinitialisé.");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Card title="👮 Comptes agents & administrateurs">
      <button className="primary" style={{ marginTop: 0, marginBottom: 18 }} onClick={() => setFormulaireOuvert(o => !o)}>
        {formulaireOuvert ? "Annuler" : "+ Créer un compte"}
      </button>

      {formulaireOuvert && (
        <form onSubmit={creerCompte} style={{ background: "var(--surface-2)", padding: 18, borderRadius: 14, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
            <div>
              <label>Identifiant de connexion</label>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="agent042" autoCapitalize="none" required />
            </div>
            <div>
              <label>Mot de passe initial</label>
              <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" required />
            </div>
            <div>
              <label>Rôle</label>
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="agent">Agent de police</option>
                <option value="admin">Administrateur</option>
              </select>
            </div>
            <div>
              <label>Nom complet</label>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ibrahim Souley" required />
            </div>
            {role === "agent" && (
              <>
                <div>
                  <label>Matricule</label>
                  <input value={matricule} onChange={e => setMatricule(e.target.value)} placeholder="PN-2024-0999" />
                </div>
                <div>
                  <label>Station / Commissariat</label>
                  <input value={station} onChange={e => setStation(e.target.value)} placeholder="Commissariat Central Niamey" />
                </div>
              </>
            )}
          </div>
          <button className="primary" disabled={chargement}>{chargement ? "Création…" : "Créer le compte"}</button>
          <Message texte={message?.texte} ok={message?.ok} />
        </form>
      )}

      {!liste && <div className="empty-state">Chargement…</div>}
      {liste && (
        <table>
          <thead>
            <tr><th>Identifiant</th><th>Nom</th><th>Rôle</th><th>Matricule</th><th>Station</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {liste.map(u => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.nom}</td>
                <td>{u.role === "admin" ? "Administrateur" : "Agent"}</td>
                <td>{u.matricule || "—"}</td>
                <td>{u.station || "—"}</td>
                <td><span className={`stamp ${u.actif ? "PAYEE" : "ANNULEE"}`}>{u.actif ? "Actif" : "Désactivé"}</span></td>
                <td style={{ display: "flex", gap: 8 }}>
                  <button className="secondary" onClick={() => basculerActif(u)}>{u.actif ? "Désactiver" : "Réactiver"}</button>
                  <button className="secondary" onClick={() => reinitialiserMotDePasse(u)}>Mot de passe</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
