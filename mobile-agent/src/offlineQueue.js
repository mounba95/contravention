import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const QUEUE_KEY = "file_attente_contraventions";

async function lireFile() {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function ecrireFile(items) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function mettreEnFileAttente(payload) {
  const items = await lireFile();
  items.push({ id: Date.now() + "-" + Math.random(), payload, horodatage: new Date().toISOString() });
  await ecrireFile(items);
}

export async function listerFileAttente() {
  return lireFile();
}

export async function taillefileAttente() {
  return (await lireFile()).length;
}

let synchronisationEnCours = false;

/** Tente d'envoyer toutes les contraventions en attente. Retourne {succes, echecs}. */
export async function synchroniserFileAttente() {
  if (synchronisationEnCours) return { succes: 0, echecs: 0 };
  synchronisationEnCours = true;
  let succes = 0, echecs = 0;
  try {
    let items = await lireFile();
    const restants = [];
    for (const item of items) {
      try {
        await api("/api/contraventions", "POST", item.payload);
        succes++;
      } catch (e) {
        echecs++;
        restants.push(item); // reste en file pour la prochaine tentative
      }
    }
    await ecrireFile(restants);
  } finally {
    synchronisationEnCours = false;
  }
  return { succes, echecs };
}
