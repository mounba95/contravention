import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import AuthScreen from "./src/screens/AuthScreen";
import ContraventionsScreen from "./src/screens/ContraventionsScreen";
import { getSession, clearSession } from "./src/session";
import { colors, typography } from "./src/theme";

export default function App() {
  const [session, setSession] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    getSession().then(s => { setSession(s); setPret(true); });
  }, []);

  async function seDeconnecter() {
    await clearSession();
    setSession(null);
  }

  if (!pret) {
    return (
      <View style={styles.chargementEcran}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <AuthScreen onLogin={setSession} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      <SafeAreaView style={{ flex: 0, backgroundColor: colors.primary }} edges={["top"]} />
      <View style={styles.topbar}>
        <View>
          <Text style={styles.topbarTag}>RNP · NIU</Text>
          <Text style={styles.topbarTitle}>{session.user.prenom} {session.user.nom}</Text>
        </View>
        <TouchableOpacity onPress={seDeconnecter}>
          <Text style={styles.deconnexion}>Déconnexion</Text>
        </TouchableOpacity>
      </View>
      <ContraventionsScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  chargementEcran: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  topbar: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 14
  },
  topbarTag: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: "#fff", opacity: 0.85 },
  topbarTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginTop: 2 },
  deconnexion: { color: "#fff", fontSize: 11, fontWeight: "600", opacity: 0.9 }
});
