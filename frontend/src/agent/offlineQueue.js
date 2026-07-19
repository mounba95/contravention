const QUEUE_KEY = "file_attente_contraventions";

function lire() {
  const raw = localStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function ecrire(items) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export function mettreEnFileAttente(payload) {
  const items = lire();
  items.push({ cle: Date.now() + "-" + Math.random(), payload });
  ecrire(items);
}

export function taille() {
  return lire().length;
}

let enCours = false;

export async function synchroniser(apiFn) {
  if (enCours || !navigator.onLine) return { succes: 0 };
  enCours = true;
  let succes = 0;
  try {
    const items = lire();
    const restants = [];
    for (const item of items) {
      try {
        await apiFn("/api/contraventions", "POST", item.payload);
        succes++;
      } catch {
        restants.push(item);
      }
    }
    ecrire(restants);
  } finally {
    enCours = false;
  }
  return { succes };
}
