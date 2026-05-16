#!/bin/bash

# ============================================================
# EduPilot - Unified Launch Script (v2.0)
# Optimized for high-density enterprise environment
# ============================================================

set -e # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Config
DEFAULT_PORT=3000
PORT=${PORT:-$DEFAULT_PORT}
HOST="0.0.0.0"

log() { echo -e "${CYAN}[EduPilot]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 1. Environment Check
log "Validating environment..."
command -v node >/dev/null 2>&1 || error "Node.js is not installed."
command -v npm >/dev/null 2>&1 || error "npm is not installed."

# 2. Port Management
log "Ensuring port $PORT is free..."
PID=$(lsof -ti:$PORT || true)
if [ ! -z "$PID" ]; then
    warn "Killing existing process on port $PORT (PID: $PID)..."
    kill -9 $PID || true
    sleep 1
fi

# 3. Dependencies & Prisma
if [ ! -d "node_modules" ]; then
    log "Installing dependencies (first time)..."
    npm install --silent
fi

log "Synchronizing database schema..."
npx prisma generate
npx prisma db push --skip-generate > /dev/null

# 4. Launch Logic
MODE=${1:-"dev"}

case $MODE in
    "dev")
        log "Starting in DEVELOPMENT mode (Turbopack)..."
        log "URL: http://localhost:$PORT"
        # Force host 0.0.0.0 for accessibility
        exec npx next dev -H $HOST -p $PORT
        ;;
    "prod"|"start")
        log "Building for PRODUCTION..."
        npm run build
        log "Starting PRODUCTION server..."
        exec npx next start -H $HOST -p $PORT
        ;;
    "setup")
        log "Full system setup..."
        npm install
        npx prisma db push
        npx tsx prisma/seed.ts
        log "Setup complete. Run './run.sh dev' to start."
        ;;
    *)
        error "Invalid mode: $MODE. Use [dev|prod|setup]"
        ;;
esac
