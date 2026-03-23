#!/bin/bash

#####################################################################
# Script d'installation des sauvegardes automatiques via CRON
# Auteur: Système EduPilot
# Date: 22 Décembre 2025
#####################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "Configuration des sauvegardes automatiques"
echo "=========================================="
echo ""

# Obtenir le chemin absolu du script de backup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/postgres-backup.sh"

if [ ! -f "$BACKUP_SCRIPT" ]; then
    echo -e "${RED}[ERREUR]${NC} Script de sauvegarde non trouvé: $BACKUP_SCRIPT"
    exit 1
fi

# Rendre les scripts exécutables
chmod +x "$SCRIPT_DIR/postgres-backup.sh"
chmod +x "$SCRIPT_DIR/postgres-restore.sh"
echo -e "${GREEN}[OK]${NC} Scripts rendus exécutables"

# Créer les répertoires nécessaires
sudo mkdir -p /var/backups/edupilot/postgres
sudo mkdir -p /var/log/edupilot/backups
sudo chown -R $USER:$USER /var/backups/edupilot
sudo chown -R $USER:$USER /var/log/edupilot
echo -e "${GREEN}[OK]${NC} Répertoires créés"

# Proposer les options de fréquence
echo ""
echo "Choisissez la fréquence des sauvegardes:"
echo "1) Toutes les heures (recommandé pour production)"
echo "2) Toutes les 6 heures"
echo "3) Quotidienne (tous les jours à 2h du matin)"
echo "4) Hebdomadaire (tous les dimanches à 2h du matin)"
echo "5) Personnalisé"
echo ""
read -p "Votre choix (1-5): " choice

case $choice in
    1)
        CRON_SCHEDULE="0 * * * *"
        DESCRIPTION="toutes les heures"
        ;;
    2)
        CRON_SCHEDULE="0 */6 * * *"
        DESCRIPTION="toutes les 6 heures"
        ;;
    3)
        CRON_SCHEDULE="0 2 * * *"
        DESCRIPTION="tous les jours à 2h"
        ;;
    4)
        CRON_SCHEDULE="0 2 * * 0"
        DESCRIPTION="tous les dimanches à 2h"
        ;;
    5)
        echo ""
        echo "Format CRON (minute heure jour mois jour_semaine):"
        echo "Exemple: 0 3 * * * = tous les jours à 3h"
        read -p "Entrez votre planning CRON: " CRON_SCHEDULE
        DESCRIPTION="personnalisé: $CRON_SCHEDULE"
        ;;
    *)
        echo -e "${RED}[ERREUR]${NC} Choix invalide"
        exit 1
        ;;
esac

# Créer la tâche CRON
CRON_JOB="$CRON_SCHEDULE $BACKUP_SCRIPT >> /var/log/edupilot/backups/cron.log 2>&1"

# Vérifier si la tâche existe déjà
if crontab -l 2>/dev/null | grep -q "$BACKUP_SCRIPT"; then
    echo -e "${YELLOW}[INFO]${NC} Une tâche CRON existe déjà pour ce script"
    read -p "Voulez-vous la remplacer? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Supprimer l'ancienne tâche
        crontab -l 2>/dev/null | grep -v "$BACKUP_SCRIPT" | crontab -
        echo -e "${GREEN}[OK]${NC} Ancienne tâche supprimée"
    else
        echo "Installation annulée"
        exit 0
    fi
fi

# Ajouter la nouvelle tâche
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo ""
echo -e "${GREEN}[SUCCÈS]${NC} Sauvegardes automatiques configurées!"
echo ""
echo "Détails de la configuration:"
echo "  - Fréquence: $DESCRIPTION"
echo "  - Script: $BACKUP_SCRIPT"
echo "  - Répertoire de sauvegarde: /var/backups/edupilot/postgres"
echo "  - Logs: /var/log/edupilot/backups/"
echo "  - Rétention: 30 jours"
echo ""
echo "Commandes utiles:"
echo "  - Lister les tâches CRON: crontab -l"
echo "  - Voir les logs: tail -f /var/log/edupilot/backups/cron.log"
echo "  - Tester la sauvegarde: $BACKUP_SCRIPT"
echo "  - Restaurer: $SCRIPT_DIR/postgres-restore.sh <fichier_backup>"
echo ""

# Demander si on veut faire un test
read -p "Voulez-vous faire une sauvegarde de test maintenant? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Exécution d'une sauvegarde de test..."
    $BACKUP_SCRIPT
fi

echo ""
echo "=========================================="
echo "Configuration terminée!"
echo "=========================================="

exit 0
