#!/usr/bin/env bash
#
# EduPilot — installation sur un VPS Ubuntu 24.04 neuf (Contabo, OVH…).
#
#   sudo bash deploy/contabo/install.sh app.mon-ecole.bj
#
# Prérequis : le dépôt est copié dans /opt/edupilot (git clone), et le DNS du
# domaine pointe déjà vers l'adresse IP du VPS (sinon Caddy ne peut pas
# obtenir le certificat HTTPS).
#
# Ce que fait le script (rejouable sans risque) :
#   1. mises à jour de sécurité automatiques, pare-feu (SSH, 80, 443), fail2ban ;
#   2. Docker (dépôt officiel) et client PostgreSQL (sauvegardes) ;
#   3. .env de production avec des secrets générés (jamais écrasé s'il existe) ;
#   4. PostgreSQL, rôle applicatif soumis à la RLS, puis application + HTTPS ;
#   5. sauvegarde chiffrée quotidienne et maintenance planifiées (cron).
set -euo pipefail

DOMAIN="${1:-}"
APP_DIR="/opt/edupilot"
COMPOSE=(docker compose -f docker-compose.yml -f deploy/contabo/docker-compose.prod.yml)

die() { echo "[ERREUR] $*" >&2; exit 1; }
step() { echo; echo "==> $*"; }

[ "$(id -u)" -eq 0 ] || die "À lancer avec sudo."
[ -n "$DOMAIN" ] || die "Usage : sudo bash deploy/contabo/install.sh <domaine>   (ex. app.mon-ecole.bj)"
[[ "$DOMAIN" =~ ^[a-z0-9.-]+\.[a-z]{2,}$ ]] || die "Domaine invalide : $DOMAIN"
[ -f "$APP_DIR/docker-compose.yml" ] || die "Dépôt introuvable dans $APP_DIR (git clone … $APP_DIR)."
cd "$APP_DIR"

step "1/5 Système : mises à jour automatiques, pare-feu, fail2ban"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg ufw fail2ban unattended-upgrades postgresql-client openssl
dpkg-reconfigure -f noninteractive unattended-upgrades
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
systemctl enable --now fail2ban >/dev/null

step "2/5 Docker (dépôt officiel)"
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker >/dev/null

step "3/5 Fichier .env de production"
if [ ! -f .env ]; then
  secret() { openssl rand -base64 "$1" | tr -d '/+=\n' | cut -c1-"$2"; }
  (
    umask 077
    cat > .env <<EOF
DOMAIN=${DOMAIN}
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=$(secret 48 48)
POSTGRES_USER=edupilot
POSTGRES_DB=edupilot
POSTGRES_PASSWORD=$(secret 36 32)
APP_DB_PASSWORD=$(secret 36 32)
CRON_SECRET=$(secret 48 48)
WEB_CONCURRENCY=2
EOF
  )
  echo "    .env créé (mode 600). ⚠️ Sauvegardez-le HORS du serveur : sans NEXTAUTH_SECRET,"
  echo "    les secrets chiffrés (2FA, clés de paiement, intégrations) deviennent illisibles."
else
  echo "    .env existant conservé."
fi
set -a; . ./.env; set +a

step "4/5 Base de données, rôle applicatif (RLS), application et HTTPS"
"${COMPOSE[@]}" up -d postgres
for _ in $(seq 1 60); do
  "${COMPOSE[@]}" exec -T postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1 && break
  sleep 2
done
apply_role() {
  "${COMPOSE[@]}" exec -T postgres psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v app_password="$APP_DB_PASSWORD" -v owner="$POSTGRES_USER" -f - < deploy/contabo/app-role.sql
}
apply_role
"${COMPOSE[@]}" up -d --build
echo "    Démarrage (migrations au premier lancement)…"
status="starting"
for _ in $(seq 1 90); do
  status="$(docker inspect -f '{{.State.Health.Status}}' edupilot-app 2>/dev/null || echo starting)"
  [ "$status" = "healthy" ] && break
  sleep 5
done
[ "$status" = "healthy" ] || die "L'application n'est pas saine : ${COMPOSE[*]} logs app"
apply_role   # tables créées par les migrations : droits et historique retiré

step "5/5 Sauvegarde chiffrée et tâches planifiées"
id edupilot >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin edupilot
install -d -m 700 -o edupilot -g edupilot /var/backups/edupilot/postgres
install -d -m 755 -o edupilot -g edupilot /var/log/edupilot
install -d -m 750 -o root -g edupilot /etc/edupilot
if [ ! -f /etc/edupilot/backup.key ]; then
  (umask 077; openssl rand -base64 48 > /etc/edupilot/backup.key)
  echo "    Phrase de chiffrement des sauvegardes : /etc/edupilot/backup.key — à copier HORS du serveur."
fi
chown edupilot:edupilot /etc/edupilot/backup.key && chmod 600 /etc/edupilot/backup.key
(
  umask 027
  cat > /etc/edupilot/cron.env <<EOF
CRON_SECRET=${CRON_SECRET}
APP_URL=https://${DOMAIN}
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:${POSTGRES_HOST_PORT:-5433}/${POSTGRES_DB}
BACKUP_PASSPHRASE_FILE=/etc/edupilot/backup.key
BACKUP_DIR=/var/backups/edupilot/postgres
EOF
)
chown root:edupilot /etc/edupilot/cron.env && chmod 640 /etc/edupilot/cron.env
sed "s#^EDUPILOT_DIR=.*#EDUPILOT_DIR=${APP_DIR}#" scripts/cron/edupilot.cron > /etc/cron.d/edupilot
chmod 644 /etc/cron.d/edupilot
systemctl restart cron

echo
echo "✅ EduPilot est en ligne : https://${DOMAIN}"
echo "   Première connexion : https://${DOMAIN}/setup — jeton d'installation affiché par :"
echo "     cd ${APP_DIR} && ${COMPOSE[*]} logs app | grep -i 'jeton d'\''installation'"
echo "   Ensuite : console root › Intégrations (e-mail, WhatsApp, SMS) — voir docs/DEPLOIEMENT_VPS.md"
