#!/bin/bash

# Script d'arrêt EduPilot
# Usage: ./stop.sh

echo "🛑 Arrêt d'EduPilot..."

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Arrêter les processus Next.js
echo -e "${BLUE}[STEP]${NC} Arrêt de Next.js..."
pkill -f "next dev" 2>/dev/null || echo "Next.js n'était pas en cours d'exécution"

# Optionnel: Arrêter PostgreSQL (décommentez si vous voulez arrêter PostgreSQL)
# echo -e "${BLUE}[STEP]${NC} Arrêt de PostgreSQL..."
# sudo systemctl stop postgresql

echo -e "${GREEN}✅ EduPilot arrêté${NC}"
