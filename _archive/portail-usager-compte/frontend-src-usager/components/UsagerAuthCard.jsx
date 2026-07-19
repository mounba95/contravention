import { useState } from "react";
import { api, saveSession } from "../../shared/api";
import Message from "../../shared/components/Message";

export default function UsagerAuthCard({ onLogin }) {
  const [mode, setMode] = useState("connexion"); // "connexion" | "inscription" | "mot-de-passe-oublie" | "reinitialisation"
  const [niu, setNiu] = useState("");
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [message, setMessage] = useState(null);
  const [chargement, setChargement] = useState(false);

  async function soumettre(e) {
    e.preventDefault();
    setMessage(null);
    setChargement(true);
    try {
      if (mode === "inscription") {
        await api("/api/usager/inscription", "POST", { niu: niu.trim(), telephone: telephone.trim(), password }, false);
        setMessage({ texte: "Inscription réussie ! Vous pouvez maintenant vous connecter.", ok: true });
        setMode("connexion");
        setPassword("");
      } else if (mode === "mot-de-passe-oublie") {
        const res = await api("/api/usager/mot-de-passe-oublie", "POST", { niu: niu.trim() }, false);
        setMessage({ texte: res.code_demo ? `${res.message} (démo : code = ${res.code_demo})` : res.message, ok: true });
        setMode("reinitialisation");
      } else if (mode === "reinitialisation") {
        await api("/api/usager/reinitialiser-mot-de-passe", "POST", { niu: niu.trim(), code: code.trim(), nouveauMotDePasse }, false);
        setMessage({ texte: "Mot de passe réinitialisé ! Vous pouvez maintenant vous connecter.", ok: true });
        setMode("connexion");
        setPassword(""); setCode(""); setNouveauMotDePasse("");
      } else {
        const data = await api("/api/usager/connexion", "POST", { niu: niu.trim(), password }, false);
        saveSession(data);
        onLogin(data);
      }
    } catch (err) {
      setMessage({ texte: err.message, ok: false });
    } finally {
      setChargement(false);
    }
  }

  const titres = {
    connexion: "Connexion Usager",
    inscription: "Créer mon compte",
    "mot-de-passe-oublie": "Mot de passe oublié",
    reinitialisation: "Nouveau mot de passe"
  };

  return (
    <div className="login-shell">
      <div className="card">
        <div className="brand-lockup">
          <div className="tag">RNP · NIU</div>
          <h1>{titres[mode]}</h1>
        </div>

        <form onSubmit={soumettre}>
          <label>Numéro d'Identifiant Unique (NIU)</label>
          <input value={niu} onChange={e => setNiu(e.target.value)} placeholder="NIU-100234567" />

          {mode === "inscription" && (
            <>
              <label>Numéro de téléphone (celui enregistré au RNP)</label>
              <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+227 90 00 11 22" />
            </>
          )}

          {(mode === "connexion" || mode === "inscription") && (
            <>
              <label>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6 caractères minimum" />
            </>
          )}

          {mode === "reinitialisation" && (
            <>
              <label>Code reçu par SMS</label>
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" />
              <label>Nouveau mot de passe</label>
              <input type="password" value={nouveauMotDePasse} onChange={e => setNouveauMotDePasse(e.target.value)} placeholder="6 caractères minimum" />
            </>
          )}

          <button className="primary" style={{ width: "100%" }} disabled={chargement}>
            {chargement ? "Un instant…" : mode === "connexion" ? "Se connecter"
              : mode === "inscription" ? "Créer mon compte"
              : mode === "mot-de-passe-oublie" ? "Recevoir un code"
              : "Réinitialiser le mot de passe"}
          </button>
        </form>

        <Message texte={message?.texte} ok={message?.ok} />

        <div className="footnote">
          {mode === "connexion" && (
            <>
              <a href="#" onClick={e => { e.preventDefault(); setMode("inscription"); setMessage(null); }}>Créer un compte</a>
              {" · "}
              <a href="#" onClick={e => { e.preventDefault(); setMode("mot-de-passe-oublie"); setMessage(null); }}>Mot de passe oublié ?</a>
            </>
          )}
          {mode !== "connexion" && (
            <a href="#" onClick={e => { e.preventDefault(); setMode("connexion"); setMessage(null); }}>← Retour à la connexion</a>
          )}
        </div>
      </div>
    </div>
  );
}
