import { useState, useEffect } from "react";
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

  useEffect(() => {
    api("/api/dashboard/stats", "GET").then(setStats);
  }, []);

  if (!stats) return <div className="empty-state">Chargement…</div>;

  const statutData = {};
  Object.entries(stats.par_statut).forEach(([k, v]) => { statutData[STATUT_LIBELLES[k] || k] = v; });
  const statutColors = Object.keys(statutData).map(k => STATUT_COULEURS[k] || "#8A93AC");

  return (
    <>
      <div className="grid-stats">
        <div className="stat-box" style={{ "--accent": "#3A5CF0" }}><div className="label">Total contraventions</div><div className="value">{stats.total_contraventions}</div></div>
        <div className="stat-box" style={{ "--accent": "#12B886" }}><div className="label">Montant collecté</div><div className="value">{stats.montant_collecte.toLocaleString("fr-FR")}</div></div>
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
