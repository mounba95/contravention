# Application mobile Agent — Contraventions

Application React Native (Expo) pour les agents de police sur le terrain :
identification NIU, création de contravention, photo de preuve via l'appareil
photo natif, QR code, et **fonctionnement hors ligne** (contraventions créées
sans réseau, synchronisées automatiquement à la reconnexion).

## Mises à jour à distance (EAS Update) — sans refaire un APK à chaque changement

Une fois l'app installée sur les téléphones via un `.apk` (`eas build`), il
n'est pas nécessaire de recompiler et réinstaller à chaque petite
modification du code JavaScript (correction d'affichage, ajustement de
formulaire, etc.) — seulement quand un nouveau module natif est ajouté
(ex: une nouvelle dépendance `expo-*`).

### Configuration (une seule fois)

```bash
eas update:configure
```

Cette commande relie automatiquement le projet à votre compte EAS (déjà fait
lors de votre premier `eas build`) et complète `app.json` avec les
informations nécessaires.

### Publier une mise à jour

Après toute modification du code JS uniquement (pas d'ajout de nouveau
package natif) :

```bash
eas update --branch preview --message "Description du changement"
```

Les téléphones ayant déjà l'app installée (build `preview`) téléchargent
automatiquement cette mise à jour au prochain lancement de l'application —
aucune réinstallation manuelle nécessaire.

**Important** : si vous ajoutez un nouveau package qui touche au natif (toute
commande `npm install expo-xxx` ou équivalent), il faut repasser par un
nouveau `eas build --profile preview` classique ; `eas update` ne suffit pas
dans ce cas.

## Démarrage rapide (test en 2 minutes, sans rien installer de lourd)

### 1. Indiquer l'adresse du serveur

Ouvrez `src/config.js` et remplacez l'adresse par celle de l'ordinateur qui
fait tourner `backend/` (celui-ci doit être démarré, voir le README principal) :

```js
export const API_BASE_URL = "http://VOTRE_IP_LOCALE:3000";
```

Pour trouver votre adresse IP locale :
- **Windows** : PowerShell → `ipconfig` → ligne "Adresse IPv4"
- **macOS/Linux** : `ifconfig` ou `ip addr`

Le téléphone et l'ordinateur doivent être connectés au **même réseau Wi-Fi**.

### 2. Installer les dépendances

```bash
cd mobile-agent
npm install
```

### 3. Lancer le serveur de développement Expo

```bash
npx expo start
```

Un QR code s'affiche dans le terminal.

### 4. Tester sur votre téléphone

1. Installez l'application **Expo Go** (gratuite, Play Store ou App Store).
2. Scannez le QR code affiché dans le terminal avec l'appareil photo
   (iPhone) ou directement dans l'app Expo Go (Android).
3. L'application se charge sur votre téléphone — connectez-vous avec
   `agent007` / `agent123`.

C'est un **vrai accès natif** à la caméra et au stockage du téléphone, pas une
page web : Expo Go exécute réellement le code React Native.

## Construire une vraie application installable (.apk / .aab)

Le développement via Expo Go (ci-dessus) suffit pour tester et valider toutes
les fonctionnalités. Pour produire un fichier installable indépendamment
d'Expo Go (à distribuer aux agents, ou publier sur le Play Store) :

### Option recommandée : EAS Build (cloud, gratuit pour commencer)

Le fichier `eas.json` est déjà inclus dans ce projet, avec un profil `preview`
prêt à produire un `.apk` installable directement (sans passer par le Play
Store) — vous n'avez que ces commandes à exécuter, dans le dossier `mobile-agent` :

```powershell
npm install -g eas-cli
eas login
```
(la première fois, ça vous demande de créer un compte gratuit — vous pouvez
le faire directement dans le terminal, ou sur [expo.dev](https://expo.dev) puis revenir)

```powershell
eas build --platform android --profile preview
```

La première fois, EAS vous demande la permission de créer un projet lié à
votre compte — répondez **oui**. La compilation se fait sur les serveurs
d'Expo (généralement 10-20 minutes, vous pouvez fermer le terminal, elle
continue). À la fin, un lien apparaît (aussi visible sur
[expo.dev](https://expo.dev/accounts) → votre projet → Builds) permettant de
télécharger directement le fichier `.apk` sur un téléphone Android et de
l'installer, sans Expo Go — l'application tourne alors de façon totalement
autonome, comme n'importe quelle app installée normalement.

Pour une build de production destinée au Play Store (`.aab`) :
```powershell
eas build --platform android --profile production
```

### Option alternative : build locale (nécessite Android Studio)

```bash
npx expo prebuild
npx expo run:android
```

Cette option génère les projets natifs Android/iOS localement — nécessite
l'installation d'Android Studio (gratuit, ~1h la première fois) et est plus
complexe ; l'option EAS Build ci-dessus est recommandée pour la plupart des cas.

**"Network request failed" dans l'app installée (mais ça marche dans le
navigateur du téléphone)** — Android bloque par défaut le trafic HTTP non
chiffré dans les apps compilées (contrairement à Expo Go, plus permissif en
développement). Ce projet configure déjà `usesCleartextTraffic` pour
l'autoriser — **mais cette correction touche à la configuration native, donc
elle nécessite un nouveau `eas build` complet (pas un simple `eas update`)**
pour être effective sur un build déjà installé.

## Dépannage

**"Incompatible SDK version" en scannant le QR code** — l'app Expo Go
installée sur le téléphone (Play Store/App Store) ne supporte qu'une seule
version de SDK à la fois, généralement la plus récente disponible. Si ce
projet a été mis à jour vers un SDK plus récent que celui supporté par votre
Expo Go, deux solutions :
1. Mettez à jour l'app Expo Go sur votre téléphone (Play Store/App Store).
2. Ou alignez ce projet sur le SDK actuellement supporté par Expo Go :
   ```bash
   npm install expo@<version_supportee>
   npx expo install --fix
   ```
   (remplacez `<version_supportee>` par le numéro affiché dans l'app Expo Go
   ou sur [expo.dev/go](https://expo.dev/go))

Ce projet est actuellement figé sur **Expo SDK 54** (aligné sur la version
d'Expo Go actuellement disponible sur le Play Store au moment de la rédaction).

## Structure du projet

```
mobile-agent/
├── App.js                          # Composant racine (navigation, session, hors-ligne)
├── app.json                        # Configuration Expo (nom, permissions, icône)
└── src/
    ├── config.js                   # Adresse du serveur backend (à adapter)
    ├── session.js                  # Gestion de la session (stockage persistant)
    ├── api.js                      # Client API (mêmes conventions que l'interface web)
    ├── offlineQueue.js              # File d'attente hors-ligne (AsyncStorage)
    ├── theme.js                     # Couleurs et styles partagés
    └── screens/
        ├── LoginScreen.js
        ├── CreateContraventionScreen.js
        └── ContraventionsListScreen.js
```

## Fonctionnement hors ligne

Si le réseau n'est pas disponible au moment de créer une contravention (ou de
vérifier un NIU), l'application :
1. Permet à l'agent de continuer normalement.
2. Enregistre la contravention localement sur le téléphone.
3. La transmet automatiquement au serveur dès que la connexion revient
   (détection automatique + tentative périodique).

L'identité de l'usager (vérification RNP) est alors confirmée par le serveur
au moment de la synchronisation, plutôt qu'immédiatement sur le terrain.
