#!/bin/bash

################################################################################
# EduPilot - Script de Backup Automatique
# Backup de la base de données PostgreSQL et des fichiers uploadés
################################################################################

set -e  # Exit on error

# ─── Configuration ────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Backup directory
BACKUP_DIR="${BACKUP_DIR:-/backups/edupilot}"
mkdir -p "$BACKUP_DIR"

# Date format
DATE=$(date +%Y%m%d_%H%M%S)
DATE_SHORT=$(date +%Y%m%d)

# Database configuration (from .env)
if [ -f "$PROJECT_ROOT/.env" ]; then
    source "$PROJECT_ROOT/.env"
fi

DB_NAME="${POSTGRES_DB:-edupilot}"
DB_USER="${POSTGRES_USER:-edupilot}"
DB_HOST="${POSTGRES_HOST:-localhost}"
DB_PORT="${POSTGRES_PORT:-5432}"

# Retention policy (days)
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Functions ────────────────────────────────────────────────────────────────

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1" >&2
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# ─── Database Backup ──────────────────────────────────────────────────────────

backup_database() {
    log "Starting database backup..."
    
    local backup_file="$BACKUP_DIR/db_${DB_NAME}_${DATE}.sql.gz"
    
    # Check if pg_dump is available
    if ! command -v pg_dump &> /dev/null; then
        error "pg_dump not found. Please install PostgreSQL client tools."
        return 1
    fi
    
    # Create backup
    if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        | gzip > "$backup_file"; then
        
        local file_size=$(du -h "$backup_file" | cut -f1)
        success "Database backup created: $backup_file ($file_size)"
        return 0
    else
        error "Database backup failed"
        return 1
    fi
}

# ─── Files Backup ─────────────────────────────────────────────────────────────

backup_uploads() {
    log "Starting uploads backup..."
    
    local uploads_dir="$PROJECT_ROOT/public/uploads"
    local backup_file="$BACKUP_DIR/uploads_${DATE}.tar.gz"
    
    if [ ! -d "$uploads_dir" ]; then
        warning "Uploads directory not found: $uploads_dir"
        return 0
    fi
    
    # Count files
    local file_count=$(find "$uploads_dir" -type f | wc -l)
    
    if [ "$file_count" -eq 0 ]; then
        warning "No files to backup in uploads directory"
        return 0
    fi
    
    # Create backup
    if tar -czf "$backup_file" -C "$PROJECT_ROOT/public" uploads; then
        local file_size=$(du -h "$backup_file" | cut -f1)
        success "Uploads backup created: $backup_file ($file_size)"
        return 0
    else
        error "Uploads backup failed"
        return 1
    fi
}

# ─── Cleanup Old Backups ──────────────────────────────────────────────────────

cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted=0
    
    # Delete old database backups
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted++))
    done < <(find "$BACKUP_DIR" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -print0)
    
    # Delete old uploads backups
    while IFS= read -r -d '' file; do
        rm -f "$file"
        ((deleted++))
    done < <(find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +$RETENTION_DAYS -print0)
    
    if [ $deleted -gt 0 ]; then
        success "Deleted $deleted old backup(s)"
    else
        log "No old backups to delete"
    fi
}

# ─── Verify Backup ────────────────────────────────────────────────────────────

verify_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Check if file is not empty
    if [ ! -s "$backup_file" ]; then
        error "Backup file is empty: $backup_file"
        return 1
    fi
    
    # For gzip files, test integrity
    if [[ "$backup_file" == *.gz ]]; then
        if gzip -t "$backup_file" 2>/dev/null; then
            success "Backup integrity verified: $backup_file"
            return 0
        else
            error "Backup integrity check failed: $backup_file"
            return 1
        fi
    fi
    
    return 0
}

# ─── Send Notification ────────────────────────────────────────────────────────

send_notification() {
    local status="$1"
    local message="$2"
    
    # Email notification (if configured)
    if [ -n "$BACKUP_NOTIFICATION_EMAIL" ] && command -v mail &> /dev/null; then
        echo "$message" | mail -s "EduPilot Backup $status" "$BACKUP_NOTIFICATION_EMAIL"
    fi
    
    # Slack notification (if webhook configured)
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        [ "$status" = "Failed" ] && color="danger"
        
        curl -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"EduPilot Backup $status\",
                    \"text\": \"$message\",
                    \"ts\": $(date +%s)
                }]
            }" \
            --silent --output /dev/null
    fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║          EduPilot - Automated Backup Script              ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    log "Backup started"
    log "Backup directory: $BACKUP_DIR"
    log "Retention: $RETENTION_DAYS days"
    echo ""
    
    local backup_success=true
    local backup_files=()
    
    # Database backup
    if backup_database; then
        local db_backup="$BACKUP_DIR/db_${DB_NAME}_${DATE}.sql.gz"
        if verify_backup "$db_backup"; then
            backup_files+=("$db_backup")
        else
            backup_success=false
        fi
    else
        backup_success=false
    fi
    
    echo ""
    
    # Uploads backup
    if backup_uploads; then
        local uploads_backup="$BACKUP_DIR/uploads_${DATE}.tar.gz"
        if [ -f "$uploads_backup" ]; then
            if verify_backup "$uploads_backup"; then
                backup_files+=("$uploads_backup")
            else
                backup_success=false
            fi
        fi
    fi
    
    echo ""
    
    # Cleanup old backups
    cleanup_old_backups
    
    echo ""
    
    # Summary
    log "Backup summary:"
    if [ ${#backup_files[@]} -gt 0 ]; then
        for file in "${backup_files[@]}"; do
            local size=$(du -h "$file" | cut -f1)
            echo "  - $(basename "$file") ($size)"
        done
    fi
    
    # Calculate total backup size
    local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)
    echo ""
    log "Total backup size: $total_size"
    
    # Send notification
    if [ "$backup_success" = true ]; then
        success "Backup completed successfully!"
        send_notification "Success" "Backup completed successfully. Files: ${#backup_files[@]}, Total size: $total_size"
        exit 0
    else
        error "Backup completed with errors!"
        send_notification "Failed" "Backup completed with errors. Please check the logs."
        exit 1
    fi
}

# ─── Execute ──────────────────────────────────────────────────────────────────

main "$@"
