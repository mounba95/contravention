# Guide de déploiement — Système National de Gestion des Contraventions

Document à destination de la personne qui gère le serveur et le DNS à la DGECMR.

## 1. Ce qu'il faut, en résumé

| Élément | Qui s'en charge | Détail |
|---|---|---|
| Serveur Linux (VPS) | Administrateur serveur | Ubuntu 22.04/24.04, 2 Go RAM minimum (4 Go recommandé), IP publique |
| Enregistrement DNS | Administrateur DNS | Un enregistrement **A** pointant un sous-domaine vers l'IP du serveur |
| Ouverture de ports | Administrateur serveur | Ports **80** et **443** ouverts (HTTP/HTTPS) |
| Ce dépôt de code | Vous (déjà fourni) | Contient tout le nécessaire (backend, frontend, Docker) |

## 2. Sous-domaine recommandé

Proposition : **`contraventions.dgecmr.ne`**
(à adapter selon la convention déjà utilisée à la DGECMR)

### Enregistrement DNS à créer

```
Type    Nom                          Valeur
A       contraventions.dgecmr.ne     <IP_PUBLIQUE_DU_SERVEUR>
```

Cette étape est à faire par la personne qui gère le panneau DNS du domaine
(OVH, Cloudflare, ou autre registrar). Une fois créé, vérifier la
propagation avec :
```bash
nslookup contraventions.dgecmr.ne
```

## 3. Prérequis sur le serveur

```bash
# Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

# Nginx (reverse proxy) + Certbot (HTTPS gratuit)
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

## 4. Déploiement de l'application

```bash
# Copier le dossier du projet sur le serveur (scp, git clone, etc.)
cd /opt
# (déposer le dossier contravention-system ici)
cd contravention-system

# Créer le fichier d'environnement RACINE (lu par docker-compose.yml —
# différent de backend/.env, qui ne sert que hors Docker)
cp .env.example .env
nano .env
```

Dans ce fichier `.env` (à la racine, à côté de `docker-compose.yml`), définir
impérativement :
```
PGPASSWORD=<mot_de_passe_fort_et_unique>
JWT_SECRET=<chaine_aleatoire_longue_et_unique>
CORS_ORIGIN=https://contraventions.dgecmr.ne
```
(génération rapide d'une valeur aléatoire pour JWT_SECRET : `openssl rand -base64 48`)

`CORS_ORIGIN` restreint qui a le droit d'appeler l'API depuis un navigateur —
à définir avec l'adresse exacte une fois le sous-domaine confirmé (laisser
vide uniquement en développement local).

```bash
# Démarrer PostgreSQL + l'application
docker compose up -d --build

# Vérifier que ça tourne
docker compose ps
curl http://localhost:3000/api/health
```

## 5. Configuration Nginx (reverse proxy + HTTPS)

Copier le fichier `deploy/nginx-contraventions.conf` fourni dans ce dépôt :

```bash
sudo cp deploy/nginx-contraventions.conf /etc/nginx/sites-available/contraventions
# Remplacer le nom de domaine si différent de contraventions.dgecmr.ne
sudo nano /etc/nginx/sites-available/contraventions
sudo ln -s /etc/nginx/sites-available/contraventions /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Activer HTTPS (Let's Encrypt, gratuit et automatique)

```bash
sudo certbot --nginx -d contraventions.dgecmr.ne
```

Certbot configure automatiquement le renouvellement (valide 90 jours,
renouvelé tout seul via une tâche planifiée qu'il installe lui-même).
Vérifier que le renouvellement automatique fonctionne :
```bash
sudo certbot renew --dry-run
```

## 7. Vérification finale

Ouvrir dans un navigateur :
```
https://contraventions.dgecmr.ne
```
La page d'accueil du système doit s'afficher avec un cadenas HTTPS valide.

## 8. Sauvegardes automatiques

```bash
# Rendre le script exécutable
chmod +x backend/db/backup.sh

# Ajouter une sauvegarde quotidienne à 2h du matin
crontab -e
```
Ajouter la ligne :
```
0 2 * * * cd /opt/contravention-system/backend && PGPASSWORD=<mot_de_passe> ./db/backup.sh /opt/sauvegardes
```

## 9. Après le déploiement — mise à jour de l'application mobile

Une fois l'adresse `https://contraventions.dgecmr.ne` confirmée
fonctionnelle, il faudra :

1. Modifier `mobile-agent/src/config.js` :
   ```js
   export const API_BASE_URL = "https://contraventions.dgecmr.ne";
   ```
2. Recompiler l'application mobile (build complet, pas un simple
   `eas update`, car il s'agit d'un changement d'infrastructure durable) :
   ```bash
   cd mobile-agent
   eas build --platform android --profile preview
   ```

À partir de ce moment, l'application fonctionnera depuis n'importe quel
réseau (4G comprise), plus seulement en Wi-Fi local.

## 10. Maintenance courante

| Action | Commande |
|---|---|
| Voir les logs de l'application | `docker compose logs -f app` |
| Redémarrer l'application | `docker compose restart app` |
| Mettre à jour le code | remplacer les fichiers puis `docker compose up -d --build` |
| Voir l'état de PostgreSQL | `docker compose logs -f db` |
