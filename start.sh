#!/bin/bash

# Script de lancement EduPilot
# Usage: ./start.sh

set -e

echo "🚀 Démarrage d'EduPilot..."
echo ""

# Couleurs pour l'affichage
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Étape 1: Vérifier si PostgreSQL est installé
print_step "Vérification de PostgreSQL..."
if ! command -v psql &> /dev/null; then
    print_error "PostgreSQL n'est pas installé!"
    echo "Installez-le avec: sudo apt install postgresql postgresql-contrib"
    exit 1
fi
print_success "PostgreSQL est installé"

# Étape 2: Démarrer PostgreSQL
print_step "Démarrage de PostgreSQL..."
if systemctl is-active --quiet postgresql; then
    print_success "PostgreSQL est déjà en cours d'exécution"
else
    echo "PostgreSQL n'est pas démarré. Tentative de démarrage..."
    if sudo systemctl start postgresql; then
        print_success "PostgreSQL démarré avec succès"
    else
        print_error "Impossible de démarrer PostgreSQL"
        print_warning "Essayez manuellement: sudo systemctl start postgresql"
        exit 1
    fi
fi

# Étape 3: Vérifier la connexion à la base de données
print_step "Vérification de la connexion à la base de données..."
sleep 2

# Vérifier si la base de données existe
DB_EXISTS=$(sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='edupilot'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" != "1" ]; then
    print_warning "Base de données 'edupilot' n'existe pas. Création..."
    sudo -u postgres psql -c "CREATE DATABASE edupilot;" 2>/dev/null || true
    print_success "Base de données 'edupilot' créée"
else
    print_success "Base de données 'edupilot' existe"
fi

# Étape 4: Vérifier les migrations Prisma
print_step "Vérification des migrations Prisma..."
if [ ! -d "prisma/migrations" ] || [ -z "$(ls -A prisma/migrations)" ]; then
    print_warning "Aucune migration trouvée. Application des migrations..."
    npx prisma migrate dev --name init
    print_success "Migrations appliquées"
else
    print_success "Migrations déjà présentes"
    # Appliquer les migrations pendantes
    npx prisma migrate deploy 2>/dev/null || npx prisma db push
fi

# Étape 5: Générer le client Prisma
print_step "Génération du client Prisma..."
npx prisma generate
print_success "Client Prisma généré"

# Étape 6: Créer les utilisateurs de test (si nécessaire)
print_step "Vérification des utilisateurs de test..."
if [ -f "scripts/create-test-user.ts" ]; then
    print_warning "Création des utilisateurs de test..."
    npx tsx scripts/create-test-user.ts || print_warning "Les utilisateurs de test existent peut-être déjà"
else
    print_warning "Script de création d'utilisateurs non trouvé"
fi

# Étape 7: Démarrer l'application Next.js
print_step "Démarrage de l'application Next.js..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ EduPilot est prêt!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}🌐 Application:${NC}       http://localhost:3000"
echo -e "${BLUE}📝 Inscription:${NC}       http://localhost:3000/register"
echo -e "${BLUE}🔐 Connexion:${NC}         http://localhost:3000/login"
echo ""
echo -e "${YELLOW}Comptes de test:${NC}"
echo "  Admin:    admin@edupilot.com / Admin123!"
echo "  Student:  student@edupilot.com / Student123!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter l'application"
echo ""

# Démarrer Next.js
npm run dev
