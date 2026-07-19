import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import LoginScreen from "./src/screens/LoginScreen";
import CreateContraventionScreen from "./src/screens/CreateContraventionScreen";
import ContraventionsListScreen from "./src/screens/ContraventionsListScreen";
import { getSession, clearSession } from "./src/session";
import { synchroniserFileAttente, taillefileAttente } from "./src/offlineQueue";
import { colors, typography } from "./src/theme";

const Tab = createBottomTabNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [pret, setPret] = useState(false);
  const [enLigne, setEnLigne] = useState(true);
  const [enAttente, setEnAttente] = useState(0);

  useEffect(() => {
    getSession().then(s => { setSession(s); setPret(true); });
  }, []);

  const rafraichirCompteurAttente = useCallback(async () => {
    setEnAttente(await taillefileAttente());
  }, []);

  const tenterSynchronisation = useCallback(async () => {
    await synchroniserFileAttente();
    await rafraichirCompteurAttente();
  }, [rafraichirCompteurAttente]);

  useEffect(() => {
    rafraichirCompteurAttente();
    const unsubscribe = NetInfo.addEventListener(state => {
      const connecte = !!state.isConnected;
      setEnLigne(connecte);
      if (connecte) tenterSynchronisation();
    });
    const intervalle = setInterval(() => { tenterSynchronisation(); }, 30000);
    return () => { unsubscribe(); clearInterval(intervalle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function seDeconnecter() {
    await clearSession();
    setSession(null);
  }

  if (!pret) {
    return (
      <View style={styles.chargementEcran}>
        <ActivityIndicator size="large" color={colors.ink} />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <LoginScreen onLogin={setSession} />
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
          <Text style={styles.topbarTitle}>Contraventions — Terrain</Text>
        </View>
        <TouchableOpacity onPress={seDeconnecter}>
          <Text style={styles.deconnexion}>Déconnexion</Text>
        </TouchableOpacity>
      </View>

      {(!enLigne || enAttente > 0) && (
        <View style={[styles.bandeau, { backgroundColor: enLigne ? colors.ledgerGreenSoft : colors.amberSoft }]}>
          <Text style={{ color: enLigne ? colors.ledgerGreen : colors.amber, ...typography.mono, fontSize: 12 }}>
            {enLigne
              ? `Synchronisation de ${enAttente} contravention(s) en attente…`
              : `⚠ Hors ligne — ${enAttente} contravention(s) en attente de synchronisation`}
          </Text>
        </View>
      )}

      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.inkSoft,
            tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border }
          }}
        >
          <Tab.Screen name="Émettre">
            {() => <CreateContraventionScreen enLigne={enLigne} onCreated={rafraichirCompteurAttente} />}
          </Tab.Screen>
          <Tab.Screen name="Historique" component={ContraventionsListScreen} />
        </Tab.Navigator>
      </NavigationContainer>
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
  deconnexion: { color: "#fff", fontSize: 11, fontWeight: "600", opacity: 0.9 },
  bandeau: { padding: 10, alignItems: "center" }
});
