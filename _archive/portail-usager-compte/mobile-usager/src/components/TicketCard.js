import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from "react-native";
import { api } from "../api";
import { colors, couleurStatut, libelleStatut } from "../theme";

const FOURNISSEURS = [
  { valeur: "MYNITA", libelle: "MyNita" },
  { valeur: "AMANATA", libelle: "AmanaTa" },
  { valeur: "WALLET", libelle: "Wallet" },
  { valeur: "BANQUE", libelle: "Banque" }
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
  const fournisseurActuel = FOURNISSEURS.find(f => f.valeur === methode);

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
    <View style={styles.ticket}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.numero}>{c.numero_unique}</Text>
          {(c.infractions || []).map((inf, idx) => (
            <View style={styles.row} key={idx}>
              <Text style={styles.rowLabel}>Infraction</Text>
              <Text style={styles.rowValue}>{inf.libelle} — {inf.montant.toLocaleString("fr-FR")} FCFA</Text>
            </View>
          ))}
          <View style={styles.row}><Text style={styles.rowLabel}>Lieu</Text><Text style={styles.rowValue}>{c.lieu}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Date</Text><Text style={styles.rowValue}>{new Date(c.date_heure).toLocaleString("fr-FR")}</Text></View>
          <View style={styles.row}><Text style={styles.rowLabel}>Échéance</Text><Text style={styles.rowValue}>{new Date(c.date_echeance).toLocaleDateString("fr-FR")}</Text></View>
          <Text style={styles.montant}>Total : {c.montant.toLocaleString("fr-FR")} FCFA</Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.statut, { color: couleurStatut(c.statut), backgroundColor: couleurStatut(c.statut) + "18" }]}>{libelleStatut(c.statut)}</Text>
          {qrCode && <Image source={{ uri: qrCode }} style={{ width: 90, height: 90, marginTop: 10 }} />}
        </View>
      </View>

      {peutPayer && (
        <View style={styles.zoneAction}>
          <Text style={styles.label}>Payer avec</Text>
          <View style={styles.grilleFournisseurs}>
            {FOURNISSEURS.map(f => (
              <TouchableOpacity
                key={f.valeur}
                style={[styles.optionFournisseur, methode === f.valeur && styles.optionFournisseurSelectionnee]}
                onPress={() => setMethode(f.valeur)}
              >
                <Text style={[styles.optionFournisseurTexte, methode === f.valeur && styles.optionFournisseurTexteSelectionnee]}>{f.libelle}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {necessiteTelephone && (
            <>
              <Text style={styles.label}>Numéro de téléphone ({fournisseurActuel.libelle})</Text>
              <TextInput style={styles.input} value={telephone} onChangeText={setTelephone} placeholder="+227 9X XXX XXX" keyboardType="phone-pad" />
              <Text style={styles.infoTexte}>
                Une demande de paiement sera envoyée sur votre compte {fournisseurActuel.libelle} — validez-la avec votre code PIN habituel.
              </Text>
            </>
          )}

          <TouchableOpacity style={styles.boutonPrimaire} onPress={payer} disabled={chargement}>
            {chargement ? <ActivityIndicator color="#fff" /> : <Text style={styles.boutonPrimaireTexte}>Payer maintenant</Text>}
          </TouchableOpacity>

          {message && <Text style={{ marginTop: 12, color: message.ok ? colors.success : colors.danger, fontWeight: "500" }}>{message.texte}</Text>}

          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => setContestFormOuvert(o => !o)}>
            <Text style={styles.boutonSecondaireTexte}>Contester à la place</Text>
          </TouchableOpacity>

          {contestFormOuvert && (
            <View style={{ marginTop: 14 }}>
              <Text style={styles.label}>Motif de la contestation</Text>
              <TextInput style={[styles.input, { height: 80 }]} value={motif} onChangeText={setMotif} placeholder="Expliquez pourquoi vous contestez…" multiline />
              <TouchableOpacity style={styles.boutonSecondaire} onPress={soumettreContestation} disabled={chargement}>
                <Text style={styles.boutonSecondaireTexte}>Soumettre la contestation</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 18, marginBottom: 16, overflow: "hidden",
    shadowColor: "#131B33", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3
  },
  numero: { fontFamily: "monospace", fontSize: 17, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5, gap: 10 },
  rowLabel: { color: colors.inkSoft, fontSize: 12.5, fontWeight: "500" },
  rowValue: { color: colors.ink, fontSize: 12.5, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  montant: { fontSize: 22, fontWeight: "800", color: colors.primaryDark, marginTop: 10 },
  statut: { fontSize: 11, fontWeight: "700", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, overflow: "hidden" },
  zoneAction: { marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  label: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", color: colors.inkSoft, marginBottom: 5, marginTop: 10 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 11, fontSize: 14.5, backgroundColor: colors.surface2, color: colors.ink },
  infoTexte: { fontSize: 12, color: colors.inkSoft, marginTop: 8 },
  grilleFournisseurs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionFournisseur: { flexBasis: "48%", borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 10, alignItems: "center" },
  optionFournisseurSelectionnee: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionFournisseurTexte: { fontSize: 12.5, fontWeight: "600", color: colors.ink },
  optionFournisseurTexteSelectionnee: { color: "#fff" },
  boutonPrimaire: { backgroundColor: colors.primary, borderRadius: 999, padding: 13, alignItems: "center", marginTop: 16 },
  boutonPrimaireTexte: { color: "#fff", fontWeight: "700", fontSize: 13 },
  boutonSecondaire: { backgroundColor: colors.primarySoft, borderRadius: 999, padding: 13, alignItems: "center", marginTop: 10 },
  boutonSecondaireTexte: { color: colors.primaryDark, fontWeight: "700", fontSize: 13 }
});
