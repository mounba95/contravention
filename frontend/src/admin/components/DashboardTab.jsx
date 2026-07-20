import { useState, useEffect, useCallback } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from "chart.js";
import { Doughnut, Bar } from "react-chartjs-2";
import { api } from "../../shared/api";

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const STATUT_LIBELLES = { NON_PAYEE: "Non payée", PAYEE: "Payée", EN_RETARD: "En retard", CONTESTEE: "Contestée", ANNULEE: "Annulée" };
const STATUT_COULEURS = { "Non payée": "#F5A524", "Payée": "#12B886", "En retard": "#F0453A", "Contestée": "#8B5CF6", "Annulée": "#8A93AC" };
const PALETTE = ["#3A5CF0", "#12B886", "#F5A524", "#F0453A", "#8B5CF6", "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"];

const donutOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { position: "bottom", labels: { font: { family: "Inter", size: 11.5, weight: "600" }, padding: 14, usePointStyle: true, pointStyle: "circle" } } },
  cutout: "62%"
};

const barOptions = {
  responsive: true, maintainAspectRatio: false, indexAxis: "y",
  plugins: { legend: { display: false } },
  scales: {
    x: { beginAtZero: true, ticks: { precision: 0, font: { family: "Inter", size: 11 } }, grid: { color: "#E5E9F2" } },
    y: { ticks: { font: { family: "Inter", size: 11.5, weight: "600" } }, grid: { display: false } }
  }
};

function DonutOrEmpty({ dataObj, colors }) {
  const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0 || entries.every(([, v]) => v === 0)) {
    return <div className="empty-state">Aucune donnée pour le moment.</div>;
  }
  const data = {
    labels: entries.map(([k]) => k),
    datasets: [{ data: entries.map(([, v]) => v), backgroundColor: colors || PALETTE, borderWidth: 2, borderColor: "#fff" }]
  };
  return <div className="chart-wrap"><Doughnut data={data} options={donutOptions} /></div>;
}

function BarOrEmpty({ dataObj }) {
  const entries = Object.entries(dataObj).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (entries.length === 0) {
    return <div className="empty-state">Aucune donnée pour le moment.</div>;
  }
  const data = {
    labels: entries.map(([k]) => k),
    datasets: [{ data: entries.map(([, v]) => v), backgroundColor: "#3A5CF0", borderRadius: 8, maxBarThickness: 34 }]
  };
  return <div className="chart-wrap"><Bar data={data} options={barOptions} /></div>;
}

export default function DashboardTab() {
  const [stats, setStats] = useState(null);
  const [agents, setAgents] = useState([]);
  const [filtres, setFiltres] = useState({ dateDebut: "", dateFin: "", agentId: "" });

  const charger = useCallback(async (f = filtres) => {
    const params = new URLSearchParams();
    if (f.dateDebut) params.set("date_debut", f.dateDebut);
    if (f.dateFin) params.set("date_fin", f.dateFin + "T23:59:59");
    if (f.agentId) params.set("agent_id", f.agentId);
    const data = await api(`/api/dashboard/stats?${params.toString()}`, "GET");
    setStats(data);
  }, [filtres]);

  useEffect(() => {
    charger({ dateDebut: "", dateFin: "", agentId: "" });
    api("/api/users", "GET").then(list => setAgents(list.filter(u => u.role === "agent")));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtresActifs = filtres.dateDebut || filtres.dateFin || filtres.agentId;

  if (!stats) return <div className="empty-state">Chargement…</div>;

  const statutData = {};
  Object.entries(stats.par_statut).forEach(([k, v]) => { statutData[STATUT_LIBELLES[k] || k] = v; });
  const statutColors = Object.keys(statutData).map(k => STATUT_COULEURS[k] || "#8A93AC");

  return (
    <>
      <div className="chart-card" style={{ marginBottom: 22 }}>
        <h2>🔎 Filtrer les statistiques</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <div>
            <label>Du</label>
            <input type="date" value={filtres.dateDebut} onChange={e => setFiltres({ ...filtres, dateDebut: e.target.value })} />
          </div>
          <div>
            <label>Au</label>
            <input type="date" value={filtres.dateFin} onChange={e => setFiltres({ ...filtres, dateFin: e.target.value })} />
          </div>
          <div>
            <label>Agent</label>
            <select value={filtres.agentId} onChange={e => setFiltres({ ...filtres, agentId: e.target.value })}>
              <option value="">Tous les agents</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.nom}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="primary" style={{ marginTop: 0 }} onClick={() => charger(filtres)}>Appliquer</button>
          <button
            className="secondary"
            onClick={() => { const vide = { dateDebut: "", dateFin: "", agentId: "" }; setFiltres(vide); charger(vide); }}
          >
            Réinitialiser
          </button>
        </div>
      </div>

      <div className="grid-stats">
        <div className="stat-box" style={{ "--accent": "#3A5CF0" }}><div className="label">Total contraventions{filtresActifs ? " (filtré)" : ""}</div><div className="value">{stats.total_contraventions}</div></div>
        <div className="stat-box" style={{ "--accent": "#12B886" }}><div className="label">Recette{filtresActifs ? " (filtrée)" : " collectée"}</div><div className="value">{stats.montant_collecte.toLocaleString("fr-FR")}</div></div>
        <div className="stat-box" style={{ "--accent": "#8B5CF6" }}><div className="label">Taux de paiement</div><div className="value">{stats.taux_paiement}%</div></div>
        <div className="stat-box" style={{ "--accent": "#F5A524" }}><div className="label">Agents actifs</div><div className="value">{stats.agents_actifs}</div></div>
        <div className="stat-box" style={{ "--accent": "#F0453A" }}><div className="label">En retard</div><div className="value">{stats.par_statut.EN_RETARD || 0}</div></div>
        <div className="stat-box" style={{ "--accent": "#8A93AC" }}><div className="label">Annulées</div><div className="value">{stats.par_statut.ANNULEE || 0}</div></div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h2>🥯 Répartition par statut</h2>
          <DonutOrEmpty dataObj={statutData} colors={statutColors} />
        </div>
        <div className="chart-card">
          <h2>🚦 Infractions par type</h2>
          <DonutOrEmpty dataObj={stats.par_infraction} />
        </div>
        <div className="chart-card">
          <h2>📍 Contraventions par zone</h2>
          <BarOrEmpty dataObj={stats.par_zone} />
        </div>
        <div className="chart-card">
          <h2>👮 Contraventions par agent</h2>
          <BarOrEmpty dataObj={stats.par_agent} />
        </div>
      </div>
    </>
  );
}
