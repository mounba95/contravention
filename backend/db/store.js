/**
 * Couche d'accès aux données — PostgreSQL (remplace l'ancien store JSON fichier).
 * Chaque fonction correspond à une requête paramétrée précise plutôt qu'à un
 * prédicat générique, ce qui est plus sûr et plus performant en SQL.
 */
const { v4: uuidv4 } = require("uuid");
const pool = require("./pool");

const users = {
  async findByUsername(username) {
    const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    return rows[0] || null;
  },
  async findById(id) {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] || null;
  },
  async all() {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY role, nom");
    return rows;
  },
  async count() {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM users");
    return rows[0].c;
  },
  async countByRole(role) {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM users WHERE role = $1 AND actif = true", [role]);
    return rows[0].c;
  },
  async insert(u) {
    await pool.query(
      `INSERT INTO users (id, username, password_hash, role, nom, matricule, station, actif)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [u.id, u.username, u.password_hash, u.role, u.nom, u.matricule || null, u.station || null, u.actif !== false]
    );
    return u;
  },
  async setActif(id, actif) {
    await pool.query("UPDATE users SET actif = $1 WHERE id = $2", [actif, id]);
  },
  async setPassword(id, password_hash) {
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [password_hash, id]);
  }
};

const citoyens = {
  async findByNiu(niu) {
    const { rows } = await pool.query("SELECT * FROM citoyens WHERE niu = $1", [niu]);
    return rows[0] || null;
  },
  async count() {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM citoyens");
    return rows[0].c;
  },
  async insert(c) {
    await pool.query(
      `INSERT INTO citoyens (niu, nom, prenom, date_naissance, telephone) VALUES ($1,$2,$3,$4,$5)`,
      [c.niu, c.nom, c.prenom, c.date_naissance, c.telephone]
    );
    return c;
  }
};

// Registre des véhicules (carte grise simulée). La plaque est stockée
// normalisée (majuscules, sans espaces) — voir middleware/validators.js.
const vehicules = {
  async findByPlaque(plaque) {
    const { rows } = await pool.query("SELECT * FROM vehicules WHERE plaque = $1", [plaque]);
    return rows[0] || null;
  },
  async count() {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM vehicules");
    return rows[0].c;
  },
  async insert(v) {
    await pool.query(
      `INSERT INTO vehicules (plaque, niu, marque, modele, couleur) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (plaque) DO NOTHING`,
      [v.plaque, v.niu, v.marque || null, v.modele || null, v.couleur || null]
    );
    return v;
  }
};

// Liens de paiement par SMS (accès à UNE contravention sans compte, expirants).
// Le jeton est stocké haché ; on le retrouve par égalité directe sur le hash.
const liensPaiement = {
  async creer({ id, contravention_id, token_hash, expire_le }) {
    await pool.query(
      "INSERT INTO liens_paiement (id, contravention_id, token_hash, expire_le) VALUES ($1,$2,$3,$4)",
      [id, contravention_id, token_hash, expire_le]
    );
  },
  /** Lien non expiré correspondant à ce hash (utilisé ou non — le statut réel
   *  de la contravention fait foi pour l'affichage du reçu après paiement). */
  async findParToken(token_hash) {
    const { rows } = await pool.query(
      "SELECT * FROM liens_paiement WHERE token_hash = $1 AND expire_le > NOW() LIMIT 1",
      [token_hash]
    );
    return rows[0] || null;
  },
  async marquerUtilise(id) {
    await pool.query("UPDATE liens_paiement SET utilise = true WHERE id = $1", [id]);
  }
};

// Réglages système modifiables depuis l'Administration (clé/valeur générique).
const parametres = {
  async get(cle) {
    const { rows } = await pool.query("SELECT valeur FROM parametres WHERE cle = $1", [cle]);
    return rows[0] ? rows[0].valeur : null;
  },
  async all() {
    const { rows } = await pool.query("SELECT * FROM parametres ORDER BY cle");
    return rows;
  },
  async set(cle, valeur) {
    await pool.query(
      `INSERT INTO parametres (cle, valeur) VALUES ($1,$2)
       ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur`,
      [cle, valeur]
    );
  }
};

const typesInfraction = {
  async all() {
    const { rows } = await pool.query("SELECT * FROM types_infraction ORDER BY libelle");
    return rows;
  },
  async allActifs() {
    const { rows } = await pool.query("SELECT * FROM types_infraction WHERE actif = true ORDER BY libelle");
    return rows;
  },
  async findById(id) {
    const { rows } = await pool.query("SELECT * FROM types_infraction WHERE id = $1", [id]);
    return rows[0] || null;
  },
  async count() {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS c FROM types_infraction");
    return rows[0].c;
  },
  async insert(t) {
    await pool.query(
      `INSERT INTO types_infraction (id, libelle, montant, actif) VALUES ($1,$2,$3,$4)`,
      [t.id, t.libelle, t.montant, t.actif !== false]
    );
    return t;
  },
  async update(id, { libelle, montant }) {
    await pool.query("UPDATE types_infraction SET libelle = $1, montant = $2 WHERE id = $3", [libelle, montant, id]);
  },
  async setActif(id, actif) {
    await pool.query("UPDATE types_infraction SET actif = $1 WHERE id = $2", [actif, id]);
  }
};

// Sous-requête réutilisée : agrège le détail des infractions d'une contravention en JSON
const INFRACTIONS_SUBQUERY = `(
  SELECT COALESCE(json_agg(json_build_object(
    'type_infraction_id', ci.type_infraction_id,
    'libelle', ci.type_infraction_libelle,
    'montant', ci.montant
  ) ORDER BY ci.montant DESC), '[]')
  FROM contravention_infractions ci WHERE ci.contravention_id = c.id
) AS infractions`;

const contraventions = {
  /**
   * Crée une contravention pouvant regrouper plusieurs infractions.
   * c.infractions : [{ type_infraction_id, libelle, montant }, ...]
   * c.montant est calculé côté appelant comme la somme des infractions.
   */
  async insert(c) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO contraventions
          (id, numero_unique, niu_usager, plaque, citoyen_nom, citoyen_prenom, agent_id, agent_nom,
           type_infraction_id, type_infraction_libelle, montant, lieu, latitude, longitude,
           notes, photo_path, date_heure, date_echeance, statut)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [c.id, c.numero_unique, c.niu_usager, c.plaque || null, c.citoyen_nom, c.citoyen_prenom, c.agent_id, c.agent_nom,
         c.infractions.length === 1 ? c.infractions[0].type_infraction_id : null,
         c.type_infraction_libelle, c.montant, c.lieu, c.latitude, c.longitude,
         c.notes || "", c.photo_path || null, c.date_heure, c.date_echeance, c.statut]
      );
      for (const inf of c.infractions) {
        await client.query(
          `INSERT INTO contravention_infractions (id, contravention_id, type_infraction_id, type_infraction_libelle, montant)
           VALUES ($1,$2,$3,$4,$5)`,
          [uuidv4(), c.id, inf.type_infraction_id, inf.libelle, inf.montant]
        );
      }
      await client.query("COMMIT");
      return c;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },
  async all() {
    const { rows } = await pool.query(`SELECT c.*, ${INFRACTIONS_SUBQUERY} FROM contraventions c ORDER BY date_heure DESC`);
    return rows;
  },
  async allByAgent(agentId) {
    const { rows } = await pool.query(
      `SELECT c.*, ${INFRACTIONS_SUBQUERY} FROM contraventions c WHERE agent_id = $1 ORDER BY date_heure DESC`, [agentId]
    );
    return rows;
  },
  /**
   * Recherche paginée et filtrée. `statut` gère aussi le statut calculé
   * EN_RETARD (échéance dépassée sans paiement), qui n'existe pas tel quel en base.
   */
  async search({ agentId, statut, niu, numero, dateDebut, dateFin, page = 1, limit = 25 } = {}) {
    const conditions = [];
    const params = [];
    let i = 1;

    if (agentId) { conditions.push(`agent_id = $${i++}`); params.push(agentId); }
    if (niu) { conditions.push(`niu_usager ILIKE $${i++}`); params.push(`%${niu}%`); }
    if (numero) { conditions.push(`numero_unique ILIKE $${i++}`); params.push(`%${numero}%`); }
    if (dateDebut) { conditions.push(`date_heure >= $${i++}`); params.push(dateDebut); }
    if (dateFin) { conditions.push(`date_heure <= $${i++}`); params.push(dateFin); }

    if (statut === "PAYEE" || statut === "CONTESTEE" || statut === "ANNULEE") {
      conditions.push(`statut = $${i++}`); params.push(statut);
    } else if (statut === "NON_PAYEE") {
      conditions.push(`statut = 'NON_PAYEE' AND date_echeance >= NOW()`);
    } else if (statut === "EN_RETARD") {
      conditions.push(`statut = 'NON_PAYEE' AND date_echeance < NOW()`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const safeLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);
    const safePage = Math.max(parseInt(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;

    const countResult = await pool.query(`SELECT COUNT(*)::int AS c FROM contraventions c ${whereClause}`, params);
    const total = countResult.rows[0].c;

    params.push(safeLimit, offset);
    const { rows } = await pool.query(
      `SELECT c.*, ${INFRACTIONS_SUBQUERY} FROM contraventions c ${whereClause} ORDER BY date_heure DESC LIMIT $${i++} OFFSET $${i++}`,
      params
    );

    return { rows, total, page: safePage, limit: safeLimit, totalPages: Math.max(Math.ceil(total / safeLimit), 1) };
  },
  /** Utilisé uniquement pour l'export CSV (admin) — mêmes filtres, sans pagination. */
  async searchAll({ statut, niu, numero, dateDebut, dateFin } = {}) {
    const conditions = [];
    const params = [];
    let i = 1;
    if (niu) { conditions.push(`niu_usager ILIKE $${i++}`); params.push(`%${niu}%`); }
    if (numero) { conditions.push(`numero_unique ILIKE $${i++}`); params.push(`%${numero}%`); }
    if (dateDebut) { conditions.push(`date_heure >= $${i++}`); params.push(dateDebut); }
    if (dateFin) { conditions.push(`date_heure <= $${i++}`); params.push(dateFin); }
    if (statut === "PAYEE" || statut === "CONTESTEE" || statut === "ANNULEE") {
      conditions.push(`statut = $${i++}`); params.push(statut);
    } else if (statut === "NON_PAYEE") {
      conditions.push(`statut = 'NON_PAYEE' AND date_echeance >= NOW()`);
    } else if (statut === "EN_RETARD") {
      conditions.push(`statut = 'NON_PAYEE' AND date_echeance < NOW()`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const { rows } = await pool.query(`SELECT c.*, ${INFRACTIONS_SUBQUERY} FROM contraventions c ${whereClause} ORDER BY date_heure DESC`, params);
    return rows;
  },
  async byUsager(niu) {
    const { rows } = await pool.query(
      `SELECT c.*, ${INFRACTIONS_SUBQUERY} FROM contraventions c WHERE niu_usager = $1 ORDER BY date_heure DESC`, [niu]
    );
    return rows;
  },
  async byNumero(numero) {
    const { rows } = await pool.query(`SELECT c.*, ${INFRACTIONS_SUBQUERY} FROM contraventions c WHERE numero_unique = $1`, [numero]);
    return rows[0] || null;
  },
  async byId(id) {
    const { rows } = await pool.query(`SELECT c.*, ${INFRACTIONS_SUBQUERY} FROM contraventions c WHERE id = $1`, [id]);
    return rows[0] || null;
  },
  async updateStatut(id, statut) {
    await pool.query("UPDATE contraventions SET statut = $1 WHERE id = $2", [statut, id]);
  }
};

/**
 * Statistiques du tableau de bord, filtrables par période et par agent.
 * Les mêmes conditions (sur `c`, alias de `contraventions`) sont réutilisées
 * pour les contraventions, leurs infractions et les paiements associés, afin
 * que la recette affichée corresponde exactement au périmètre filtré.
 */
const dashboardStats = {
  async get({ dateDebut, dateFin, agentId } = {}) {
    const conditions = [];
    const params = [];
    let i = 1;
    if (agentId) { conditions.push(`c.agent_id = $${i++}`); params.push(agentId); }
    if (dateDebut) { conditions.push(`c.date_heure >= $${i++}`); params.push(dateDebut); }
    if (dateFin) { conditions.push(`c.date_heure <= $${i++}`); params.push(dateFin); }
    const whereC = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows: totalRows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE c.statut = 'PAYEE')::int AS payees,
         COUNT(*) FILTER (WHERE c.statut = 'CONTESTEE')::int AS contestees,
         COUNT(*) FILTER (WHERE c.statut = 'ANNULEE')::int AS annulees,
         COUNT(*) FILTER (WHERE c.statut = 'NON_PAYEE' AND c.date_echeance >= NOW())::int AS non_payees,
         COUNT(*) FILTER (WHERE c.statut = 'NON_PAYEE' AND c.date_echeance < NOW())::int AS en_retard
       FROM contraventions c ${whereC}`,
      params
    );

    const { rows: zoneRows } = await pool.query(
      `SELECT c.lieu, COUNT(*)::int AS n FROM contraventions c ${whereC} GROUP BY c.lieu ORDER BY n DESC`,
      params
    );

    const { rows: agentRows } = await pool.query(
      `SELECT c.agent_nom, COUNT(*)::int AS n FROM contraventions c ${whereC} GROUP BY c.agent_nom ORDER BY n DESC`,
      params
    );

    const { rows: infractionRows } = await pool.query(
      `SELECT ci.type_infraction_libelle AS libelle, COUNT(*)::int AS n
       FROM contravention_infractions ci
       JOIN contraventions c ON c.id = ci.contravention_id
       ${whereC}
       GROUP BY ci.type_infraction_libelle ORDER BY n DESC`,
      params
    );

    const { rows: montantRows } = await pool.query(
      `SELECT COALESCE(SUM(p.montant),0)::int AS total
       FROM paiements p
       JOIN contraventions c ON c.id = p.contravention_id
       ${whereC}`,
      params
    );

    return {
      total: totalRows[0],
      parZone: zoneRows,
      parAgent: agentRows,
      parInfraction: infractionRows,
      montantCollecte: montantRows[0].total
    };
  }
};

const paiements = {
  async insert(p) {
    await pool.query(
      `INSERT INTO paiements (id, contravention_id, numero_contravention, montant, methode,
         numero_telephone, reference, date_paiement, statut)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [p.id, p.contravention_id, p.numero_contravention, p.montant, p.methode,
       p.numero_telephone, p.reference, p.date_paiement, p.statut]
    );
    return p;
  },
  async all() {
    const { rows } = await pool.query("SELECT * FROM paiements ORDER BY date_paiement DESC");
    return rows;
  }
};

const contestations = {
  async insert(c) {
    await pool.query(
      `INSERT INTO contestations (id, contravention_id, numero_contravention, niu_usager, motif,
         date_creation, statut, decision_commentaire, date_decision)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [c.id, c.contravention_id, c.numero_contravention, c.niu_usager, c.motif,
       c.date_creation, c.statut, c.decision_commentaire, c.date_decision]
    );
    return c;
  },
  async all() {
    const { rows } = await pool.query("SELECT * FROM contestations ORDER BY date_creation DESC");
    return rows;
  },
  async byId(id) {
    const { rows } = await pool.query("SELECT * FROM contestations WHERE id = $1", [id]);
    return rows[0] || null;
  },
  async updateDecision(id, decision, commentaire) {
    await pool.query(
      `UPDATE contestations SET statut = $1, decision_commentaire = $2, date_decision = NOW() WHERE id = $3`,
      [decision, commentaire, id]
    );
  }
};

const auditLog = {
  async all() {
    const { rows } = await pool.query("SELECT * FROM audit_log ORDER BY timestamp DESC");
    return rows.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      userId: r.user_id,
      username: r.username,
      role: r.role,
      action: r.action,
      details: r.details ? JSON.parse(r.details) : {},
      previousHash: r.previous_hash,
      hash: r.hash
    }));
  },
  async allChronological() {
    const { rows } = await pool.query("SELECT * FROM audit_log ORDER BY timestamp ASC");
    return rows;
  },
  async lastHash() {
    const { rows } = await pool.query("SELECT hash FROM audit_log ORDER BY timestamp DESC LIMIT 1");
    return rows[0] ? rows[0].hash : "GENESIS";
  },
  async insert(entry) {
    await pool.query(
      `INSERT INTO audit_log (id, timestamp, user_id, username, role, action, details, previous_hash, hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [entry.id, entry.timestamp, entry.userId, entry.username, entry.role,
       entry.action, entry.detailsRaw, entry.previousHash, entry.hash]
    );
    return entry;
  }
};

module.exports = { users, citoyens, vehicules, liensPaiement, parametres, typesInfraction, contraventions, dashboardStats, paiements, contestations, auditLog, pool };
