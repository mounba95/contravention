import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { api } from "../api";
import { saveSession } from "../session";
import { colors, typography } from "../theme";

const NIU_REGEX = /^NIU-\d{9}$/;

export default function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("connexion"); // connexion | inscription | mot-de-passe-oublie | reinitialisation
  const [niu, setNiu] = useState("");
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [chargement, setChargement] = useState(false);

  const titres = {
    connexion: "Connexion Usager",
    inscription: "Créer mon compte",
    "mot-de-passe-oublie": "Mot de passe oublié",
    reinitialisation: "Nouveau mot de passe"
  };

  async function soumettre() {
    setErreur(""); setSucces("");
    if (!NIU_REGEX.test(niu.trim())) {
      setErreur("Format de NIU invalide (attendu : NIU-XXXXXXXXX).");
      return;
    }
    setChargement(true);
    try {
      if (mode === "inscription") {
        if (!telephone.trim()) { setErreur("Le numéro de téléphone est requis."); setChargement(false); return; }
        if (!password || password.length < 6) { setErreur("Le mot de passe doit contenir au moins 6 caractères."); setChargement(false); return; }
        await api("/api/usager/inscription", "POST", { niu: niu.trim(), telephone: telephone.trim(), password }, false);
        setSucces("Inscription réussie ! Vous pouvez maintenant vous connecter.");
        setMode("connexion");
        setPassword("");
      } else if (mode === "mot-de-passe-oublie") {
        const res = await api("/api/usager/mot-de-passe-oublie", "POST", { niu: niu.trim() }, false);
        setSucces(res.code_demo ? `${res.message} (démo : code = ${res.code_demo})` : res.message);
        setMode("reinitialisation");
      } else if (mode === "reinitialisation") {
        if (!nouveauMotDePasse || nouveauMotDePasse.length < 6) { setErreur("Le mot de passe doit contenir au moins 6 caractères."); setChargement(false); return; }
        await api("/api/usager/reinitialiser-mot-de-passe", "POST", { niu: niu.trim(), code: code.trim(), nouveauMotDePasse }, false);
        setSucces("Mot de passe réinitialisé ! Vous pouvez maintenant vous connecter.");
        setMode("connexion");
        setPassword(""); setCode(""); setNouveauMotDePasse("");
      } else {
        if (!password || password.length < 6) { setErreur("Le mot de passe doit contenir au moins 6 caractères."); setChargement(false); return; }
        const data = await api("/api/usager/connexion", "POST", { niu: niu.trim(), password }, false);
        await saveSession(data);
        onLogin(data);
      }
    } catch (e) {
      setErreur(e.message || "Impossible de se connecter. Vérifiez l'adresse du serveur (src/config.js).");
    } finally {
      setChargement(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <View style={styles.card}>
          <Text style={styles.tag}>RNP · NIU</Text>
          <Text style={styles.title}>{titres[mode]}</Text>

          <Text style={styles.label}>Numéro d'Identifiant Unique (NIU)</Text>
          <TextInput style={styles.input} value={niu} onChangeText={setNiu} placeholder="NIU-100234567" autoCapitalize="characters" />

          {mode === "inscription" && (
            <>
              <Text style={styles.label}>Téléphone (celui enregistré au RNP)</Text>
              <TextInput style={styles.input} value={telephone} onChangeText={setTelephone} placeholder="+227 90 00 11 22" keyboardType="phone-pad" />
            </>
          )}

          {(mode === "connexion" || mode === "inscription") && (
            <>
              <Text style={styles.label}>Mot de passe</Text>
              <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="6 caractères minimum" secureTextEntry />
            </>
          )}

          {mode === "reinitialisation" && (
            <>
              <Text style={styles.label}>Code reçu par SMS</Text>
              <TextInput style={styles.input} value={code} onChangeText={setCode} placeholder="123456" keyboardType="number-pad" />
              <Text style={styles.label}>Nouveau mot de passe</Text>
              <TextInput style={styles.input} value={nouveauMotDePasse} onChangeText={setNouveauMotDePasse} placeholder="6 caractères minimum" secureTextEntry />
            </>
          )}

          <TouchableOpacity style={styles.button} onPress={soumettre} disabled={chargement}>
            {chargement ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.buttonText}>
                {mode === "connexion" ? "SE CONNECTER"
                  : mode === "inscription" ? "CRÉER MON COMPTE"
                  : mode === "mot-de-passe-oublie" ? "RECEVOIR UN CODE"
                  : "RÉINITIALISER"}
              </Text>
            )}
          </TouchableOpacity>

          {!!erreur && <Text style={styles.erreur}>{erreur}</Text>}
          {!!succes && <Text style={styles.succes}>{succes}</Text>}

          {mode === "connexion" && (
            <>
              <TouchableOpacity onPress={() => { setMode("inscription"); setErreur(""); setSucces(""); }}>
                <Text style={styles.lien}>Pas encore de compte ? Créer un compte</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setMode("mot-de-passe-oublie"); setErreur(""); setSucces(""); }}>
                <Text style={styles.lien}>Mot de passe oublié ?</Text>
              </TouchableOpacity>
            </>
          )}
          {mode !== "connexion" && (
            <TouchableOpacity onPress={() => { setMode("connexion"); setErreur(""); setSucces(""); }}>
              <Text style={styles.lien}>← Retour à la connexion</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 30, borderWidth: 1, borderColor: colors.border,
    shadowColor: "#131B33", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  tag: { fontWeight: "700", fontSize: 11, letterSpacing: 1.5, color: colors.primary, textAlign: "center" },
  title: { ...typography.head, fontSize: 22, textAlign: "center", marginTop: 8, marginBottom: 20, color: colors.ink },
  label: { fontSize: 11.5, fontWeight: "700", textTransform: "uppercase", color: colors.inkSoft, marginBottom: 5, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 15, backgroundColor: colors.surface2, color: colors.ink },
  button: { backgroundColor: colors.primary, borderRadius: 999, padding: 15, alignItems: "center", marginTop: 22,
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 13.5, letterSpacing: 0.3 },
  erreur: { color: colors.danger, marginTop: 14, fontSize: 13, textAlign: "center", fontWeight: "500" },
  succes: { color: colors.success, marginTop: 14, fontSize: 13, textAlign: "center", fontWeight: "500" },
  lien: { color: colors.primary, textAlign: "center", marginTop: 20, fontSize: 13, fontWeight: "600" }
});
