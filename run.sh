#!/bin/bash

################################################################################
# EduPilot - Script de Lancement Unifié
# Lance toute l'application (Next.js + Socket.IO) en une seule commande
################################################################################

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Fonction pour afficher le logo
show_logo() {
    echo -e "${PURPLE}"
    cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   ███████╗██████╗ ██╗   ██╗██████╗ ██╗██╗      ██████╗████████╗
║   ██╔════╝██╔══██╗██║   ██║██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝
║   █████╗  ██║  ██║██║   ██║██████╔╝██║██║     ██║   ██║   ██║
║   ██╔══╝  ██║  ██║██║   ██║██╔═══╝ ██║██║     ██║   ██║   ██║
║   ███████╗██████╔╝╚██████╔╝██║     ██║███████╗╚██████╔╝   ██║
║   ╚══════╝╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝
║                                                            ║
║              L'avenir de l'éducation numérique            ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
}

# Fonction pour vérifier si un port est utilisé
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Fonction pour vérifier Node.js
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js n'est pas installé!${NC}"
        echo -e "${YELLOW}📥 Installez Node.js depuis https://nodejs.org${NC}"
        exit 1
    fi

    NODE_VERSION=$(node -v)
    echo -e "${GREEN}✅ Node.js détecté: ${NODE_VERSION}${NC}"
}

# Fonction pour vérifier npm
check_npm() {
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm n'est pas installé!${NC}"
        exit 1
    fi

    NPM_VERSION=$(npm -v)
    echo -e "${GREEN}✅ npm détecté: v${NPM_VERSION}${NC}"
}

# Fonction pour vérifier PostgreSQL
check_postgres() {
    if ! command -v psql &> /dev/null; then
        echo -e "${YELLOW}⚠️  PostgreSQL CLI non détecté${NC}"
        echo -e "${BLUE}ℹ️  Assurez-vous que PostgreSQL est installé et en cours d'exécution${NC}"
    else
        echo -e "${GREEN}✅ PostgreSQL détecté${NC}"
    fi
}

# Fonction pour vérifier les variables d'environnement
check_env() {
    if [ ! -f .env ]; then
        echo -e "${YELLOW}⚠️  Fichier .env non trouvé${NC}"
        if [ -f .env.example ]; then
            echo -e "${BLUE}📝 Copie de .env.example vers .env...${NC}"
            cp .env.example .env
            echo -e "${GREEN}✅ Fichier .env créé${NC}"
            echo -e "${YELLOW}⚠️  Veuillez configurer vos variables d'environnement dans .env${NC}"
        else
            echo -e "${RED}❌ .env.example non trouvé!${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ Fichier .env trouvé${NC}"
    fi
}

# Fonction pour installer les dépendances
install_dependencies() {
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Installation des dépendances...${NC}"
        npm install
        echo -e "${GREEN}✅ Dépendances installées${NC}"
    else
        echo -e "${GREEN}✅ Dépendances déjà installées${NC}"
    fi
}

# Fonction pour générer Prisma
setup_prisma() {
    echo -e "${BLUE}🔧 Configuration de Prisma...${NC}"
    npx prisma generate
    echo -e "${GREEN}✅ Prisma configuré${NC}"
}

# Fonction pour vérifier le port
check_port_available() {
    local PORT=${PORT:-3000}

    if check_port $PORT; then
        echo -e "${RED}❌ Le port $PORT est déjà utilisé!${NC}"
        echo -e "${YELLOW}💡 Libérez le port ou changez PORT dans .env${NC}"

        # Essayer de trouver le processus
        PID=$(lsof -ti:$PORT)
        if [ ! -z "$PID" ]; then
            echo -e "${CYAN}🔍 Processus utilisant le port: PID $PID${NC}"
            ps -p $PID -o comm=

            read -p "Voulez-vous tuer ce processus? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                kill -9 $PID
                echo -e "${GREEN}✅ Processus terminé${NC}"
            else
                exit 1
            fi
        fi
    else
        echo -e "${GREEN}✅ Port $PORT disponible${NC}"
    fi
}

# Fonction principale de démarrage
start_application() {
    local MODE=$1

    case $MODE in
        dev)
            echo -e "${CYAN}🚀 Démarrage en mode développement...${NC}"
            echo -e "${BLUE}📡 Next.js + Socket.IO sur http://localhost:${PORT:-3000}${NC}"
            npm run dev
            ;;
        prod)
            echo -e "${CYAN}🚀 Démarrage en mode production...${NC}"

            # Always build for production to ensure fresh build
            echo -e "${BLUE}🔨 Build de l'application...${NC}"
            npm run build

            if [ $? -ne 0 ]; then
                echo -e "${RED}❌ Erreur lors du build!${NC}"
                exit 1
            fi

            echo -e "${GREEN}✅ Build termine avec succes${NC}"
            npm run start
            ;;
        pm2)
            echo -e "${CYAN}🚀 Démarrage avec PM2...${NC}"

            # Check if PM2 is installed
            if ! command -v pm2 &> /dev/null; then
                echo -e "${YELLOW}📦 Installation de PM2...${NC}"
                npm install -g pm2
            fi

            # Build first
            if [ ! -d ".next" ]; then
                echo -e "${BLUE}🔨 Build de l'application...${NC}"
                npm run build
            fi

            npm run start:pm2
            echo -e "${GREEN}✅ Application démarrée avec PM2${NC}"
            echo -e "${CYAN}📊 Utilisez 'npm run monitor:pm2' pour surveiller${NC}"
            echo -e "${CYAN}📋 Utilisez 'npm run logs:pm2' pour voir les logs${NC}"
            ;;
        *)
            echo -e "${RED}❌ Mode invalide: $MODE${NC}"
            echo -e "${YELLOW}Modes disponibles: dev, prod, pm2${NC}"
            exit 1
            ;;
    esac
}

# Menu principal
show_menu() {
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo -e "${PURPLE}  Choisissez un mode de démarrage:${NC}"
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo -e "${GREEN}  1) ${NC}Développement (dev)"
    echo -e "${BLUE}  2) ${NC}Production (prod)"
    echo -e "${PURPLE}  3) ${NC}Production avec PM2 (pm2)"
    echo -e "${YELLOW}  4) ${NC}Setup complet (installation)"
    echo -e "${RED}  5) ${NC}Quitter"
    echo -e "${CYAN}════════════════════════════════════════${NC}"
    echo -n "Votre choix: "
}

# Programme principal
main() {
    show_logo

    echo -e "${CYAN}🔍 Vérification de l'environnement...${NC}\n"

    check_node
    check_npm
    check_postgres
    check_env

    echo ""

    # Si argument fourni, utiliser directement
    if [ $# -eq 1 ]; then
        case $1 in
            dev|development)
                install_dependencies
                setup_prisma
                check_port_available
                start_application "dev"
                ;;
            prod|production)
                install_dependencies
                setup_prisma
                check_port_available
                start_application "prod"
                ;;
            pm2)
                install_dependencies
                setup_prisma
                start_application "pm2"
                ;;
            setup)
                install_dependencies
                setup_prisma
                echo -e "${BLUE}🌱 Migration de la base de données...${NC}"
                npm run db:push
                echo -e "${GREEN}✅ Setup complet terminé!${NC}"
                echo -e "${CYAN}💡 Lancez './run.sh dev' pour démarrer${NC}"
                ;;
            *)
                echo -e "${RED}❌ Argument invalide: $1${NC}"
                echo -e "${YELLOW}Usage: ./run.sh [dev|prod|pm2|setup]${NC}"
                exit 1
                ;;
        esac
    else
        # Menu interactif
        show_menu
        read choice

        case $choice in
            1)
                install_dependencies
                setup_prisma
                check_port_available
                start_application "dev"
                ;;
            2)
                install_dependencies
                setup_prisma
                echo -e "${BLUE}🔨 Build de l'application...${NC}"
                npm run build
                if [ $? -ne 0 ]; then
                    echo -e "${RED}❌ Erreur lors du build!${NC}"
                    exit 1
                fi
                check_port_available
                echo -e "${GREEN}✅ Build termine, demarrage...${NC}"
                npm run start
                ;;
            3)
                install_dependencies
                setup_prisma
                start_application "pm2"
                ;;
            4)
                install_dependencies
                setup_prisma
                echo -e "${BLUE}🌱 Migration de la base de données...${NC}"
                npm run db:push
                echo -e "${BLUE}🌱 Seed des données de référence...${NC}"
                npm run db:seed:reference
                echo -e "${GREEN}✅ Setup complet terminé!${NC}"
                echo -e "${CYAN}💡 Relancez ce script pour démarrer l'application${NC}"
                ;;
            5)
                echo -e "${YELLOW}👋 Au revoir!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Choix invalide!${NC}"
                exit 1
                ;;
        esac
    fi
}

# Gestion des signaux
cleanup() {
    echo -e "\n${YELLOW}🛑 Arrêt de l'application...${NC}"
    # Tuer tous les processus enfants
    pkill -P $$ 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Exécution
main "$@"
