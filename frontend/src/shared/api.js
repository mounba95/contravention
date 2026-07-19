const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export function getSession() {
  const raw = localStorage.getItem("session");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveSession(data) {
  localStorage.setItem("session", JSON.stringify(data));
}

export function clearSession() {
  localStorage.removeItem("session");
}

export async function api(path, method = "GET", body = null, auth = true) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const session = getSession();
    if (session && session.token) headers["Authorization"] = `Bearer ${session.token}`;
  }
  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch { /* réponse non-JSON (ex: CSV) */ }
  if (!res.ok) {
    if (res.status === 401) clearSession();
    throw new Error(data.error || `Erreur (${res.status})`);
  }
  return data;
}

/** Télécharge un export CSV en respectant l'authentification (fetch + blob, pas de lien direct). */
export async function telechargerExport(path, nomFichier) {
  const session = getSession();
  const res = await fetch(API_BASE + path, {
    headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {}
  });
  if (!res.ok) throw new Error("Échec de l'export.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}
