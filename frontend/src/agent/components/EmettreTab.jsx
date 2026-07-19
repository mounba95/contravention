import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../shared/api";
import Card from "../../shared/components/Card";
import Message from "../../shared/components/Message";
import { mettreEnFileAttente, synchroniser, taille } from "../offlineQueue";

const TYPES_CACHE_KEY = "types_infraction_cache";

// Plaque plausible : 4 à 12 caractères alphanumériques une fois normalisée
// (majuscules, sans espaces). Doit rester cohérent avec middleware/validators.js.
function normaliserPlaque(p) {
  return (p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function plaqueValide(p) {
  const n = normaliserPlaque(p);
  return n.length >= 4 && n.length <= 12;
}

export default function EmettreTab({ onCreated }) {
  const [types, setTypes] = useState([]);
  const [plaque, setPlaque] = useState("");
  const [vehiculeVerifie, setVehiculeVerifie] = useState(null);
  const [messageVerif, setMessageVerif] = useState(null);
  const [chargementVerif, setChargementVerif] = useState(false);

  const [typesSelectionnes, setTypesSelectionnes] = useState([]);
  const [lieu, setLieu] = useState("");
  const [notes, setNotes] = useState("");
  const [photoBase64, setPhotoBase64] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [messageCreation, setMessageCreation] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [enAttente, setEnAttente] = useState(taille());
  const fileInputRef = useRef(null);

  const chargerTypes = useCallback(async () => {
    try {
      const data = await api("/api/contraventions/types-infraction?actifs=true", "GET");
      setTypes(data);
      localStorage.setItem(TYPES_CACHE_KEY, JSON.stringify(data));
    } catch {
      const cache = localStorage.getItem(TYPES_CACHE_KEY);
      if (cache) setTypes(JSON.parse(cache));
    }
  }, []);

  function basculerType(id) {
    setTypesSelectionnes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  const montantTotalSelectionne = types
    .filter(t => typesSelectionnes.includes(t.id))
    .reduce((sum, t) => sum + t.montant, 0);

  const tenterSynchronisation = useCallback(async () => {
    const { succes } = await synchroniser(api);
    if (succes > 0) onCreated();
    setEnAttente(taille());
  }, [onCreated]);

  useEffect(() => {
    chargerTypes();
    tenterSynchronisation();
    const onOnline = () => tenterSynchronisation();
    window.addEventListener("online", onOnline);
    const interval = setInterval(tenterSynchronisation, 30000);
    return () => { window.removeEventListener("online", onOnline); clearInterval(interval); };
  }, [chargerTypes, tenterSynchronisation]);

  async function verifierPlaque() {
    setMessageVerif(null);
    setVehiculeVerifie(null);
    if (!plaqueValide(plaque)) {
      setMessageVerif({ texte: "Format de plaque invalide.", ok: false });
      return;
    }
    setChargementVerif(true);
    try {
      const data = await api(`/api/vehicules/verify/${encodeURIComponent(plaque.trim())}`, "GET");
      setVehiculeVerifie(data);
      const veh = [data.marque, data.modele, data.couleur].filter(Boolean).join(" ");
      const prop = data.proprietaire ? ` — Propriétaire : ${data.proprietaire.prenom} ${data.proprietaire.nom}` : "";
      setMessageVerif({ texte: `✓ Véhicule identifié — ${veh}${prop}`, ok: true });
    } catch (e) {
      if (!navigator.onLine || e instanceof TypeError) {
        // Hors ligne : on autorise la saisie, la plaque sera résolue à la synchronisation.
        setVehiculeVerifie({ plaque: normaliserPlaque(plaque), proprietaire: null, horsLigne: true });
        setMessageVerif({ texte: "⚠ Hors ligne — vous pouvez continuer, le véhicule sera identifié à la reconnexion.", ok: false });
      } else {
        setMessageVerif({ texte: e.message, ok: false });
      }
    } finally {
      setChargementVerif(false);
    }
  }

  function surChangementPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoBase64(reader.result);
      setPhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function reinitialiser() {
    setPlaque("");
    setVehiculeVerifie(null);
    setMessageVerif(null);
    setTypesSelectionnes([]);
    setLieu("");
    setNotes("");
    setPhotoBase64(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function afficherQrCode(numeroUnique) {
    try {
      const qr = await api(`/api/contraventions/numero/${numeroUnique}/qrcode`, "GET", null, false);
      setQrCode(qr.dataUrl);
    } catch {
      setQrCode(null);
    }
  }

  async function creerContravention(e) {
    e.preventDefault();
    setMessageCreation(null);
    if (!vehiculeVerifie) { setMessageCreation({ texte: "Veuillez d'abord vérifier la plaque.", ok: false }); return; }
    if (typesSelectionnes.length === 0) { setMessageCreation({ texte: "Veuillez sélectionner au moins un type d'infraction.", ok: false }); return; }
    if (!lieu.trim()) { setMessageCreation({ texte: "Le lieu est requis.", ok: false }); return; }

    const payload = {
      plaque: vehiculeVerifie.plaque || normaliserPlaque(plaque),
      type_infraction_ids: typesSelectionnes,
      lieu: lieu.trim(),
      notes: notes.trim(),
      photo_preuve: photoBase64
    };

    setEnvoiEnCours(true);
    try {
      const c = await api("/api/contraventions", "POST", payload);
      setTicket(c);
      afficherQrCode(c.numero_unique);
      setMessageCreation({ texte: "Contravention émise — un SMS de paiement a été envoyé au propriétaire.", ok: true });
      reinitialiser();
      onCreated();
    } catch (err) {
      if (!navigator.onLine || err instanceof TypeError) {
        mettreEnFileAttente(payload);
        setTicket(null);
        setQrCode(null);
        setMessageCreation({ texte: "📥 Hors ligne — contravention enregistrée localement, elle sera transmise à la reconnexion.", ok: true });
        reinitialiser();
        setEnAttente(taille());
      } else {
        setMessageCreation({ texte: err.message, ok: false });
      }
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <>
      {enAttente > 0 && (
        <div className="msg ok" style={{ marginBottom: 18 }}>
          {navigator.onLine ? `Synchronisation de ${enAttente} contravention(s) en attente…` : `⚠ Hors ligne — ${enAttente} contravention(s) en attente de synchronisation`}
        </div>
      )}

      <Card title="🚗 Identification du véhicule">
        <label>Plaque d'immatriculation</label>
        <input value={plaque} onChange={e => setPlaque(e.target.value)} placeholder="Ex : 1A 2345 RN" style={{ textTransform: "uppercase" }} />
        <button className="secondary" style={{ marginTop: 10 }} onClick={verifierPlaque} disabled={chargementVerif}>
          {chargementVerif ? "Vérification…" : "Vérifier au registre des véhicules"}
        </button>
        <Message texte={messageVerif?.texte} ok={messageVerif?.ok} />
      </Card>

      {vehiculeVerifie && (
        <Card title="📝 Détails de l'infraction">
          <form onSubmit={creerContravention}>
            <label>Types d'infraction (sélection multiple possible)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {types.map(t => (
                <label key={t.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  border: `1.5px solid ${typesSelectionnes.includes(t.id) ? "var(--primary)" : "var(--border)"}`,
                  background: typesSelectionnes.includes(t.id) ? "var(--primary-soft)" : "transparent",
                  borderRadius: 12, padding: "10px 14px", cursor: "pointer", fontWeight: 500
                }}>
                  <span>
                    <input type="checkbox" checked={typesSelectionnes.includes(t.id)} onChange={() => basculerType(t.id)} style={{ width: "auto", marginRight: 10 }} />
                    {t.libelle}
                  </span>
                  <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>{t.montant.toLocaleString("fr-FR")} FCFA</span>
                </label>
              ))}
            </div>
            {typesSelectionnes.length > 0 && (
              <div style={{ marginTop: 10, fontWeight: 700, color: "var(--primary-ink)" }}>
                Total : {montantTotalSelectionne.toLocaleString("fr-FR")} FCFA ({typesSelectionnes.length} infraction{typesSelectionnes.length > 1 ? "s" : ""})
              </div>
            )}

            <label>Lieu</label>
            <input value={lieu} onChange={e => setLieu(e.target.value)} placeholder="Ex : Avenue de la Liberté, Niamey" />

            <label>Notes complémentaires (optionnel)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} />

            <label>Photo de preuve (optionnel)</label>
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={surChangementPhoto} />
            {photoPreview && <img src={photoPreview} alt="Preuve" style={{ maxWidth: 180, marginTop: 10, borderRadius: 8, border: "1px solid var(--border)" }} />}

            <button className="primary" disabled={envoiEnCours}>
              {envoiEnCours ? "Envoi…" : "Émettre la contravention"}
            </button>
          </form>
          <Message texte={messageCreation?.texte} ok={messageCreation?.ok} />
        </Card>
      )}

      {ticket && (
        <div className="ticket" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div className="num">{ticket.numero_unique}</div>
              {ticket.plaque && <div className="row"><span className="k">Plaque</span><span>{ticket.plaque}</span></div>}
              <div className="row"><span className="k">Propriétaire</span><span>{ticket.citoyen_prenom} {ticket.citoyen_nom}</span></div>
              {(ticket.infractions || []).map((inf, idx) => (
                <div className="row" key={idx}><span className="k">Infraction</span><span>{inf.libelle} — {inf.montant.toLocaleString("fr-FR")} FCFA</span></div>
              ))}
              <div className="row"><span className="k">Lieu</span><span>{ticket.lieu}</span></div>
              <div className="row"><span className="k">Date / heure</span><span>{new Date(ticket.date_heure).toLocaleString("fr-FR")}</span></div>
              <div className="row"><span className="k">Échéance</span><span>{new Date(ticket.date_echeance).toLocaleDateString("fr-FR")}</span></div>
              <div className="montant">Total : {ticket.montant.toLocaleString("fr-FR")} FCFA</div>
            </div>
            {qrCode && <img src={qrCode} alt="QR code" style={{ width: 110, height: 110 }} />}
          </div>
        </div>
      )}
    </>
  );
}
