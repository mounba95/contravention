import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_KEY = "session";

export async function getSession() {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveSession(data) {
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export async function clearSession() {
  await AsyncStorage.removeItem(SESSION_KEY);
}
