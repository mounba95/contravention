# Système National de Gestion des Contraventions
Registre National de la Population (RNP) · Numéro d'Identifiant Unique (NIU)

Système numérique permettant à la Police nationale d'émettre des contraventions
sur le terrain (y compris hors ligne), aux usagers de payer immédiatement via
mobile, et à l'administration de superviser l'ensemble avec traçabilité complète.

## Prérequis

- [Node.js 18+](https://nodejs.org/)
- [PostgreSQL 14+](https://www.postgresql.org/download/)

## Installation (Windows)

### 1. Installer PostgreSQL

Téléchargez et lancez l'installateur depuis
[postgresql.org/download/windows](https://www.postgresql.org/download/windows/).
Notez le mot de passe défini pour l'utilisateur `postgres` (port par défaut : 5432).

### 2. Créer la base de données

Avec **pgAdmin** (installé avec PostgreSQL) :
1. Connectez-vous au serveur.
2. Clic droit sur *Databases* → *Create* → *Database…* → nommez-la `contraventions_db`.
3. Clic droit sur `contraventions_db` → *Query Tool* → ouvrez `backend/db/schema.sql` → exécutez (F5).

*Alternative en ligne de commande (si `psql` est dans le PATH) :*
```powershell
psql -U postgres -c "CREATE DATABASE contraventions_db;"
psql -U postgres -d contraventions_db -f backend\db\schema.sql
```

### 3. Configurer l'application

Dans `backend`, copiez `.env.example` vers `.env` et remplacez `PGPASSWORD` par
votre mot de passe PostgreSQL. **Changez aussi `JWT_SECRET`** par une valeur
longue et aléatoire avant tout usage réel (le serveur vous avertit au
démarrage si vous ne l'avez pas fait).

### 4. Installer et démarrer

```powershell
cd backend
npm install
npm start
```

Le serveur démarre sur **http://localhost:3000** et amorce automatiquement les
données de démonstration si la base est vide.

## Installation (macOS / Linux)

```bash
sudo apt-get install postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'contraventions_dev';"
sudo -u postgres psql -c "CREATE DATABASE contraventions_db;"
sudo -u postgres psql -d contraventions_db -f backend/db/schema.sql

cd backend
cp .env.example .env   # puis modifiez JWT_SECRET et PGPASSWORD
npm install
npm start
```

## Installation (Docker — recommandé pour un déploiement rapide)

```bash
docker compose up -d --build
```

Cela démarre PostgreSQL (avec le schéma appliqué automatiquement) et
l'application sur `http://localhost:3000`. Les données PostgreSQL et les
photos de preuve sont conservées dans des volumes Docker persistants.
Définissez `JWT_SECRET` et `PGPASSWORD` dans un fichier `.env` à la racine
avant un usage réel.

## Déploiement en production (domaine réel, HTTPS)

Voir **`DEPLOYMENT.md`** — guide complet à transmettre à l'administrateur
serveur/DNS pour un déploiement sur un vrai domaine (ex: `dgecmr.ne`), avec
configuration Nginx + HTTPS automatique (Let's Encrypt) déjà prête dans
`deploy/nginx-contraventions.conf`.

## Frontend web (React)

Les interfaces web (Agent, Administration, page de paiement/contestation par
lien SMS) sont de vraies applications React (composants, state management),
construites avec Vite, dans le dossier `frontend/`. Le résultat compilé est
généré directement dans `backend/public/` — le serveur Express n'a rien de
plus à faire pour les servir.

**Développement** (avec rechargement à chaud) :
```bash
cd frontend
npm install
npm run dev
```
Ouvre un serveur de développement séparé (généralement `http://localhost:5173`)
qui redirige automatiquement les appels `/api/...` vers le backend
(`http://localhost:3000`) — assurez-vous que celui-ci tourne aussi.

**Production** (à faire à chaque changement de code avant de livrer) :
```bash
cd frontend
npm run build
```
Régénère `backend/public/` avec les fichiers compilés et optimisés. Le
backend sert alors la version à jour au prochain accès (pas besoin de
redémarrer `backend/`).

## Application mobile native (Agent)

Le canal principal pour l'agent de terrain est une **vraie application
mobile native** (React Native / Expo) :

- **`mobile-agent/`** — identification par plaque d'immatriculation (reliée
  au NIU du propriétaire), création de contravention (multi-infractions),
  photo native, GPS, fonctionnement hors ligne avec synchronisation
  automatique.

Voir le `README.md` du dossier pour le démarrage (testable en 2 minutes via
l'app Expo Go) et la production d'un fichier `.apk` installable.

L'interface web `agent.html` reste disponible en secours (ex: accès depuis un
navigateur sans installation), mais l'application mobile est désormais
l'outil recommandé. La page racine (`/`) va directement à la connexion
**Administration** — c'est la seule interface pensée pour un usage navigateur
au quotidien.

Le citoyen n'a **aucune application à installer ni compte à créer** : il
reçoit un SMS avec un lien de paiement (et de contestation) dès qu'une
contravention est émise à son nom — voir `payer.html` ci-dessous.

## Interfaces

- `http://localhost:3000/` — page d'accueil
- `http://localhost:3000/agent.html` — **Agent de police** (`agent007` / `agent123`) — installable en PWA, fonctionne hors ligne
- `http://localhost:3000/admin.html` — **Administration** (`admin` / `admin123`)
- `http://localhost:3000/payer.html?t=...` — **Paiement et contestation** par lien reçu par SMS (aucun identifiant ni mot de passe requis — le jeton de l'URL fait foi)

## Architecture

```
contravention-system/
├── docker-compose.yml
├── mobile-agent/                 # Application mobile Agent (React Native / Expo)
│   ├── App.js
│   ├── app.json
│   ├── README.md                 # Instructions de lancement et de build (.apk)
│   └── src/ ...
├── frontend/                     # Applications web React (Agent, Admin, page de paiement/contestation)
│   ├── src/
│   │   ├── agent/ admin/ payer/   # Une SPA par interface
│   │   └── shared/                # Composants, styles et client API partagés
│   └── vite.config.js             # Build vers backend/public/
└── backend/
    ├── server.js                 # Point d'entrée Express (sécurité, routes, amorçage)
    ├── Dockerfile
    ├── ecosystem.config.js       # Configuration PM2 (déploiement sans Docker)
    ├── .env.example
    ├── db/
    │   ├── pool.js                # Pool de connexions PostgreSQL
    │   ├── schema.sql             # Schéma relationnel complet (installation neuve)
    │   ├── migrations/
    │   │   └── 001 à 005 (voir "Mise à jour d'une installation existante")
    │   ├── store.js               # Requêtes SQL paramétrées
    │   ├── seed.js                 # Données de démonstration (idempotent)
    │   └── backup.sh               # Script de sauvegarde (pg_dump, cron-compatible)
    ├── services/
    │   └── rnpClient.js            # ⭐ Point d'intégration RNP unique (voir feuille de route)
    ├── middleware/
    │   ├── auth.js                 # JWT + contrôle de rôle
    │   ├── audit.js                # Journal d'audit en chaîne de hachage
    │   └── validators.js           # Validation NIU / téléphone / nettoyage de texte
    ├── routes/
    │   ├── auth.js, rnp.js, vehicules.js, contraventions.js, paiements.js,
    │   │   paiementLien.js, contestations.js, dashboard.js, audit.js, export.js, users.js
    ├── uploads/preuves/            # Photos de preuve (fichiers, hors dépôt Git)
    └── public/                     # ⚠️ Généré par `frontend/` (npm run build) — ne pas éditer à la main
```

## Fonctionnalités

- ✅ Base de données PostgreSQL relationnelle (schéma complet, clés étrangères, index)
- ✅ Authentification agent/admin par JWT, rôles distincts et contrôle d'accès vérifié
- ✅ Identification du citoyen par sa **plaque d'immatriculation** (reliée au
  NIU du propriétaire au registre des véhicules), avec repli par NIU si le
  véhicule n'est pas immatriculé — vérification d'identité via le RNP (simulé)
- ✅ Création de contravention sur le terrain (numéro unique, montant auto, agent/lieu/date associés)
- ✅ **Mode hors ligne (PWA)** pour l'interface Agent : installable sur mobile,
  coquille applicative mise en cache, contraventions créées sans réseau mises
  en file d'attente locale (IndexedDB) et synchronisées automatiquement au
  retour de la connexion (vérification RNP différée à la synchronisation)
- ✅ Preuve photo jointe à la contravention, stockée en fichier sur disque
  (jamais en base64 en base) et servie via une route authentifiée uniquement
- ✅ QR code de vérification par contravention
- ✅ **Paiement et contestation sans compte ni mot de passe** : un lien
  unique (jeton à usage contrôlé, expirant) est envoyé par SMS au citoyen dès
  l'émission de la contravention ; il clique et paie (Mobile Money / Banque /
  Wallet simulés, reçu numérique) ou conteste directement, sans rien installer
  ni s'identifier — voir `routes/paiementLien.js` et `payer.html`
- ✅ Statuts automatiques : Non payée / Payée / En retard / Contestée
- ✅ Décision administrative sur les contestations déposées
- ✅ Tableau de bord : montants collectés, taux de paiement, infractions par zone / agent / type
- ✅ Journal d'audit infalsifiable (chaîne de hachage SHA-256) avec vérification d'intégrité
- ✅ Sécurité : en-têtes HTTP (Helmet), limitation du taux de requêtes
  (protection bruteforce sur la connexion), validation stricte des entrées
  (NIU, téléphone), échappement systématique contre les injections XSS,
  `.env`/`uploads` exclus du dépôt Git
- ✅ Recherche, filtres (NIU, numéro, statut, période) et pagination sur la liste des contraventions
- ✅ Export CSV (contraventions et paiements) — base pour l'interopérabilité Trésor public
- ✅ Déploiement prêt à l'emploi : Docker Compose, configuration PM2, script de sauvegarde
- ✅ **Application mobile native** (React Native / Expo) pour l'agent de terrain
  — caméra native, hors ligne, installable (voir `mobile-agent/README.md`)
- ✅ **Contraventions multi-infractions** : un agent peut sélectionner
  plusieurs infractions commises en même temps, combinées sur un seul ticket
  avec le montant total
- ✅ Types d'infraction entièrement gérés par l'administrateur (créer,
  modifier, désactiver) — onglet "Infractions"
- ✅ Gestion des comptes agents/admin depuis l'interface (créer, désactiver,
  réinitialiser un mot de passe) — onglet "Agents" de l'Administration
- ✅ Deux interfaces web en React (SPA) : Agent (secours), Administration —
  plus la page de paiement/contestation (`payer.html`), sans compte

## Comptes de démonstration

| Rôle   | Identifiant | Mot de passe |
|--------|-------------|--------------|
| Agent  | agent007    | agent123     |
| Admin  | admin       | admin123     |

NIU de test (Registre National de la Population simulé) :
`NIU-100234567`, `NIU-100234568`, `NIU-100234569`

## Mise à jour d'une installation existante

Si vous avez déjà installé une version antérieure de ce système, appliquez
les migrations de base de données avant de redémarrer (elles sont sans
danger à rejouer, chacune vérifie si elle est déjà appliquée) :

```bash
psql -U postgres -d contraventions_db -f backend/db/migrations/001_photo_path.sql
psql -U postgres -d contraventions_db -f backend/db/migrations/002_statut_annulee.sql
psql -U postgres -d contraventions_db -f backend/db/migrations/003_users_actif.sql
psql -U postgres -d contraventions_db -f backend/db/migrations/004_infractions_multiples_et_comptes_usagers.sql
psql -U postgres -d contraventions_db -f backend/db/migrations/005_separation_comptes_usagers_rnp.sql
psql -U postgres -d contraventions_db -f backend/db/migrations/006_reinitialisation_mot_de_passe.sql
psql -U postgres -d contraventions_db -f backend/db/migrations/007_methodes_paiement_nommees.sql
psql -U postgres -d contraventions_db -f backend/db/migrations/008_liens_paiement.sql
psql -U postgres -d contraventions_db -f backend/db/migrations/009_vehicules_et_plaque.sql
```

Les tables `comptes_usagers` et `usager_otp` (créées par les migrations 004
et 006) ne sont plus utilisées par l'application depuis la suppression du
portail usager à compte — elles peuvent être conservées sans risque ou
supprimées via une migration dédiée si vous le souhaitez.

## Sauvegardes

```bash
chmod +x backend/db/backup.sh
./backend/db/backup.sh /chemin/vers/dossier/de/sauvegarde
```

Planifiable via une tâche cron (Linux/Mac) ou le Planificateur de tâches
Windows pour une sauvegarde quotidienne automatique.

## Limites connues et pistes pour aller plus loin

Cette base est fonctionnelle de bout en bout, mais certains éléments du
cahier des charges nécessitent des accès/infrastructures réels que je n'ai
pas en environnement de développement :

1. **RNP réel** — un seul fichier à modifier : `backend/services/rnpClient.js`.
   Toutes les autres parties du système (routes, app mobile, interfaces web)
   appellent déjà ce point d'intégration unique et n'ont besoin d'aucun
   changement.
2. **Registre des véhicules réel** — un seul fichier à modifier :
   `backend/services/registreVehiculesClient.js` (résolution plaque → NIU du
   propriétaire).
3. **Paiement réel** — un seul fichier à modifier : `backend/services/paiementClient.js`.
   Le paiement fonctionne déjà **exactement comme dans les autres apps
   nigériennes** (ex: apps de commune pour les taxes) : le citoyen choisit
   MyNita ou AmanaTa depuis la page de paiement reçue par SMS, tape juste son
   numéro de téléphone **sans quitter la page**, et une demande d'approbation
   part vers son propre compte (il valide avec son code PIN habituel). Il
   reste à : ouvrir un compte marchand chez NITA/Amana, utiliser leurs
   identifiants API réels à la place de la simulation, et brancher leur
   webhook de confirmation (au lieu de la confirmation instantanée simulée
   actuelle).
4. **SMS réel** — un seul fichier à modifier : `backend/services/smsClient.js`
   (utilisé pour l'envoi du lien de paiement/contestation). Même principe
   que pour le RNP : aucune autre partie du système n'a besoin de changer.
5. **Application mobile native** — ✅ réalisée (`mobile-agent/`, React Native / Expo).
   Reste à faire pour une mise en production à grande échelle : publication sur
   le Play Store / App Store (comptes développeur), tests sur davantage
   d'appareils, et éventuellement un stockage local plus robuste (SQLite
   mobile) si le volume de contraventions hors ligne devient important.
6. **Interopérabilité Trésor public** — l'export CSV des paiements est une
   première base ; en production, un connecteur automatisé (API ou dépôt
   programmé de fichiers) remplacerait l'export manuel.
7. **Haute disponibilité à grande échelle** — pour un déploiement national,
   prévoir réplication PostgreSQL, sauvegardes automatisées hors site, et
   plusieurs instances applicatives derrière un load balancer (le mode
   cluster de PM2, ou plusieurs conteneurs `app` derrière un reverse proxy,
   sont des points de départ directs à partir de cette base).
