const { v4: uuid } = require("uuid");
const crypto = require("crypto");
const db = require("../db/store");

/**
 * Journal d'audit "infalsifiable" : chaque entrée est chaînée à la précédente
 * via un hash (hash-chain) SHA-256, ce qui permet de détecter toute altération
 * a posteriori. Le texte JSON exact utilisé pour le hachage est conservé tel
 * quel (detailsRaw) afin que la vérification puisse recalculer le même hash.
 */
async function logAction({ userId, username, role, action, details }) {
  const previousHash = await db.auditLog.lastHash();
  const timestamp = new Date().toISOString();
  const detailsRaw = JSON.stringify(details || {});
  const hash = crypto
    .createHash("sha256")
    .update(previousHash + JSON.stringify({ userId, action, details, timestamp }))
    .digest("hex");
  const entry = { id: uuid(), timestamp, userId, username, role, action, details, detailsRaw, previousHash, hash };
  await db.auditLog.insert(entry);
  return entry;
}

async function verifyChain() {
  const log = await db.auditLog.allChronological();
  let previousHash = "GENESIS";
  for (const row of log) {
    const timestamp = new Date(row.timestamp).toISOString();
    const details = row.details ? JSON.parse(row.details) : {};
    const expected = crypto
      .createHash("sha256")
      .update(previousHash + JSON.stringify({ userId: row.user_id, action: row.action, details, timestamp }))
      .digest("hex");
    if (expected !== row.hash || row.previous_hash !== previousHash) {
      return { valid: false, brokenAt: row.id };
    }
    previousHash = row.hash;
  }
  return { valid: true };
}

module.exports = { logAction, verifyChain };
