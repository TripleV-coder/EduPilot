# 🚀 Guide de Déploiement - EduPilot

## Table des matières

- [Prérequis](#prérequis)
- [Déploiement avec Docker](#déploiement-avec-docker)
- [Déploiement avec PM2](#déploiement-avec-pm2)
- [Déploiement Cloud](#déploiement-cloud)
- [Configuration Production](#configuration-production)
- [Migrations de base de données](#migrations-de-base-de-données)
- [Backup et restauration](#backup-et-restauration)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

---

## Prérequis

### Systèmes d'exploitation supportés
- Ubuntu 20.04+ / Debian 11+
- CentOS 8+ / RHEL 8+
- macOS 12+ (développement uniquement)
- Windows 11 avec WSL2 (développement uniquement)

### Logiciels requis
- **Node.js**: 20.x LTS minimum
- **PostgreSQL**: 15+ minimum (16+ recommandé)
- **Redis**: 7+ (Upstash recommandé pour la production)
- **Docker**: 24+ (optionnel mais recommandé)
- **PM2**: dernière version (pour déploiement sans Docker)

### Ressources minimales

**Développement**:
- CPU: 2 cores
- RAM: 4 GB
- Stockage: 10 GB

**Production (petite école <500 élèves)**:
- CPU: 4 cores
- RAM: 8 GB
- Stockage: 50 GB SSD

**Production (grande école >500 élèves)**:
- CPU: 8 cores
- RAM: 16 GB
- Stockage: 200 GB SSD
- Database: Instance séparée recommandée

---

## Déploiement avec Docker

### 1. Préparation

```bash
# Cloner le repository
git clone https://github.com/votre-org/edupilot.git
cd edupilot

# Copier les fichiers d'environnement
cp .env.production.example .env

# Éditer le fichier .env avec vos valeurs
nano .env
```

### 2. Configuration Docker

Le fichier `docker-compose.yml` inclut :
- Application Next.js
- PostgreSQL 16
- Redis (optionnel)
- n8n (optionnel pour l'automatisation)

### 3. Démarrage

```bash
# Build et démarrage
docker-compose up -d

# Vérifier les logs
docker-compose logs -f app

# Vérifier le statut
docker-compose ps
```

### 4. Migrations de base de données

```bash
# Générer le client Prisma
docker-compose exec app npx prisma generate

# Appliquer les migrations
docker-compose exec app npx prisma migrate deploy

# (Optionnel) Seed des données de référence
docker-compose exec app npm run db:seed:reference
```

### 5. Accès à l'application

L'application est accessible sur `http://localhost:3000` ou sur votre domaine configuré.

### 6. Arrêt et redémarrage

```bash
# Arrêter
docker-compose down

# Redémarrer
docker-compose restart app

# Rebuild après des changements
docker-compose up -d --build
```

---

## Déploiement avec PM2

### 1. Installation Node.js et PM2

```bash
# Installer Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Installer PM2 globalement
sudo npm install -g pm2
```

### 2. Préparation de l'application

```bash
# Cloner et installer
git clone https://github.com/votre-org/edupilot.git
cd edupilot

# Installer les dépendances
npm ci --frozen-lockfile

# Configurer l'environnement
cp .env.production.example .env
nano .env

# Générer Prisma
npx prisma generate

# Build de production
npm run build
```

### 3. Configuration PostgreSQL

```bash
# Installer PostgreSQL 16
sudo apt-get install postgresql-16

# Créer la base de données
sudo -u postgres psql
CREATE DATABASE edupilot;
CREATE USER edupilot WITH PASSWORD 'votre-mot-de-passe-fort';
GRANT ALL PRIVILEGES ON DATABASE edupilot TO edupilot;
\q

# Appliquer les migrations
npx prisma migrate deploy
```

### 4. Démarrage avec PM2

```bash
# Démarrer l'application
pm2 start ecosystem.config.js --env production

# Voir les logs
pm2 logs edupilot

# Monitoring
pm2 monit

# Sauvegarder la configuration PM2
pm2 save
pm2 startup
```

### 5. Configuration Nginx (reverse proxy)

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Redirection HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.com;

    # Certificats SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;

    # Configuration SSL moderne
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Proxy vers Next.js
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
    }

    # Cache des assets statiques
    location /_next/static {
        proxy_pass http://localhost:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Activer la configuration
sudo ln -s /etc/nginx/sites-available/edupilot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Obtenir un certificat SSL avec Let's Encrypt
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d votre-domaine.com
```

---

## Déploiement Cloud

### Vercel (Recommandé pour démarrage rapide)

1. **Connecter votre repository GitHub**
2. **Configuration Vercel**:
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Variables d'environnement**:
   Ajouter toutes les variables du fichier `.env.production.example`

4. **Base de données**:
   - Utiliser un service managé: Neon, Supabase, ou AWS RDS
   - Configurer `DATABASE_URL` dans Vercel

### Railway

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Créer un nouveau projet
railway init

# Ajouter PostgreSQL
railway add postgresql

# Déployer
railway up
```

### AWS (Production enterprise)

#### Architecture recommandée:
- **Compute**: ECS/Fargate ou EC2 avec Auto Scaling
- **Database**: RDS PostgreSQL Multi-AZ
- **Cache**: ElastiCache Redis
- **Storage**: S3 pour les fichiers
- **CDN**: CloudFront
- **Load Balancer**: ALB

#### Déploiement avec ECS:

```bash
# Build et push image Docker
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com
docker build -t edupilot .
docker tag edupilot:latest ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/edupilot:latest
docker push ACCOUNT_ID.dkr.ecr.eu-west-1.amazonaws.com/edupilot:latest

# Créer la task definition et le service ECS
# (Utiliser AWS Console ou Terraform)
```

---

## Configuration Production

### Variables d'environnement critiques

```env
# Sécurité (REQUIS)
NEXTAUTH_SECRET="GÉNÉRER_AVEC_openssl_rand_-base64_32"
TOTP_ENCRYPTION_KEY="GÉNÉRER_AVEC_openssl_rand_-hex_32"
CRON_SECRET="GÉNÉRER_AVEC_openssl_rand_-hex_32"

# Base de données (REQUIS)
DATABASE_URL="postgresql://user:pass@host:5432/edupilot?sslmode=require"

# Redis (FORTEMENT RECOMMANDÉ)
UPSTASH_REDIS_REST_URL="https://xxxxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="xxxxx"

# Email (REQUIS pour notifications)
EMAIL_PROVIDER="resend"
EMAIL_API_KEY="re_xxxxx"

# Monitoring (RECOMMANDÉ)
SENTRY_DSN="https://xxxxx@sentry.io/xxxxx"
```

### Sécurité checklist

- [ ] Générer tous les secrets avec des valeurs fortes
- [ ] Activer SSL/TLS pour toutes les connexions
- [ ] Configurer le firewall (fermer tous les ports sauf 80/443)
- [ ] Activer les backups automatiques de la base de données
- [ ] Configurer le monitoring et les alertes
- [ ] Définir une politique de rétention des logs
- [ ] Activer l'authentification à deux facteurs (2FA) pour les admins
- [ ] Configurer le rate limiting avec Redis
- [ ] Vérifier la configuration CSP et CORS

---

## Migrations de base de données

### Appliquer les migrations

```bash
# Production (Docker)
docker-compose exec app npx prisma migrate deploy

# Production (PM2)
npx prisma migrate deploy

# Vérifier le statut
npx prisma migrate status
```

### Créer une nouvelle migration

```bash
# En développement uniquement
npx prisma migrate dev --name nom_de_la_migration
```

### Rollback (en cas de problème)

```bash
# Restaurer depuis un backup
pg_restore -d edupilot backup.dump

# Ou utiliser Prisma pour revenir à une migration précédente
npx prisma migrate resolve --rolled-back MIGRATION_ID
```

---

## Backup et restauration

### Backup automatique (PostgreSQL)

```bash
# Script de backup (à planifier avec cron)
#!/bin/bash
BACKUP_DIR="/backups/edupilot"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U edupilot -h localhost edupilot | gzip > $BACKUP_DIR/edupilot_$DATE.sql.gz

# Garder seulement les 30 derniers jours
find $BACKUP_DIR -name "edupilot_*.sql.gz" -mtime +30 -delete
```

### Restauration

```bash
# Restaurer depuis un backup
gunzip < backup.sql.gz | psql -U edupilot -d edupilot
```

### Backup des fichiers uploadés

```bash
# Si stockage local
tar -czf uploads_backup.tar.gz /app/uploads

# Si S3, utiliser aws s3 sync pour backup incrémental
aws s3 sync s3://edupilot-uploads /backup/uploads --delete
```

---

## Monitoring

### Healthcheck

```bash
# Vérifier la santé de l'application
curl https://votre-domaine.com/api/system/health

# Réponse attendue:
{
  "status": "healthy",
  "timestamp": "2024-03-20T10:30:00Z",
  "version": "1.0.0",
  "database": "connected",
  "redis": "connected"
}
```

### Métriques avec PM2

```bash
# Monitoring en temps réel
pm2 monit

# Statistiques
pm2 show edupilot

# Logs d'erreur
pm2 logs edupilot --err
```

### Sentry (Monitoring d'erreurs)

Configuré automatiquement si `SENTRY_DSN` est défini.

### Alertes

Configurer des alertes pour :
- CPU > 80% pendant 5 minutes
- RAM > 90% pendant 5 minutes
- Disk > 85%
- Database connection failures
- API response time > 2 secondes
- Error rate > 1%

---

## Troubleshooting

### L'application ne démarre pas

```bash
# Vérifier les logs
docker-compose logs app  # Docker
pm2 logs edupilot         # PM2

# Vérifier la configuration
npx prisma validate

# Tester la connexion DB
psql -U edupilot -h localhost -d edupilot
```

### Performance dégradée

```bash
# Vérifier les ressources
docker stats        # Docker
pm2 monit          # PM2

# Analyser les requêtes lentes (PostgreSQL)
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;

# Vérifier Redis
redis-cli ping
redis-cli INFO stats
```

### Base de données corrompue

```bash
# Restaurer depuis le dernier backup
pg_restore -d edupilot -c backup.dump

# Réappliquer les migrations
npx prisma migrate deploy
```

### Problèmes SSL/HTTPS

```bash
# Renouveler le certificat Let's Encrypt
sudo certbot renew

# Vérifier la configuration Nginx
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

---

## Support

Pour toute assistance :
- Documentation: https://docs.edupilot.bj
- Email: devops@edupilot.bj
- Discord: https://discord.gg/edupilot
