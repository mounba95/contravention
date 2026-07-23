const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

// Clé de session propre à chaque interface (agent / admin), fixée une fois
// au démarrage via setNamespace() dans main.jsx de chaque appli. Sans ça,
// agent.html et admin.html partageraient la même session dans le
// navigateur : se connecter sur l'une écraserait la session de l'autre
// (symptôme : "Accès refusé pour ce rôle." après avoir ouvert l'autre
// interface dans un autre onglet).
let NAMESPACE = "session";

export function setNamespace(ns) {
  NAMESPACE = `session_${ns}`;
}

/** Lit l'horodatage d'expiration (ms) d'un JWT sans vérifier sa signature —
 *  seul le backend fait foi pour la sécurité, ceci ne sert qu'à décider si
 *  l'interface doit renvoyer directement vers l'écran de connexion. */
function expirationToken(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(payload + "=".repeat((4 - payload.length % 4) % 4)));
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getSession() {
  const raw = localStorage.getItem(NAMESPACE);
  if (!raw) return null;
  let session;
  try { session = JSON.parse(raw); } catch { return null; }

  // Session expirée (12h d'inactivité) : on la purge et on se comporte comme
  // si l'utilisateur n'était jamais connecté, plutôt que de laisser
  // l'interface affichée jusqu'au premier appel API qui échouerait.
  const expiration = session?.token ? expirationToken(session.token) : null;
  if (expiration !== null && expiration <= Date.now()) {
    localStorage.removeItem(NAMESPACE);
    return null;
  }
  return session;
}

export function saveSession(data) {
  localStorage.setItem(NAMESPACE, JSON.stringify(data));
}

export function clearSession() {
  localStorage.removeItem(NAMESPACE);
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
