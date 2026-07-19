# Application mobile Usager — Contraventions

Application React Native (Expo) pour les citoyens : création de compte,
consultation de ses propres contraventions, paiement (Mobile Money/Banque/
Wallet simulés), contestation, et QR code de vérification.

## Démarrage rapide (test en 2 minutes)

### 1. Indiquer l'adresse du serveur

Ouvrez `src/config.js` et remplacez l'adresse par celle du serveur backend :
```js
export const API_BASE_URL = "http://VOTRE_IP_LOCALE:3000";
```
(même adresse que celle utilisée pour `mobile-agent`)

### 2. Installer et lancer

```bash
npm install
npx expo start
```

Scannez le QR code avec l'app **Expo Go**. Créez un compte avec un NIU de
test (`NIU-100234567`, `NIU-100234568` ou `NIU-100234569`) et le téléphone
correspondant enregistré au RNP simulé (voir `backend/db/seed.js` pour la
liste), puis un mot de passe de votre choix.

## Construire un .apk installable

Identique à `mobile-agent` — voir son README pour le détail. En résumé :
```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

## Mises à jour à distance (EAS Update)

```bash
eas update:configure   # une seule fois
eas update --branch preview --message "Description du changement"
```

## Sécurité

- Un usager ne peut voir, payer ou contester que **ses propres**
  contraventions — le NIU est dérivé du jeton de connexion, jamais transmis
  librement par l'application.
- L'inscription exige que le téléphone fourni corresponde à celui enregistré
  au Registre National de la Population pour ce NIU — cela empêche quelqu'un
  de créer un compte avec le NIU d'un tiers.
