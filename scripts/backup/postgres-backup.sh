#!/bin/bash

#####################################################################
# Script de sauvegarde automatique PostgreSQL pour EduPilot
# Auteur: Système EduPilot
# Date: 22 Décembre 2025
#####################################################################

# Configuration
BACKUP_DIR="/var/backups/edupilot/postgres"
LOG_DIR="/var/log/edupilot/backups"
RETENTION_DAYS=30  # Garder les sauvegardes pendant 30 jours
DATE=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/backup_${DATE}.log"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Charger les variables d'environnement depuis .env
if [ -f "$(dirname "$0")/../../.env" ]; then
    export $(cat "$(dirname "$0")/../../.env" | grep -v '^#' | xargs)
else
    echo -e "${RED}[ERREUR]${NC} Fichier .env non trouvé"
    exit 1
fi

# Extraire les informations de connexion depuis DATABASE_URL
# Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Fonction de logging
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERREUR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCÈS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[AVERTISSEMENT]${NC} $1" | tee -a "$LOG_FILE"
}

# Créer les répertoires si nécessaire
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

log "=========================================="
log "Début de la sauvegarde PostgreSQL"
log "=========================================="
log "Base de données: $DB_NAME"
log "Hôte: $DB_HOST:$DB_PORT"

# Nom du fichier de sauvegarde
BACKUP_FILE="$BACKUP_DIR/edupilot_${DATE}.sql.gz"

# Exécuter la sauvegarde
log "Création de la sauvegarde..."
export PGPASSWORD="$DB_PASS"

if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --format=plain \
    --verbose \
    --file=- 2>> "$LOG_FILE" | gzip > "$BACKUP_FILE"; then

    # Vérifier la taille du fichier
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    log_success "Sauvegarde créée avec succès: $BACKUP_FILE"
    log "Taille de la sauvegarde: $BACKUP_SIZE"

    # Calculer le checksum
    CHECKSUM=$(sha256sum "$BACKUP_FILE" | cut -d' ' -f1)
    log "Checksum SHA256: $CHECKSUM"
    echo "$CHECKSUM" > "${BACKUP_FILE}.sha256"

else
    log_error "Échec de la sauvegarde"
    exit 1
fi

unset PGPASSWORD

# Nettoyer les anciennes sauvegardes
log "Nettoyage des sauvegardes de plus de $RETENTION_DAYS jours..."
DELETED_COUNT=$(find "$BACKUP_DIR" -name "edupilot_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete -print | wc -l)
if [ $DELETED_COUNT -gt 0 ]; then
    log_success "Suppression de $DELETED_COUNT anciennes sauvegardes"
else
    log "Aucune sauvegarde à supprimer"
fi

# Statistiques des sauvegardes
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "edupilot_*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)

log "=========================================="
log "Sauvegarde terminée avec succès"
log "Nombre total de sauvegardes: $TOTAL_BACKUPS"
log "Espace disque utilisé: $TOTAL_SIZE"
log "=========================================="

# Optionnel: Envoyer une notification
if command -v curl &> /dev/null && [ ! -z "$BACKUP_WEBHOOK_URL" ]; then
    curl -X POST "$BACKUP_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"✅ Sauvegarde EduPilot réussie: $BACKUP_SIZE\"}" \
        &> /dev/null
fi

exit 0
