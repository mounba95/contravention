import { useState } from "react";
import { getSession, clearSession } from "../shared/api";
import LoginCard from "../shared/components/LoginCard";
import TopBar from "../shared/components/TopBar";
import EmettreTab from "./components/EmettreTab";
import HistoriqueTab from "./components/HistoriqueTab";

export default function App() {
  const sessionInitiale = (() => {
    const s = getSession();
    return s && s.user.role === "agent" ? s : null;
  })();

  const [session, setSession] = useState(sessionInitiale);
  const [onglet, setOnglet] = useState("emettre");
  const [refreshHistorique, setRefreshHistorique] = useState(0);

  function seDeconnecter() {
    clearSession();
    setSession(null);
  }

  if (!session) {
    return (
      <LoginCard
        tag="👮 Police Nationale"
        title="Poste Agent"
        role="agent"
        demoHint="Démo : agent007 / agent123"
        onLogin={setSession}
      />
    );
  }

  return (
    <>
      <TopBar
        tag="RNP · NIU"
        title="Contraventions — Terrain"
        who={`${session.user.nom}${session.user.station ? " · " + session.user.station : ""}`}
        onLogout={seDeconnecter}
      />
      <div className="wrap">
        <h1 className="page-title">🚓 Émettre une contravention</h1>
        <p className="page-subtitle">Identification via Numéro d'Identifiant Unique (NIU)</p>

        <div className="tabs">
          <button className={onglet === "emettre" ? "active" : ""} onClick={() => setOnglet("emettre")}>📝 Émettre</button>
          <button className={onglet === "historique" ? "active" : ""} onClick={() => setOnglet("historique")}>📋 Historique</button>
        </div>

        {onglet === "emettre" && (
          <EmettreTab onCreated={() => setRefreshHistorique(n => n + 1)} />
        )}
        {onglet === "historique" && (
          <HistoriqueTab refreshKey={refreshHistorique} />
        )}
      </div>
    </>
  );
}
