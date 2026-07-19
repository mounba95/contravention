import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { api } from "../api";
import { saveSession } from "../session";
import { colors, typography } from "../theme";

export default function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);

  async function seConnecter() {
    setErreur("");
    if (!username.trim() || !password) {
      setErreur("Identifiant et mot de passe requis.");
      return;
    }
    setChargement(true);
    try {
      const data = await api("/api/auth/login", "POST", { username: username.trim(), password }, false);
      if (data.user.role !== "agent") {
        setErreur("Ce compte n'est pas un compte agent.");
        setChargement(false);
        return;
      }
      await saveSession(data);
      onLogin(data);
    } catch (e) {
      setErreur(e.message || "Impossible de se connecter. Vérifiez l'adresse du serveur (src/config.js).");
    } finally {
      setChargement(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.card}>
        <Text style={styles.tag}>POLICE NATIONALE</Text>
        <Text style={styles.title}>Poste Agent</Text>

        <Text style={styles.label}>Identifiant</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="agent007"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Mot de passe</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={seConnecter} disabled={chargement}>
          {chargement ? <ActivityIndicator color={colors.paper} /> : <Text style={styles.buttonText}>SE CONNECTER</Text>}
        </TouchableOpacity>

        {!!erreur && <Text style={styles.erreur}>{erreur}</Text>}

        <Text style={styles.footnote}>Démo : agent007 / agent123</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper, justifyContent: "center", padding: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 30, borderWidth: 1, borderColor: colors.border,
    shadowColor: "#131B33", shadowOpacity: 0.08, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  tag: { fontWeight: "700", fontSize: 11, letterSpacing: 1.5, color: colors.primary, textAlign: "center" },
  title: { ...typography.head, fontSize: 24, textAlign: "center", marginTop: 6, marginBottom: 22, color: colors.ink },
  label: { ...typography.mono, fontSize: 11, textTransform: "uppercase", color: colors.inkSoft, marginBottom: 5, marginTop: 12 },
  input: { borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, padding: 12, fontSize: 15, backgroundColor: colors.surface2, color: colors.ink },
  button: { backgroundColor: colors.primary, borderRadius: 999, padding: 15, alignItems: "center", marginTop: 22,
    shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  buttonText: { color: colors.paperRaised, ...typography.mono, fontSize: 13, letterSpacing: 0.5 },
  erreur: { color: colors.stampRed, marginTop: 14, fontSize: 13, textAlign: "center" },
  footnote: { ...typography.mono, fontSize: 11, color: colors.inkSoft, textAlign: "center", marginTop: 18 }
});
