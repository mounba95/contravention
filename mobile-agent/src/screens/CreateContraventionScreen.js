import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Image, ActivityIndicator, Alert, Linking
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api";
import { mettreEnFileAttente } from "../offlineQueue";
import { colors, typography } from "../theme";

const TYPES_CACHE_KEY = "types_infraction_cache";

// Plaque : normalisation cohérente avec le backend (middleware/validators.js).
function normaliserPlaque(p) {
  return (p || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
function plaqueValide(p) {
  const n = normaliserPlaque(p);
  return n.length >= 4 && n.length <= 12;
}

export default function CreateContraventionScreen({ enLigne, onCreated }) {
  const [types, setTypes] = useState([]);
  const [plaque, setPlaque] = useState("");
  const [vehiculeVerifie, setVehiculeVerifie] = useState(null);
  const [messageVerif, setMessageVerif] = useState(null); // { texte, ok }
  const [chargementVerif, setChargementVerif] = useState(false);
  const [impayes, setImpayes] = useState([]);
  const [typesSelectionnes, setTypesSelectionnes] = useState([]);
  const [lieu, setLieu] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [position, setPosition] = useState(null);
  const [chargementPosition, setChargementPosition] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [messageCreation, setMessageCreation] = useState(null);
  const [ticket, setTicket] = useState(null);

  const chargerTypes = useCallback(async () => {
    try {
      const data = await api("/api/contraventions/types-infraction?actifs=true", "GET");
      setTypes(data);
      await AsyncStorage.setItem(TYPES_CACHE_KEY, JSON.stringify(data));
    } catch {
      const cache = await AsyncStorage.getItem(TYPES_CACHE_KEY);
      if (cache) setTypes(JSON.parse(cache));
    }
  }, []);

  useEffect(() => { chargerTypes(); }, [chargerTypes]);

  function basculerType(id) {
    setTypesSelectionnes(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  }

  const montantTotalSelectionne = types
    .filter(t => typesSelectionnes.includes(t.id))
    .reduce((sum, t) => sum + t.montant, 0);

  async function verifierPlaque() {
    setMessageVerif(null);
    setVehiculeVerifie(null);
    setImpayes([]);
    if (!plaqueValide(plaque)) {
      setMessageVerif({ texte: "Format de plaque invalide.", ok: false });
      return;
    }
    setChargementVerif(true);
    try {
      const data = await api(`/api/vehicules/verify/${encodeURIComponent(plaque.trim())}`, "GET");
      setVehiculeVerifie(data);
      const veh = [data.marque, data.modele, data.couleur].filter(Boolean).join(" ");
      const prop = data.proprietaire ? ` — ${data.proprietaire.prenom} ${data.proprietaire.nom}` : "";
      setMessageVerif({ texte: `✓ Véhicule identifié — ${veh}${prop}`, ok: true });

      // Historique des impayés de ce propriétaire — utile avant de dresser
      // une nouvelle contravention (récidive, contestations en cours…).
      if (data.niu) {
        try {
          const historique = await api(`/api/contraventions/usager/${encodeURIComponent(data.niu)}`, "GET");
          setImpayes(historique.filter(c => c.statut === "NON_PAYEE" || c.statut === "EN_RETARD"));
        } catch {
          // Pas bloquant : simple indication de confort pour l'agent.
        }
      }
    } catch (e) {
      if (!enLigne || e instanceof TypeError) {
        setVehiculeVerifie({ plaque: normaliserPlaque(plaque), proprietaire: null, horsLigne: true });
        setMessageVerif({ texte: "⚠ Hors ligne — vous pouvez continuer, le véhicule sera identifié à la reconnexion.", ok: false });
      } else {
        setMessageVerif({ texte: e.message, ok: false });
      }
    } finally {
      setChargementVerif(false);
    }
  }

  async function capturerPosition() {
    setChargementPosition(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission refusée", "L'accès à la localisation est nécessaire pour joindre la position GPS.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setPosition({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch (e) {
      Alert.alert("Erreur", "Impossible de récupérer la position GPS. Vérifiez que la localisation est activée.");
    } finally {
      setChargementPosition(false);
    }
  }

  async function prendrePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission refusée", "L'accès à la caméra est nécessaire pour joindre une preuve photo.");
      return;
    }
    const resultat = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.5,
      allowsEditing: false
    });
    if (!resultat.canceled && resultat.assets && resultat.assets[0]) {
      const asset = resultat.assets[0];
      setPhotoUri(asset.uri);
      const mime = asset.mimeType || "image/jpeg";
      setPhotoBase64(`data:${mime};base64,${asset.base64}`);
    }
  }

  function reinitialiserFormulaire() {
    setPlaque("");
    setVehiculeVerifie(null);
    setMessageVerif(null);
    setImpayes([]);
    setTypesSelectionnes([]);
    setLieu("");
    setNotes("");
    setPhotoUri(null);
    setPhotoBase64(null);
    setPosition(null);
  }

  async function creerContravention() {
    setMessageCreation(null);
    if (!vehiculeVerifie) {
      setMessageCreation({ texte: "Veuillez d'abord vérifier la plaque.", ok: false });
      return;
    }
    if (typesSelectionnes.length === 0) {
      setMessageCreation({ texte: "Veuillez sélectionner au moins un type d'infraction.", ok: false });
      return;
    }
    if (!lieu.trim()) {
      setMessageCreation({ texte: "Le lieu est requis.", ok: false });
      return;
    }

    const payload = {
      plaque: vehiculeVerifie.plaque || normaliserPlaque(plaque),
      type_infraction_ids: typesSelectionnes,
      lieu: lieu.trim(),
      notes: notes.trim(),
      latitude: position ? position.latitude : null,
      longitude: position ? position.longitude : null,
      photo_preuve: photoBase64
    };

    setEnvoiEnCours(true);
    try {
      const c = await api("/api/contraventions", "POST", payload);
      setTicket(c);
      setMessageCreation({ texte: "Contravention émise — un SMS de paiement a été envoyé au propriétaire.", ok: true });
      reinitialiserFormulaire();
      onCreated && onCreated();
    } catch (e) {
      if (!enLigne || e instanceof TypeError) {
        await mettreEnFileAttente(payload);
        setTicket(null);
        setMessageCreation({ texte: "📥 Hors ligne — contravention enregistrée localement, elle sera transmise à la reconnexion.", ok: true });
        reinitialiserFormulaire();
      } else {
        setMessageCreation({ texte: e.message, ok: false });
      }
    } finally {
      setEnvoiEnCours(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.sectionTitle}>1 — Identification du véhicule</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Plaque d'immatriculation</Text>
        <TextInput style={styles.input} value={plaque} onChangeText={setPlaque} placeholder="Ex : 1A 2345 RN" autoCapitalize="characters" />
        <TouchableOpacity style={styles.buttonSecondary} onPress={verifierPlaque} disabled={chargementVerif}>
          {chargementVerif ? <ActivityIndicator /> : <Text style={styles.buttonSecondaryText}>Vérifier au registre des véhicules</Text>}
        </TouchableOpacity>
        {messageVerif && (
          <Text style={[styles.message, { color: messageVerif.ok ? colors.ledgerGreen : colors.stampRed }]}>{messageVerif.texte}</Text>
        )}

        {impayes.length > 0 && (
          <View style={styles.alerteImpayes}>
            <Text style={styles.alerteImpayesTitre}>
              ⚠ {impayes.length} contravention{impayes.length > 1 ? "s" : ""} impayée{impayes.length > 1 ? "s" : ""} — total {impayes.reduce((s, c) => s + c.montant_du, 0).toLocaleString("fr-FR")} FCFA
            </Text>
            {impayes.map(c => (
              <Text key={c.id} style={styles.alerteImpayesLigne}>
                {c.numero_unique} — {c.type_infraction_libelle} — {c.montant_du.toLocaleString("fr-FR")} FCFA{c.statut === "EN_RETARD" ? " (en retard)" : ""}
              </Text>
            ))}
          </View>
        )}
      </View>

      {vehiculeVerifie && (
        <>
          <Text style={styles.sectionTitle}>2 — Détails de l'infraction</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Types d'infraction (sélection multiple possible)</Text>
            {types.map(t => (
              <TouchableOpacity
                key={t.id}
                style={[styles.typeOption, typesSelectionnes.includes(t.id) && styles.typeOptionSelected]}
                onPress={() => basculerType(t.id)}
              >
                <Text style={[styles.typeOptionText, typesSelectionnes.includes(t.id) && styles.typeOptionTextSelected]}>
                  {typesSelectionnes.includes(t.id) ? "☑ " : "☐ "}{t.libelle}
                </Text>
                <Text style={[styles.typeOptionMontant, typesSelectionnes.includes(t.id) && styles.typeOptionTextSelected]}>
                  {t.montant.toLocaleString("fr-FR")} FCFA
                </Text>
              </TouchableOpacity>
            ))}
            {typesSelectionnes.length > 0 && (
              <Text style={styles.totalSelection}>
                Total : {montantTotalSelectionne.toLocaleString("fr-FR")} FCFA ({typesSelectionnes.length} infraction{typesSelectionnes.length > 1 ? "s" : ""})
              </Text>
            )}

            <Text style={styles.label}>Lieu</Text>
            <TextInput style={styles.input} value={lieu} onChangeText={setLieu} placeholder="Ex : Avenue de la Liberté, Niamey" />

            <TouchableOpacity style={styles.buttonSecondary} onPress={capturerPosition} disabled={chargementPosition}>
              {chargementPosition
                ? <ActivityIndicator />
                : <Text style={styles.buttonSecondaryText}>
                    {position ? `✓ Position enregistrée (${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)})` : "📍 Joindre ma position GPS"}
                  </Text>}
            </TouchableOpacity>

            <Text style={styles.label}>Notes complémentaires (optionnel)</Text>
            <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes} placeholder="" multiline />

            <Text style={styles.label}>Photo de preuve (optionnel)</Text>
            <TouchableOpacity style={styles.buttonSecondary} onPress={prendrePhoto}>
              <Text style={styles.buttonSecondaryText}>{photoUri ? "Reprendre la photo" : "Prendre une photo"}</Text>
            </TouchableOpacity>
            {photoUri && <Image source={{ uri: photoUri }} style={styles.photoPreview} />}

            <TouchableOpacity style={styles.buttonPrimary} onPress={creerContravention} disabled={envoiEnCours}>
              {envoiEnCours ? <ActivityIndicator color={colors.paperRaised} /> : <Text style={styles.buttonPrimaryText}>ÉMETTRE LA CONTRAVENTION</Text>}
            </TouchableOpacity>
            {messageCreation && (
              <Text style={[styles.message, { color: messageCreation.ok ? colors.ledgerGreen : colors.stampRed }]}>{messageCreation.texte}</Text>
            )}
          </View>
        </>
      )}

      {ticket && (
        <View style={styles.ticket}>
          <Text style={styles.ticketNum}>{ticket.numero_unique}</Text>
          {ticket.plaque && <TicketRow k="Plaque" v={ticket.plaque} />}
          <TicketRow k="Propriétaire" v={`${ticket.citoyen_prenom} ${ticket.citoyen_nom}`} />
          {(ticket.infractions || []).map((inf, idx) => (
            <TicketRow key={idx} k="Infraction" v={`${inf.libelle} — ${inf.montant.toLocaleString("fr-FR")} FCFA`} />
          ))}
          <TicketRow k="Lieu" v={ticket.lieu} />
          <Text style={styles.ticketMontant}>Total : {ticket.montant.toLocaleString("fr-FR")} FCFA</Text>
          {ticket.lien_paiement_demo && (
            <TouchableOpacity onPress={() => Linking.openURL(ticket.lien_paiement_demo)} style={{ marginTop: 12 }}>
              <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "uppercase", color: colors.inkSoft, marginBottom: 4 }}>
                Lien de paiement (démo — normalement envoyé par SMS)
              </Text>
              <Text style={{ color: colors.primary, fontSize: 12.5, textDecorationLine: "underline" }}>
                {ticket.lien_paiement_demo}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function TicketRow({ k, v }) {
  return (
    <View style={styles.ticketRow}>
      <Text style={styles.ticketRowLabel}>{k}</Text>
      <Text style={styles.ticketRowValue}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  sectionTitle: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", color: colors.inkSoft, marginTop: 18, marginBottom: 8, letterSpacing: 0.4 },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18,
    shadowColor: "#131B33", shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  label: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", color: colors.inkSoft, marginTop: 12, marginBottom: 5 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 11, fontSize: 15, backgroundColor: colors.surface2, color: colors.ink },
  buttonSecondary: { backgroundColor: colors.primarySoft, borderRadius: 999, padding: 11, alignItems: "center", marginTop: 10 },
  buttonSecondaryText: { color: colors.primaryDark, fontSize: 12.5, fontWeight: "700" },
  buttonPrimary: { backgroundColor: colors.primary, borderRadius: 999, padding: 15, alignItems: "center", marginTop: 18,
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  buttonPrimaryText: { color: "#fff", fontSize: 13.5, fontWeight: "700", letterSpacing: 0.3 },
  message: { marginTop: 12, fontSize: 13, fontWeight: "500" },
  alerteImpayes: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#F0453A16" },
  alerteImpayesTitre: { fontSize: 12.5, fontWeight: "700", color: colors.stampRed },
  alerteImpayesLigne: { fontSize: 11.5, color: colors.inkSoft, marginTop: 4 },
  typeOption: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 14, padding: 12, marginBottom: 8
  },
  typeOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeOptionText: { color: colors.ink, fontSize: 14, fontWeight: "500" },
  typeOptionMontant: { color: colors.inkSoft, fontSize: 12, fontWeight: "600" },
  typeOptionTextSelected: { color: "#fff" },
  totalSelection: { fontSize: 14, fontWeight: "700", color: colors.primaryDark, marginTop: 8, marginBottom: 4 },
  photoPreview: { width: 140, height: 140, borderRadius: 14, marginTop: 10, borderWidth: 1, borderColor: colors.border },
  ticket: {
    backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    padding: 18, marginTop: 20, overflow: "hidden",
    shadowColor: "#131B33", shadowOpacity: 0.10, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4
  },
  ticketNum: { fontFamily: "monospace", fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 10 },
  ticketRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  ticketRowLabel: { color: colors.inkSoft, fontSize: 13, fontWeight: "500" },
  ticketRowValue: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  ticketMontant: { fontSize: 26, fontWeight: "800", color: colors.primaryDark, marginTop: 10 }
});
