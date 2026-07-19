import { useState, useEffect, useCallback } from "react";
import { api, getSession, clearSession } from "../shared/api";
import TopBar from "../shared/components/TopBar";
import UsagerAuthCard from "./components/UsagerAuthCard";
import TicketCard from "./components/TicketCard";

export default function App() {
  const [session, setSession] = useState(() => {
    const s = getSession();
    return s && s.user.role === "usager" ? s : null;
  });
  const [liste, setListe] = useState(null);

  const charger = useCallback(async () => {
    try {
      const data = await api("/api/contraventions/mes", "GET");
      setListe(data);
    } catch {
      setListe([]);
    }
  }, []);

  useEffect(() => { if (session) charger(); }, [session, charger]);

  function seDeconnecter() {
    clearSession();
    setSession(null);
    setListe(null);
  }

  if (!session) {
    return <UsagerAuthCard onLogin={setSession} />;
  }

  return (
    <>
      <TopBar tag="RNP · NIU" title="Portail Usager" who={`${session.user.prenom} ${session.user.nom}`} onLogout={seDeconnecter} />
      <div className="wrap">
        <h1 className="page-title">🎫 Mes contraventions</h1>
        <p className="page-subtitle">Consultez, payez ou contestez vos amendes</p>

        {liste === null && <div className="empty-state">Chargement…</div>}
        {liste && liste.length === 0 && <div className="empty-state">Aucune contravention associée à votre compte.</div>}
        {liste && liste.length > 0 && liste.map(c => (
          <TicketCard key={c.id} contravention={c} onChanged={charger} />
        ))}
      </div>
    </>
  );
}
