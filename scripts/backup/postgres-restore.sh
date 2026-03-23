#!/bin/bash

#####################################################################
# Script de restauration PostgreSQL pour EduPilot
# Auteur: Système EduPilot
# Date: 22 Décembre 2025
#####################################################################

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier les arguments
if [ $# -eq 0 ]; then
    echo -e "${RED}[ERREUR]${NC} Aucun fichier de sauvegarde spécifié"
    echo "Usage: $0 <chemin_vers_backup.sql.gz>"
    echo ""
    echo "Sauvegardes disponibles:"
    find /var/backups/edupilot/postgres -name "edupilot_*.sql.gz" -type f -printf "%T@ %p\n" | sort -rn | cut -d' ' -f2- | head -10
    exit 1
fi

BACKUP_FILE="$1"

# Vérifier que le fichier existe
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}[ERREUR]${NC} Fichier de sauvegarde non trouvé: $BACKUP_FILE"
    exit 1
fi

# Charger les variables d'environnement
if [ -f "$(dirname "$0")/../../.env" ]; then
    export $(cat "$(dirname "$0")/../../.env" | grep -v '^#' | xargs)
else
    echo -e "${RED}[ERREUR]${NC} Fichier .env non trouvé"
    exit 1
fi

# Extraire les informations de connexion
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo "=========================================="
echo "Restauration PostgreSQL EduPilot"
echo "=========================================="
echo "Fichier: $BACKUP_FILE"
echo "Base de données: $DB_NAME"
echo "Hôte: $DB_HOST:$DB_PORT"
echo ""

# Vérifier le checksum si disponible
if [ -f "${BACKUP_FILE}.sha256" ]; then
    echo -e "${YELLOW}[INFO]${NC} Vérification du checksum..."
    EXPECTED_CHECKSUM=$(cat "${BACKUP_FILE}.sha256")
    ACTUAL_CHECKSUM=$(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)

    if [ "$EXPECTED_CHECKSUM" = "$ACTUAL_CHECKSUM" ]; then
        echo -e "${GREEN}[OK]${NC} Checksum validé"
    else
        echo -e "${RED}[ERREUR]${NC} Checksum invalide! Le fichier peut être corrompu."
        echo "Attendu: $EXPECTED_CHECKSUM"
        echo "Obtenu: $ACTUAL_CHECKSUM"
        read -p "Continuer quand même? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
fi

# Confirmation
echo -e "${YELLOW}[AVERTISSEMENT]${NC} Cette opération va ÉCRASER toutes les données actuelles!"
read -p "Êtes-vous sûr de vouloir continuer? (yes/no) " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Restauration annulée"
    exit 0
fi

# Créer une sauvegarde de sécurité avant restauration
echo -e "${YELLOW}[INFO]${NC} Création d'une sauvegarde de sécurité..."
SAFETY_BACKUP="/tmp/edupilot_pre_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
export PGPASSWORD="$DB_PASS"
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" | gzip > "$SAFETY_BACKUP"; then
    echo -e "${GREEN}[OK]${NC} Sauvegarde de sécurité créée: $SAFETY_BACKUP"
else
    echo -e "${RED}[ERREUR]${NC} Échec de la sauvegarde de sécurité"
    unset PGPASSWORD
    exit 1
fi

# Restauration
echo -e "${YELLOW}[INFO]${NC} Démarrage de la restauration..."

# Décompresser et restaurer
if gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    echo -e "${GREEN}[SUCCÈS]${NC} Restauration terminée avec succès!"
    echo ""
    echo "Sauvegarde de sécurité conservée: $SAFETY_BACKUP"
    echo "Vous pouvez la supprimer avec: rm $SAFETY_BACKUP"
else
    echo -e "${RED}[ERREUR]${NC} Échec de la restauration"
    echo ""
    echo "Tentative de restauration de la sauvegarde de sécurité..."
    if gunzip -c "$SAFETY_BACKUP" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
        echo -e "${GREEN}[OK]${NC} Sauvegarde de sécurité restaurée"
    else
        echo -e "${RED}[ERREUR CRITIQUE]${NC} Impossible de restaurer la sauvegarde de sécurité!"
        echo "Sauvegarde: $SAFETY_BACKUP"
    fi
    unset PGPASSWORD
    exit 1
fi

unset PGPASSWORD

echo "=========================================="
echo "Restauration terminée"
echo "=========================================="

exit 0
