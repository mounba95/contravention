import { useState } from "react";
import { api, saveSession } from "../api";
import Message from "./Message";

export default function LoginCard({ tag, title, role, demoHint, onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  async function seConnecter(e) {
    e.preventDefault();
    setErreur("");
    if (!username.trim() || !password) {
      setErreur("Identifiant et mot de passe requis.");
      return;
    }
    setChargement(true);
    try {
      const data = await api("/api/auth/login", "POST", { username: username.trim(), password }, false);
      if (data.user.role !== role) {
        setErreur(`Ce compte n'est pas un compte ${role === "admin" ? "administrateur" : "agent"}.`);
        return;
      }
      saveSession(data);
      onLogin(data);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="card">
        <div className="brand-lockup">
          <div className="tag">{tag}</div>
          <h1>{title}</h1>
        </div>
        <form onSubmit={seConnecter}>
          <label>Identifiant</label>
          <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" />
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          <button className="primary" style={{ width: "100%" }} disabled={chargement}>
            {chargement ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <Message texte={erreur} ok={false} />
        {demoHint && <div className="footnote">{demoHint}</div>}
      </div>
    </div>
  );
}
