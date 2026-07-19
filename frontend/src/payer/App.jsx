import { useState, useEffect, useCallback } from "react";
import { api } from "../shared/api";
import TopBar from "../shared/components/TopBar";
import StatusPill from "../shared/components/StatusPill";
import Message from "../shared/components/Message";

// Page de paiement/contestation ouverte depuis le lien reçu par SMS. Aucune
// connexion : le jeton présent dans l'URL (?t=…) autorise l'accès à cette
// seule contravention.

const FOURNISSEURS = [
  { valeur: "MYNITA", libelle: "MyNita" },
  { valeur: "AMANATA", libelle: "AmanaTa" },
  { valeur: "WALLET", libelle: "Wallet national" },
  { valeur: "BANQUE", libelle: "Virement bancaire" }
];

function getToken() {
  return new URLSearchParams(window.location.search).get("t");
}

export default function App() {
  const token = getToken();
  const [contravention, setContravention] = useState(null);
  const [etat, setEtat] = useState("chargement"); // chargement | prete | erreur
  const [erreur, setErreur] = useState("");

  const [onglet, setOnglet] = useState("payer"); // payer | contester
  const [methode, setMethode] = useState("MYNITA");
  const [telephone, setTelephone] = useState("");
  const [message, setMessage] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [recu, setRecu] = useState(null);

  const [motif, setMotif] = useState("");
  const [contestationDeposee, setContestationDeposee] = useState(false);

  const charger = useCallback(async () => {
    if (!token) {
      setEtat("erreur");
      setErreur("Lien de paiement incomplet. Utilisez le lien reçu par SMS.");
      return;
    }
    try {
      const data = await api(`/api/p/${encodeURIComponent(token)}`, "GET", null, false);
      setContravention(data);
      setEtat("prete");
    } catch (e) {
      setEtat("erreur");
      setErreur(e.message || "Lien de paiement invalide ou expiré.");
    }
  }, [token]);

  useEffect(() => { charger(); }, [charger]);

  const necessiteTelephone = methode === "MYNITA" || methode === "AMANATA";
  const peutPayer = contravention && (contravention.statut === "NON_PAYEE" || contravention.statut === "EN_RETARD");

  async function payer() {
    setMessage(null);
    if (necessiteTelephone && !telephone.trim()) {
      setMessage({ texte: "Le numéro de téléphone est requis pour ce mode de paiement.", ok: false });
      return;
    }
    setChargement(true);
    try {
      const res = await api(`/api/p/${encodeURIComponent(token)}`, "POST", { methode, numero_telephone: telephone }, false);
      setRecu(res.recu);
    } catch (e) {
      setMessage({ texte: e.message, ok: false });
    } finally {
      setChargement(false);
    }
  }

  async function contester() {
    setMessage(null);
    if (motif.trim().length < 5) {
      setMessage({ texte: "Merci de préciser un motif plus détaillé (5 caractères minimum).", ok: false });
      return;
    }
    setChargement(true);
    try {
      await api(`/api/p/${encodeURIComponent(token)}/contester`, "POST", { motif: motif.trim() }, false);
      setContestationDeposee(true);
      setContravention(c => ({ ...c, statut: "CONTESTEE" }));
    } catch (e) {
      setMessage({ texte: e.message, ok: false });
    } finally {
      setChargement(false);
    }
  }

  return (
    <>
      <TopBar tag="Police nationale" title="Contravention" />

      <div className="wrap" style={{ maxWidth: 560 }}>
        {etat === "chargement" && <div className="empty-state">Chargement…</div>}

        {etat === "erreur" && (
          <div className="card">
            <h2>Lien indisponible</h2>
            <Message texte={erreur} ok={false} />
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
              Le lien a peut-être expiré ou la contravention a déjà été réglée.
              En cas de doute, rapprochez-vous du service compétent.
            </p>
          </div>
        )}

        {recu && (
          <div className="card">
            <h2>✓ Paiement confirmé</h2>
            <div className="ticket">
              <div className="num">{recu.numero_contravention}</div>
              <div className="row"><span className="k">Infraction</span><span>{recu.type_infraction}</span></div>
              <div className="row"><span className="k">Reçu</span><span>{recu.reference}</span></div>
              <div className="row"><span className="k">Date</span><span>{new Date(recu.date).toLocaleString("fr-FR")}</span></div>
              <div className="montant">Payé : {recu.montant.toLocaleString("fr-FR")} FCFA</div>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginTop: 14 }}>
              Conservez cette référence comme preuve de paiement. Vous pouvez fermer cette page.
            </p>
          </div>
        )}

        {etat === "prete" && !recu && contravention && (
          <div className="card">
            <div className="ticket">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div className="num">{contravention.numero_unique}</div>
                  {(contravention.infractions || []).map((inf, idx) => (
                    <div className="row" key={idx}>
                      <span className="k">Infraction</span>
                      <span>{inf.libelle} — {inf.montant.toLocaleString("fr-FR")} FCFA</span>
                    </div>
                  ))}
                  <div className="row"><span className="k">Lieu</span><span>{contravention.lieu}</span></div>
                  <div className="row"><span className="k">Date</span><span>{new Date(contravention.date_heure).toLocaleString("fr-FR")}</span></div>
                  <div className="row"><span className="k">Échéance</span><span>{new Date(contravention.date_echeance).toLocaleDateString("fr-FR")}</span></div>
                  <div className="montant">Total : {contravention.montant.toLocaleString("fr-FR")} FCFA</div>
                </div>
                <StatusPill statut={contravention.statut} />
              </div>
            </div>

            {peutPayer ? (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <button
                    type="button"
                    onClick={() => setOnglet("payer")}
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: "pointer",
                      border: `1.5px solid ${onglet === "payer" ? "var(--primary)" : "var(--border)"}`,
                      background: onglet === "payer" ? "var(--primary)" : "var(--surface-2)",
                      color: onglet === "payer" ? "#fff" : "var(--ink)"
                    }}
                  >
                    Payer
                  </button>
                  <button
                    type="button"
                    onClick={() => setOnglet("contester")}
                    style={{
                      flex: 1, padding: "10px 14px", borderRadius: 12, fontWeight: 700, fontSize: 13.5, cursor: "pointer",
                      border: `1.5px solid ${onglet === "contester" ? "var(--primary)" : "var(--border)"}`,
                      background: onglet === "contester" ? "var(--primary)" : "var(--surface-2)",
                      color: onglet === "contester" ? "#fff" : "var(--ink)"
                    }}
                  >
                    Contester
                  </button>
                </div>

                {onglet === "payer" && (
                  <>
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
                      {chargement ? "Traitement…" : `Payer ${contravention.montant.toLocaleString("fr-FR")} FCFA`}
                    </button>
                    <Message texte={message?.texte} ok={message?.ok} />
                  </>
                )}

                {onglet === "contester" && (
                  contestationDeposee ? (
                    <Message texte="Contestation déposée. Vous serez informé de la décision." ok={true} />
                  ) : (
                    <>
                      <label>Motif de la contestation</label>
                      <textarea
                        value={motif}
                        onChange={e => setMotif(e.target.value)}
                        placeholder="Expliquez pourquoi vous contestez cette contravention…"
                        rows={4}
                        style={{ width: "100%", borderRadius: 12, border: "1.5px solid var(--border)", padding: 10, fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
                      />
                      <button className="primary" onClick={contester} disabled={chargement}>
                        {chargement ? "Envoi…" : "Déposer la contestation"}
                      </button>
                      <Message texte={message?.texte} ok={message?.ok} />
                    </>
                  )
                )}
              </div>
            ) : (
              <p style={{ marginTop: 16, fontSize: 14, color: "var(--ink-soft)" }}>
                Cette contravention n'est pas payable ni contestable en ligne (déjà réglée, contestée ou annulée).
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
