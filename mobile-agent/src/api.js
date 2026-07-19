import { API_BASE_URL } from "./config";
import { getSession, clearSession } from "./session";

export async function api(path, method = "GET", body = null, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const session = await getSession();
    if (session && session.token) headers["Authorization"] = `Bearer ${session.token}`;
  }
  const res = await fetch(API_BASE_URL + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    if (res.status === 401) await clearSession();
    throw new Error(data.error || `Erreur (${res.status})`);
  }
  return data;
}
