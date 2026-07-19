import { useState } from "react";
import { getSession, clearSession } from "../shared/api";
import LoginCard from "../shared/components/LoginCard";
import TopBar from "../shared/components/TopBar";
import DashboardTab from "./components/DashboardTab";
import ContraventionsTab from "./components/ContraventionsTab";
import ContestationsTab from "./components/ContestationsTab";
import AuditTab from "./components/AuditTab";
import AgentsTab from "./components/AgentsTab";
import InfractionsTab from "./components/InfractionsTab";

export default function App() {
  const sessionInitiale = (() => {
    const s = getSession();
    return s && s.user.role === "admin" ? s : null;
  })();

  const [session, setSession] = useState(sessionInitiale);
  const [onglet, setOnglet] = useState("dashboard");

  function seDeconnecter() {
    clearSession();
    setSession(null);
  }

  if (!session) {
    return (
      <LoginCard
        tag="🏛️ Ministère de l'Intérieur"
        title="Administration"
        role="admin"
        demoHint="Démo : admin / admin123"
        onLogin={setSession}
      />
    );
  }

  return (
    <>
      <TopBar
        tag="RNP · NIU"
        title="Contraventions — Administration"
        who={session.user.nom}
        onLogout={seDeconnecter}
      />
      <div className="wrap wide">
        <h1 className="page-title">📊 Tableau de bord</h1>
        <p className="page-subtitle">Suivi, traçabilité et pilotage du système</p>

        <div className="tabs">
          <button className={onglet === "dashboard" ? "active" : ""} onClick={() => setOnglet("dashboard")}>📊 Tableau de bord</button>
          <button className={onglet === "contraventions" ? "active" : ""} onClick={() => setOnglet("contraventions")}>🎟️ Contraventions</button>
          <button className={onglet === "contestations" ? "active" : ""} onClick={() => setOnglet("contestations")}>⚖️ Contestations</button>
          <button className={onglet === "audit" ? "active" : ""} onClick={() => setOnglet("audit")}>🔒 Audit</button>
          <button className={onglet === "agents" ? "active" : ""} onClick={() => setOnglet("agents")}>👮 Agents</button>
          <button className={onglet === "infractions" ? "active" : ""} onClick={() => setOnglet("infractions")}>🚦 Infractions</button>
        </div>

        {onglet === "dashboard" && <DashboardTab />}
        {onglet === "contraventions" && <ContraventionsTab />}
        {onglet === "contestations" && <ContestationsTab />}
        {onglet === "audit" && <AuditTab />}
        {onglet === "agents" && <AgentsTab />}
        {onglet === "infractions" && <InfractionsTab />}
      </div>
    </>
  );
}
