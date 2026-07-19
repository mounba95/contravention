#!/bin/bash
# Sauvegarde la base de données PostgreSQL du système de contraventions.
# Usage : ./backup.sh [dossier_de_destination]
# Peut être planifié via cron, ex. sauvegarde quotidienne à 2h du matin :
#   0 2 * * * /chemin/vers/backend/db/backup.sh /chemin/vers/sauvegardes

set -e

DEST="${1:-./sauvegardes}"
mkdir -p "$DEST"

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"
PGUSER="${PGUSER:-postgres}"
PGDATABASE="${PGDATABASE:-contraventions_db}"

HORODATAGE=$(date +%Y%m%d_%H%M%S)
FICHIER="$DEST/contraventions_db_${HORODATAGE}.sql.gz"

PGPASSWORD="$PGPASSWORD" pg_dump -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" | gzip > "$FICHIER"

echo "Sauvegarde créée : $FICHIER"

# Conserve uniquement les 30 dernières sauvegardes
ls -1t "$DEST"/contraventions_db_*.sql.gz | tail -n +31 | xargs -r rm --
