#!/bin/bash

################################################################################
# EduPilot - Script de Restauration de Backup
# Restore database and uploads from backup files
################################################################################

set -e

# ─── Configuration ────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"

BACKUP_DIR="${BACKUP_DIR:-/backups/edupilot}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Functions ────────────────────────────────────────────────────────────────

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# ─── List Available Backups ───────────────────────────────────────────────────

list_backups() {
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║          Available Database Backups                       ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    if [ ! -d "$BACKUP_DIR" ]; then
        error "Backup directory not found: $BACKUP_DIR"
    fi
    
    local backups=($(find "$BACKUP_DIR" -name "db_*.sql.gz" -type f | sort -r))
    
    if [ ${#backups[@]} -eq 0 ]; then
        warning "No database backups found in $BACKUP_DIR"
        exit 1
    fi
    
    echo "Index | Date & Time        | Size      | File"
    echo "------|--------------------|-----------|---------------------------------"
    
    local index=1
    for backup in "${backups[@]}"; do
        local filename=$(basename "$backup")
        local date=$(stat -c %y "$backup" | cut -d' ' -f1)
        local time=$(stat -c %y "$backup" | cut -d' ' -f2 | cut -d'.' -f1)
        local size=$(du -h "$backup" | cut -f1)
        printf "%-5s | %-18s | %-9s | %s\n" "$index" "$date $time" "$size" "$filename"
        ((index++))
    done
    
    echo ""
}

# ─── Select Backup ────────────────────────────────────────────────────────────

select_backup() {
    local backups=($(find "$BACKUP_DIR" -name "db_*.sql.gz" -type f | sort -r))
    
    echo "Select backup to restore (enter index number, or 'q' to quit):"
    read -p "> " selection
    
    if [ "$selection" = "q" ] || [ "$selection" = "Q" ]; then
        log "Restoration cancelled"
        exit 0
    fi
    
    if ! [[ "$selection" =~ ^[0-9]+$ ]]; then
        error "Invalid selection. Please enter a number."
    fi
    
    local index=$((selection - 1))
    
    if [ $index -lt 0 ] || [ $index -ge ${#backups[@]} ]; then
        error "Invalid index. Please select a number from the list."
    fi
    
    echo "${backups[$index]}"
}

# ─── Confirm Restoration ──────────────────────────────────────────────────────

confirm_restore() {
    local backup_file="$1"
    
    echo ""
    warning "⚠️  WARNING: This will REPLACE the current database!"
    echo ""
    echo "Backup file: $(basename "$backup_file")"
    echo "Database: $DB_NAME"
    echo ""
    echo "Are you sure you want to continue? (yes/no)"
    read -p "> " confirm
    
    if [ "$confirm" != "yes" ] && [ "$confirm" != "YES" ]; then
        log "Restoration cancelled"
        exit 0
    fi
}

# ─── Restore Database ─────────────────────────────────────────────────────────

restore_database() {
    local backup_file="$1"
    
    log "Restoring database from: $(basename "$backup_file")"
    
    # Load environment variables
    if [ -f "$PROJECT_ROOT/.env" ]; then
        source "$PROJECT_ROOT/.env"
    fi
    
    DB_NAME="${POSTGRES_DB:-edupilot}"
    DB_USER="${POSTGRES_USER:-edupilot}"
    DB_HOST="${POSTGRES_HOST:-localhost}"
    DB_PORT="${POSTGRES_PORT:-5432}"
    
    # Check if psql is available
    if ! command -v psql &> /dev/null; then
        error "psql not found. Please install PostgreSQL client tools."
    fi
    
    # Verify backup file exists and is valid
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    if ! gzip -t "$backup_file" 2>/dev/null; then
        error "Backup file is corrupted: $backup_file"
    fi
    
    # Create a safety backup before restoring
    log "Creating safety backup of current database..."
    local safety_backup="$BACKUP_DIR/safety_backup_$(date +%Y%m%d_%H%M%S).sql.gz"
    
    if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        | gzip > "$safety_backup"; then
        success "Safety backup created: $(basename "$safety_backup")"
    else
        warning "Failed to create safety backup, but continuing..."
    fi
    
    # Restore database
    log "Restoring database..."
    
    if gunzip < "$backup_file" | PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --quiet; then
        success "Database restored successfully"
        
        # Apply migrations if needed
        log "Checking for pending migrations..."
        cd "$PROJECT_ROOT"
        if npx prisma migrate deploy --skip-generate 2>/dev/null; then
            success "Migrations applied"
        else
            warning "Migration check skipped or failed"
        fi
        
        return 0
    else
        error "Database restoration failed. Attempting to restore safety backup..."
        
        # Try to restore safety backup
        if [ -f "$safety_backup" ]; then
            gunzip < "$safety_backup" | PGPASSWORD="$POSTGRES_PASSWORD" psql \
                -h "$DB_HOST" \
                -p "$DB_PORT" \
                -U "$DB_USER" \
                -d "$DB_NAME" \
                --quiet
            error "Restored safety backup. Original restoration failed!"
        fi
        
        return 1
    fi
}

# ─── Restore Uploads ──────────────────────────────────────────────────────────

restore_uploads() {
    echo ""
    echo "Do you want to restore uploads as well? (yes/no)"
    read -p "> " restore_uploads_choice
    
    if [ "$restore_uploads_choice" != "yes" ] && [ "$restore_uploads_choice" != "YES" ]; then
        log "Skipping uploads restoration"
        return 0
    fi
    
    # Find corresponding uploads backup
    local db_backup_name=$(basename "$1")
    local timestamp=$(echo "$db_backup_name" | grep -oP '\d{8}_\d{6}')
    local uploads_backup="$BACKUP_DIR/uploads_${timestamp}.tar.gz"
    
    if [ ! -f "$uploads_backup" ]; then
        warning "Uploads backup not found: $(basename "$uploads_backup")"
        return 0
    fi
    
    log "Restoring uploads from: $(basename "$uploads_backup")"
    
    # Backup current uploads
    local uploads_dir="$PROJECT_ROOT/public/uploads"
    if [ -d "$uploads_dir" ]; then
        local current_uploads_backup="$uploads_dir.backup_$(date +%Y%m%d_%H%M%S)"
        mv "$uploads_dir" "$current_uploads_backup"
        success "Current uploads backed up to: $(basename "$current_uploads_backup")"
    fi
    
    # Extract uploads
    if tar -xzf "$uploads_backup" -C "$PROJECT_ROOT/public/"; then
        success "Uploads restored successfully"
        return 0
    else
        error "Failed to restore uploads"
        return 1
    fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║        EduPilot - Backup Restoration Script              ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    
    # List available backups
    list_backups
    
    # Select backup
    local backup_file=$(select_backup)
    
    # Confirm restoration
    confirm_restore "$backup_file"
    
    echo ""
    log "Starting restoration process..."
    echo ""
    
    # Restore database
    if restore_database "$backup_file"; then
        echo ""
        
        # Optionally restore uploads
        restore_uploads "$backup_file"
        
        echo ""
        success "✨ Restoration completed successfully!"
        echo ""
        log "Next steps:"
        echo "  1. Restart your application"
        echo "  2. Verify data integrity"
        echo "  3. Test critical features"
        echo ""
        exit 0
    else
        error "Restoration failed!"
    fi
}

# ─── Execute ──────────────────────────────────────────────────────────────────

main "$@"
