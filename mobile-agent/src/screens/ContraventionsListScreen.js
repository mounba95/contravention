import React, { useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { api } from "../api";
import { colors, typography, couleurStatut, libelleStatut } from "../theme";

export default function ContraventionsListScreen() {
  const [liste, setListe] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  const charger = useCallback(async () => {
    setChargement(true);
    setErreur(null);
    try {
      const data = await api("/api/contraventions?limit=50", "GET");
      setListe(data.rows);
    } catch (e) {
      setErreur("Liste indisponible hors ligne.");
    } finally {
      setChargement(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { charger(); }, [charger]));

  if (erreur) {
    return <View style={styles.centre}><Text style={styles.videTexte}>{erreur}</Text></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      data={liste}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={chargement} onRefresh={charger} />}
      ListEmptyComponent={
        <View style={styles.centre}><Text style={styles.videTexte}>Aucune contravention émise pour le moment.</Text></View>
      }
      renderItem={({ item }) => (
        <View style={styles.ligne}>
          <View style={{ flex: 1 }}>
            <Text style={styles.numero}>{item.numero_unique}</Text>
            <Text style={styles.details}>{item.citoyen_prenom} {item.citoyen_nom} — {item.type_infraction_libelle}</Text>
            <Text style={styles.details}>{item.lieu}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={styles.montant}>{item.montant.toLocaleString("fr-FR")} FCFA</Text>
            <Text style={[styles.statut, { color: couleurStatut(item.statut) }]}>{libelleStatut(item.statut)}</Text>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  videTexte: { fontSize: 13, fontWeight: "500", color: colors.inkSoft, textAlign: "center" },
  ligne: {
    flexDirection: "row", justifyContent: "space-between",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 16, padding: 14, marginBottom: 10,
    shadowColor: "#131B33", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 1
  },
  numero: { fontFamily: "monospace", fontSize: 13, fontWeight: "700", color: colors.ink },
  details: { fontSize: 12.5, color: colors.inkSoft, marginTop: 2 },
  montant: { fontFamily: "monospace", fontSize: 13, fontWeight: "600", color: colors.ink },
  statut: { fontSize: 10.5, fontWeight: "700", textTransform: "uppercase", marginTop: 4 }
});
