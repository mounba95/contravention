import React, { useState, useCallback } from "react";
import { View, Text, FlatList, StyleSheet, RefreshControl } from "react-native";
import { api } from "../api";
import { colors, typography } from "../theme";
import TicketCard from "../components/TicketCard";

export default function ContraventionsScreen() {
  const [liste, setListe] = useState(null);
  const [chargement, setChargement] = useState(false);

  const charger = useCallback(async () => {
    setChargement(true);
    try {
      const data = await api("/api/contraventions/mes", "GET");
      setListe(data);
    } catch {
      setListe([]);
    } finally {
      setChargement(false);
    }
  }, []);

  React.useEffect(() => { charger(); }, [charger]);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: 16, flexGrow: 1 }}
      data={liste || []}
      keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={chargement} onRefresh={charger} />}
      ListEmptyComponent={
        <View style={styles.centre}>
          <Text style={styles.videTexte}>
            {liste === null ? "Chargement…" : "Aucune contravention associée à votre compte."}
          </Text>
        </View>
      }
      renderItem={({ item }) => <TicketCard contravention={item} onChanged={charger} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: 60 },
  videTexte: { fontSize: 13.5, fontWeight: "500", color: colors.inkSoft, textAlign: "center" }
});
