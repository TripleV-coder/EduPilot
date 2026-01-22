# 🚀 Guide de Déploiement - EduPilot

**Version**: 1.0 Production-Ready
**Date**: 31 Décembre 2025

---

## 📋 PRÉ-REQUIS

### Environnement de Production

```yaml
Node.js:        ≥ 18.17.0 (LTS recommandé)
npm/pnpm:       ≥ 8.0.0
PostgreSQL:     ≥ 14.0
Redis:          ≥ 7.0 (optionnel pour cache)
Nginx:          ≥ 1.20 (reverse proxy)
SSL:            Certificat valide (Let's Encrypt)
OS:             Ubuntu 22.04 LTS (recommandé)
RAM:            ≥ 4GB (8GB recommandé)
CPU:            ≥ 2 cores (4 cores recommandé)
Disk:           ≥ 50GB SSD
```

---

## 🔐 VARIABLES D'ENVIRONNEMENT

### Fichier `.env.production`

```bash
# === DATABASE ===
DATABASE_URL="postgresql://user:password@localhost:5432/edupilot_prod"
DIRECT_URL="postgresql://user:password@localhost:5432/edupilot_prod"

# === NEXTAUTH ===
NEXTAUTH_URL="https://edupilot.example.com"
NEXTAUTH_SECRET="[GÉNÉRER_SECRET_64_CHARS]" # openssl rand -base64 32

# === JWT ===
JWT_SECRET="[GÉNÉRER_SECRET_64_CHARS]"

# === APP ===
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://edupilot.example.com"
NEXT_PUBLIC_API_URL="https://edupilot.example.com/api"

# === EMAIL (SMTP) ===
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="noreply@edupilot.com"
EMAIL_SERVER_PASSWORD="[APP_PASSWORD]"
EMAIL_FROM="EduPilot <noreply@edupilot.com>"

# === FILE STORAGE ===
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760" # 10MB

# === S3 (optionnel) ===
# AWS_REGION="eu-west-3"
# AWS_ACCESS_KEY_ID="[YOUR_KEY]"
# AWS_SECRET_ACCESS_KEY="[YOUR_SECRET]"
# AWS_S3_BUCKET="edupilot-uploads"

# === REDIS (optionnel) ===
# REDIS_URL="redis://localhost:6379"

# === MONITORING (optionnel) ===
# SENTRY_DSN="[YOUR_SENTRY_DSN]"
# NEXT_PUBLIC_SENTRY_DSN="[YOUR_SENTRY_DSN]"

# === ANALYTICS (optionnel) ===
# NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"

# === LOGS ===
LOG_LEVEL="info" # debug|info|warn|error
```

### Générer Secrets

```bash
# Générer NEXTAUTH_SECRET
openssl rand -base64 32

# Générer JWT_SECRET
openssl rand -base64 32
```

---

## 📦 INSTALLATION

### 1. Cloner le Repository

```bash
# SSH
git clone git@github.com:votre-org/edupilot.git
cd edupilot

# Ou HTTPS
git clone https://github.com/votre-org/edupilot.git
cd edupilot
```

### 2. Installer les Dépendances

```bash
# Avec npm
npm ci --production

# Ou avec pnpm (recommandé - plus rapide)
pnpm install --production
```

### 3. Configuration Base de Données

```bash
# Créer la base de données
sudo -u postgres psql
CREATE DATABASE edupilot_prod;
CREATE USER edupilot WITH ENCRYPTED PASSWORD 'votre_mot_de_passe';
GRANT ALL PRIVILEGES ON DATABASE edupilot_prod TO edupilot;
\q

# Migrer le schéma
npx prisma migrate deploy

# Générer Prisma Client
npx prisma generate
```

### 4. Seed Initial (Optionnel)

```bash
# Créer un super admin initial
npx prisma db seed

# Ou créer manuellement via script
node scripts/create-super-admin.js
```

### 5. Build Production

```bash
# Build Next.js
npm run build

# Vérifier le build
npm run start # Test local sur port 3000
```

---

## 🔧 CONFIGURATION SERVEUR

### 1. PM2 (Process Manager)

**Installation**:
```bash
npm install -g pm2
```

**Fichier `ecosystem.config.js`**:
```javascript
module.exports = {
  apps: [{
    name: 'edupilot',
    script: 'npm',
    args: 'start',
    instances: 'max', // Utiliser tous les CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_memory_restart: '1G',
    watch: false
  }]
};
```

**Démarrage**:
```bash
# Démarrer l'app
pm2 start ecosystem.config.js

# Sauvegarder la config
pm2 save

# Auto-start au boot
pm2 startup
# Suivre les instructions affichées

# Commandes utiles
pm2 status           # Voir statut
pm2 logs edupilot    # Voir logs
pm2 restart edupilot # Redémarrer
pm2 stop edupilot    # Arrêter
pm2 delete edupilot  # Supprimer
```

---

### 2. Nginx (Reverse Proxy)

**Fichier `/etc/nginx/sites-available/edupilot`**:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name edupilot.example.com;

    return 301 https://$server_name$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name edupilot.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/edupilot.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/edupilot.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Logs
    access_log /var/log/nginx/edupilot-access.log;
    error_log /var/log/nginx/edupilot-error.log;

    # Client Max Body Size (pour uploads)
    client_max_body_size 10M;

    # Proxy to Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Socket.io
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Static files cache
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Uploads directory
    location /uploads {
        alias /var/www/edupilot/uploads;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000";
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
}
```

**Activation**:
```bash
# Créer symlink
sudo ln -s /etc/nginx/sites-available/edupilot /etc/nginx/sites-enabled/

# Tester config
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx
```

---

### 3. SSL avec Let's Encrypt

```bash
# Installer Certbot
sudo apt install certbot python3-certbot-nginx

# Obtenir certificat
sudo certbot --nginx -d edupilot.example.com

# Auto-renewal (déjà configuré)
# Vérifier avec:
sudo certbot renew --dry-run
```

---

### 4. PostgreSQL Optimisation

**Fichier `/etc/postgresql/14/main/postgresql.conf`**:

```conf
# Memory Settings
shared_buffers = 1GB                    # 25% of RAM
effective_cache_size = 3GB              # 75% of RAM
maintenance_work_mem = 256MB
work_mem = 16MB

# Checkpoint Settings
checkpoint_completion_target = 0.9
wal_buffers = 16MB

# Query Planner
random_page_cost = 1.1                  # SSD
effective_io_concurrency = 200

# Connection Settings
max_connections = 200

# Logging
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_min_duration_statement = 1000       # Log slow queries (> 1s)
```

**Redémarrer**:
```bash
sudo systemctl restart postgresql
```

---

## 🔄 PROCESSUS DE DÉPLOIEMENT

### Déploiement Continu (CI/CD)

**GitHub Actions** (`.github/workflows/deploy.yml`):

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/edupilot
            git pull origin main
            npm ci --production
            npx prisma migrate deploy
            npx prisma generate
            npm run build
            pm2 restart edupilot
```

### Déploiement Manuel

```bash
#!/bin/bash
# Script: deploy.sh

echo "🚀 Starting deployment..."

# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm ci --production

# 3. Run migrations
npx prisma migrate deploy

# 4. Generate Prisma Client
npx prisma generate

# 5. Build
npm run build

# 6. Restart app
pm2 restart edupilot

# 7. Check status
pm2 status

echo "✅ Deployment complete!"
```

**Rendre exécutable**:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📊 MONITORING & LOGS

### 1. Logs Application

```bash
# PM2 logs
pm2 logs edupilot --lines 100

# Application logs
tail -f logs/app.log

# Nginx logs
tail -f /var/log/nginx/edupilot-access.log
tail -f /var/log/nginx/edupilot-error.log
```

### 2. Monitoring avec PM2 Plus (optionnel)

```bash
# Connecter à PM2 Plus
pm2 link [SECRET_KEY] [PUBLIC_KEY]

# Dashboard: https://app.pm2.io
```

### 3. PostgreSQL Monitoring

```sql
-- Connexions actives
SELECT * FROM pg_stat_activity WHERE datname = 'edupilot_prod';

-- Taille base de données
SELECT pg_size_pretty(pg_database_size('edupilot_prod'));

-- Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

---

## 🔒 SÉCURITÉ

### 1. Firewall (UFW)

```bash
# Activer UFW
sudo ufw enable

# Autoriser SSH
sudo ufw allow 22/tcp

# Autoriser HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Autoriser PostgreSQL (local only)
sudo ufw allow from 127.0.0.1 to any port 5432

# Vérifier status
sudo ufw status
```

### 2. Fail2Ban

```bash
# Installer
sudo apt install fail2ban

# Configurer
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Activer
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 3. Backups Automatiques

**Script `backup.sh`**:

```bash
#!/bin/bash
# Backup database and uploads

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/edupilot"
DB_NAME="edupilot_prod"
DB_USER="edupilot"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -U $DB_USER $DB_NAME | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz /var/www/edupilot/uploads

# Keep only last 30 days
find $BACKUP_DIR -type f -mtime +30 -delete

echo "✅ Backup completed: $DATE"
```

**Cron job** (`crontab -e`):
```bash
# Backup quotidien à 2h du matin
0 2 * * * /var/www/edupilot/backup.sh >> /var/log/edupilot-backup.log 2>&1
```

---

## 🧪 TESTS PRÉ-PRODUCTION

### Checklist de Vérification

```bash
# 1. Health check
curl https://edupilot.example.com/api/health

# 2. Database connection
npx prisma db pull

# 3. Authentication
# Se connecter via UI

# 4. File upload
# Tester upload fichier via UI

# 5. Real-time (Socket.io)
# Vérifier notifications temps réel

# 6. Email
# Tester envoi email (reset password)

# 7. Performance
# Lighthouse audit
npx lighthouse https://edupilot.example.com --view
```

---

## 🚨 TROUBLESHOOTING

### Problèmes Courants

**1. App ne démarre pas**
```bash
# Vérifier logs PM2
pm2 logs edupilot --err

# Vérifier variables env
pm2 env 0

# Redémarrer
pm2 restart edupilot
```

**2. Erreurs Database**
```bash
# Vérifier connexion
psql -U edupilot -d edupilot_prod -h localhost

# Re-migrer
npx prisma migrate reset --force
npx prisma migrate deploy
```

**3. SSL non fonctionnel**
```bash
# Renouveler certificat
sudo certbot renew --force-renewal

# Vérifier Nginx config
sudo nginx -t
sudo systemctl restart nginx
```

**4. Performance lente**
```bash
# Vérifier RAM/CPU
htop

# Vérifier processes
pm2 monit

# Optimiser database
psql -U edupilot edupilot_prod
VACUUM ANALYZE;
```

---

## 📈 SCALING

### Horizontal Scaling

**Load Balancer Nginx**:
```nginx
upstream edupilot_backend {
    least_conn;
    server 10.0.0.1:3000 weight=1;
    server 10.0.0.2:3000 weight=1;
    server 10.0.0.3:3000 weight=1;
}

server {
    location / {
        proxy_pass http://edupilot_backend;
    }
}
```

### Database Scaling

```yaml
# Read Replicas
DATABASE_URL="postgresql://master:5432/edupilot_prod"
DATABASE_READ_URL="postgresql://replica:5432/edupilot_prod"

# Connection Pooling (PgBouncer)
DATABASE_URL="postgresql://pgbouncer:6432/edupilot_prod"
```

---

## ✅ CHECKLIST DÉPLOIEMENT

```
Pre-deployment:
[ ] Variables d'environnement configurées
[ ] Base de données créée
[ ] Migrations exécutées
[ ] Build production réussi
[ ] Tests passés

Deployment:
[ ] Code déployé sur serveur
[ ] PM2 configuré et lancé
[ ] Nginx configuré
[ ] SSL certificat installé
[ ] Firewall configuré
[ ] Backups automatiques configurés

Post-deployment:
[ ] Health check OK
[ ] Login fonctionnel
[ ] Upload fichiers OK
[ ] Notifications temps réel OK
[ ] Email envoi OK
[ ] Performance acceptable (Lighthouse > 80)
[ ] Monitoring actif
[ ] Logs accessibles

Security:
[ ] Secrets générés et uniques
[ ] HTTPS actif
[ ] Firewall activé
[ ] Fail2Ban configuré
[ ] Backups testés
[ ] RGPD compliant
```

---

## 🎉 CONCLUSION

Votre plateforme **EduPilot** est maintenant **déployée en production** !

**Support**:
- Documentation: `/docs`
- Issues: GitHub Issues
- Email: support@edupilot.com

**Maintenance**:
- Backups quotidiens automatiques
- Monitoring 24/7
- Updates régulières

**Bonne production! 🚀**

