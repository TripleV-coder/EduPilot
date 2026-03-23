#!/bin/bash

# Script de configuration PostgreSQL pour EduPilot
# Usage: ./setup-postgres.sh

echo "🔧 Configuration de PostgreSQL pour EduPilot..."
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

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

# Vérifier que PostgreSQL est en cours d'exécution
if ! systemctl is-active --quiet postgresql; then
    print_step "Démarrage de PostgreSQL..."
    sudo systemctl start postgresql
    sleep 2
fi

print_success "PostgreSQL est en cours d'exécution"

# Option 1: Créer un utilisateur sans mot de passe (pour développement local)
print_step "Configuration de l'authentification PostgreSQL..."
echo ""
echo "Choisissez une option:"
echo "1) Utiliser 'trust' (sans mot de passe - RECOMMANDÉ pour dev local)"
echo "2) Configurer un mot de passe"
read -p "Votre choix (1 ou 2): " choice

if [ "$choice" = "1" ]; then
    print_step "Configuration en mode 'trust' (sans mot de passe)..."

    # Modifier pg_hba.conf pour utiliser trust
    PG_HBA="/etc/postgresql/*/main/pg_hba.conf"

    # Backup du fichier
    sudo cp $PG_HBA ${PG_HBA}.backup

    # Modifier pour utiliser trust
    sudo sed -i 's/local\s*all\s*postgres\s*peer/local   all             postgres                                trust/' $PG_HBA
    sudo sed -i 's/local\s*all\s*all\s*peer/local   all             all                                     trust/' $PG_HBA
    sudo sed -i 's/host\s*all\s*all\s*127.0.0.1\/32\s*scram-sha-256/host    all             all             127.0.0.1\/32            trust/' $PG_HBA

    # Redémarrer PostgreSQL
    sudo systemctl restart postgresql
    sleep 2

    print_success "Mode trust activé"

    # Modifier le .env pour ne pas utiliser de mot de passe
    print_step "Mise à jour du fichier .env..."
    sed -i 's|DATABASE_URL=.*|DATABASE_URL="postgresql://postgres@localhost:5432/edupilot?schema=public"|' .env
    print_success "Fichier .env mis à jour"

else
    # Configurer avec mot de passe
    print_step "Configuration avec mot de passe..."

    # Créer/modifier l'utilisateur postgres avec mot de passe
    sudo -u postgres psql <<EOF
ALTER USER postgres WITH PASSWORD 'postgres';
EOF

    print_success "Mot de passe configuré (postgres/postgres)"

    # Vérifier que le .env utilise le bon format
    if ! grep -q "postgresql://postgres:postgres@localhost" .env; then
        print_step "Mise à jour du fichier .env..."
        sed -i 's|DATABASE_URL=.*|DATABASE_URL="postgresql://postgres:postgres@localhost:5432/edupilot?schema=public"|' .env
        print_success "Fichier .env mis à jour"
    fi
fi

# Créer la base de données
print_step "Création de la base de données edupilot..."
sudo -u postgres psql <<EOF 2>/dev/null || true
CREATE DATABASE edupilot;
GRANT ALL PRIVILEGES ON DATABASE edupilot TO postgres;
EOF

# Si on utilise trust, donner tous les droits
if [ "$choice" = "1" ]; then
    sudo -u postgres psql -d edupilot <<EOF
GRANT ALL ON SCHEMA public TO postgres;
ALTER DATABASE edupilot OWNER TO postgres;
EOF
fi

print_success "Base de données créée"

# Tester la connexion
print_step "Test de connexion..."
if psql -h localhost -U postgres -d edupilot -c "SELECT version();" > /dev/null 2>&1; then
    print_success "Connexion réussie!"
else
    print_error "Impossible de se connecter. Vérifiez la configuration."
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ PostgreSQL est configuré!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Vous pouvez maintenant lancer l'application avec:"
echo -e "${BLUE}./start.sh${NC}"
echo ""
