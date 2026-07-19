import { useState, useEffect } from "react";
import { api } from "../../shared/api";
import StatusPill from "../../shared/components/StatusPill";
import Message from "../../shared/components/Message";

const FOURNISSEURS = [
  { valeur: "MYNITA", libelle: "MyNita" },
  { valeur: "AMANATA", libelle: "AmanaTa" },
  { valeur: "WALLET", libelle: "Wallet national" },
  { valeur: "BANQUE", libelle: "Virement bancaire" }
];

export default function TicketCard({ contravention, onChanged }) {
  const c = contravention;
  const [qrCode, setQrCode] = useState(null);
  const [methode, setMethode] = useState("MYNITA");
  const [telephone, setTelephone] = useState("");
  const [motif, setMotif] = useState("");
  const [contestFormOuvert, setContestFormOuvert] = useState(false);
  const [message, setMessage] = useState(null);
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    api(`/api/contraventions/numero/${c.numero_unique}/qrcode`, "GET", null, false)
      .then(qr => setQrCode(qr.dataUrl))
      .catch(() => {});
  }, [c.numero_unique]);

  const peutPayer = c.statut === "NON_PAYEE" || c.statut === "EN_RETARD";
  const necessiteTelephone = methode === "MYNITA" || methode === "AMANATA";

  async function payer() {
    setMessage(null);
    if (necessiteTelephone && !telephone.trim()) {
      setMessage({ texte: "Le numéro de téléphone est requis pour ce mode de paiement.", ok: false });
      return;
    }
    setChargement(true);
    try {
      const res = await api("/api/paiements", "POST", { numero_contravention: c.numero_unique, methode, numero_telephone: telephone });
      setMessage({ texte: `✓ Paiement confirmé — Reçu ${res.reference}`, ok: true });
      setTimeout(onChanged, 1200);
    } catch (e) {
      setMessage({ texte: e.message, ok: false });
    } finally {
      setChargement(false);
    }
  }

  async function soumettreContestation() {
    setMessage(null);
    if (!motif.trim()) { setMessage({ texte: "Veuillez préciser un motif.", ok: false }); return; }
    setChargement(true);
    try {
      await api("/api/contestations", "POST", { numero_contravention: c.numero_unique, motif: motif.trim() });
      setMessage({ texte: "✓ Contestation transmise au service compétent.", ok: true });
      setTimeout(onChanged, 1200);
    } catch (e) {
      setMessage({ texte: e.message, ok: false });
    } finally {
      setChargement(false);
    }
  }

  return (
    <div className="ticket" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div className="num">{c.numero_unique}</div>
          {(c.infractions || []).map((inf, idx) => (
            <div className="row" key={idx}><span className="k">Infraction</span><span>{inf.libelle} — {inf.montant.toLocaleString("fr-FR")} FCFA</span></div>
          ))}
          <div className="row"><span className="k">Lieu</span><span>{c.lieu}</span></div>
          <div className="row"><span className="k">Date</span><span>{new Date(c.date_heure).toLocaleString("fr-FR")}</span></div>
          <div className="row"><span className="k">Échéance</span><span>{new Date(c.date_echeance).toLocaleDateString("fr-FR")}</span></div>
          <div className="montant">Total : {c.montant.toLocaleString("fr-FR")} FCFA</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <StatusPill statut={c.statut} />
          {qrCode && <img src={qrCode} alt="QR code" style={{ width: 100, height: 100, display: "block", marginTop: 10 }} />}
        </div>
      </div>

      {peutPayer && (
        <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
          <label>Payer avec</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {FOURNISSEURS.map(f => (
              <button
                key={f.valeur}
                type="button"
                onClick={() => setMethode(f.valeur)}
                style={{
                  padding: "10px 14px", borderRadius: 12, fontWeight: 600, fontSize: 13.5, cursor: "pointer",
                  border: `1.5px solid ${methode === f.valeur ? "var(--primary)" : "var(--border)"}`,
                  background: methode === f.valeur ? "var(--primary)" : "var(--surface-2)",
                  color: methode === f.valeur ? "#fff" : "var(--ink)"
                }}
              >
                {f.libelle}
              </button>
            ))}
          </div>

          {necessiteTelephone && (
            <>
              <label>Numéro de téléphone ({FOURNISSEURS.find(f => f.valeur === methode).libelle})</label>
              <input value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+227 9X XXX XXX" />
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "8px 0 0" }}>
                Une demande de paiement sera envoyée sur votre compte {FOURNISSEURS.find(f => f.valeur === methode).libelle} — validez-la avec votre code PIN habituel.
              </p>
            </>
          )}

          <button className="primary" onClick={payer} disabled={chargement}>
            {chargement ? "Traitement…" : "Payer maintenant"}
          </button>
          <Message texte={message?.texte} ok={message?.ok} />

          <div style={{ marginTop: 14 }}>
            <button className="secondary" onClick={() => setContestFormOuvert(o => !o)}>Contester à la place</button>
            {contestFormOuvert && (
              <div style={{ marginTop: 14 }}>
                <label>Motif de la contestation</label>
                <textarea value={motif} onChange={e => setMotif(e.target.value)} placeholder="Expliquez pourquoi vous contestez cette contravention…" />
                <button className="secondary" onClick={soumettreContestation} disabled={chargement}>Soumettre la contestation</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
