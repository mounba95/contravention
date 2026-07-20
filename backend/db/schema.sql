-- Schéma du Système National de Gestion des Contraventions
-- Correspond directement aux anciennes collections JSON, sans changement de logique métier.

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('agent', 'admin')),
  nom TEXT NOT NULL,
  matricule TEXT,
  station TEXT,
  actif BOOLEAN NOT NULL DEFAULT true
);

-- Simulation du Registre National de la Population (RNP).
-- ⚠️ En production, cette table sera remplacée par un vrai appel au RNP via
-- services/rnpClient.js — elle ne sert ici qu'à simuler les données d'identité.
CREATE TABLE IF NOT EXISTS citoyens (
  niu TEXT PRIMARY KEY,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance DATE NOT NULL,
  telephone TEXT NOT NULL,
  password_hash TEXT              -- obsolète, conservé pour compatibilité — voir comptes_usagers
);

-- Comptes usagers de l'application (indépendants du RNP, gérés uniquement
-- par ce système). C'est ici que vivent les mots de passe des citoyens,
-- quelle que soit la source d'identité (simulation locale ou vrai RNP).
CREATE TABLE IF NOT EXISTS comptes_usagers (
  niu TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL
);

-- Codes de réinitialisation de mot de passe (usage unique, envoyés par SMS —
-- simulé pour l'instant, voir services/smsClient.js).
CREATE TABLE IF NOT EXISTS usager_otp (
  id UUID PRIMARY KEY,
  niu TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expire_le TIMESTAMPTZ NOT NULL,
  utilise BOOLEAN NOT NULL DEFAULT false,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_usager_otp_niu ON usager_otp(niu);

-- Registre des véhicules (carte grise) — relie une plaque au NIU de son
-- propriétaire. C'est le point d'entrée de l'agent sur le terrain : il saisit
-- la plaque, le système en déduit le NIU puis le téléphone (via le RNP).
-- ⚠️ En production, remplacé par un vrai appel via services/registreVehiculesClient.js.
CREATE TABLE IF NOT EXISTS vehicules (
  plaque TEXT PRIMARY KEY,                       -- normalisée : majuscules, sans espaces
  niu TEXT NOT NULL REFERENCES citoyens(niu),
  marque TEXT,
  modele TEXT,
  couleur TEXT
);
CREATE INDEX IF NOT EXISTS idx_vehicules_niu ON vehicules(niu);

-- Réglages système modifiables depuis l'Administration (ex: taux de
-- majoration de retard) sans toucher au code — voir migration 010.
CREATE TABLE IF NOT EXISTS parametres (
  cle TEXT PRIMARY KEY,
  valeur TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS types_infraction (
  id UUID PRIMARY KEY,
  libelle TEXT NOT NULL,
  montant INTEGER NOT NULL,
  actif BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS contraventions (
  id UUID PRIMARY KEY,
  numero_unique TEXT UNIQUE NOT NULL,
  niu_usager TEXT NOT NULL REFERENCES citoyens(niu),
  plaque TEXT,                               -- plaque saisie par l'agent (NULL si création directe par NIU)
  citoyen_nom TEXT NOT NULL,
  citoyen_prenom TEXT NOT NULL,
  agent_id UUID NOT NULL REFERENCES users(id),
  agent_nom TEXT NOT NULL,
  type_infraction_id UUID REFERENCES types_infraction(id),   -- conservé pour compatibilité ; NULL si plusieurs infractions
  type_infraction_libelle TEXT NOT NULL,                      -- résumé lisible (une ou plusieurs infractions)
  montant INTEGER NOT NULL,                                    -- montant total (somme des infractions)
  lieu TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  notes TEXT DEFAULT '',
  photo_path TEXT,               -- chemin relatif vers le fichier de preuve (uploads/preuves/...)
  date_heure TIMESTAMPTZ NOT NULL,
  date_echeance TIMESTAMPTZ NOT NULL,
  statut TEXT NOT NULL DEFAULT 'NON_PAYEE' CHECK (statut IN ('NON_PAYEE', 'PAYEE', 'EN_RETARD', 'CONTESTEE', 'ANNULEE')),
  -- Figé à l'émission (voir migration 011) : le taux en vigueur au moment de
  -- la contravention, jamais recalculé avec la valeur courante du paramètre
  -- (une majoration ne doit pas être rétroactive).
  taux_majoration_retard NUMERIC NOT NULL DEFAULT 5
);
CREATE INDEX IF NOT EXISTS idx_contraventions_niu ON contraventions(niu_usager);
CREATE INDEX IF NOT EXISTS idx_contraventions_agent ON contraventions(agent_id);
CREATE INDEX IF NOT EXISTS idx_contraventions_numero ON contraventions(numero_unique);

-- Détail des infractions composant une contravention (une contravention peut
-- regrouper plusieurs infractions commises en même temps, avec un montant
-- total combiné affiché sur un seul ticket).
CREATE TABLE IF NOT EXISTS contravention_infractions (
  id UUID PRIMARY KEY,
  contravention_id UUID NOT NULL REFERENCES contraventions(id) ON DELETE CASCADE,
  type_infraction_id UUID NOT NULL REFERENCES types_infraction(id),
  type_infraction_libelle TEXT NOT NULL,
  montant INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contravention_infractions_contravention ON contravention_infractions(contravention_id);

-- Liens de paiement par SMS : permettent à un citoyen de payer sans compte ni
-- application, depuis le lien reçu par SMS au numéro enrôlé au RNP. Le jeton
-- (haché en SHA-256) donne accès à UNE seule contravention, expire, et devient
-- inutilisable après paiement. Voir routes/paiementLien.js.
CREATE TABLE IF NOT EXISTS liens_paiement (
  id UUID PRIMARY KEY,
  contravention_id UUID NOT NULL REFERENCES contraventions(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expire_le TIMESTAMPTZ NOT NULL,
  utilise BOOLEAN NOT NULL DEFAULT false,
  cree_le TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_liens_paiement_token ON liens_paiement(token_hash);
CREATE INDEX IF NOT EXISTS idx_liens_paiement_contravention ON liens_paiement(contravention_id);

CREATE TABLE IF NOT EXISTS paiements (
  id UUID PRIMARY KEY,
  contravention_id UUID NOT NULL REFERENCES contraventions(id),
  numero_contravention TEXT NOT NULL,
  montant INTEGER NOT NULL,
  methode TEXT NOT NULL CHECK (methode IN ('MYNITA', 'AMANATA', 'BANQUE', 'WALLET')),
  numero_telephone TEXT,
  reference TEXT UNIQUE NOT NULL,
  date_paiement TIMESTAMPTZ NOT NULL,
  statut TEXT NOT NULL DEFAULT 'CONFIRME'
);

CREATE TABLE IF NOT EXISTS contestations (
  id UUID PRIMARY KEY,
  contravention_id UUID NOT NULL REFERENCES contraventions(id),
  numero_contravention TEXT NOT NULL,
  niu_usager TEXT NOT NULL,
  motif TEXT NOT NULL,
  date_creation TIMESTAMPTZ NOT NULL,
  statut TEXT NOT NULL DEFAULT 'EN_ATTENTE' CHECK (statut IN ('EN_ATTENTE', 'ACCEPTEE', 'REJETEE')),
  decision_commentaire TEXT,
  date_decision TIMESTAMPTZ
);

-- Journal d'audit infalsifiable (chaîne de hachage)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  user_id TEXT,
  username TEXT,
  role TEXT,
  action TEXT NOT NULL,
  details TEXT,
  previous_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
