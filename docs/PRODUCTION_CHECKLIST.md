# 🚀 Checklist Mise en Production - EduPilot

## ✅ Préparation Avant Déploiement

### 1. Variables d'Environnement Production

```bash
# ⚠️ CRITIQUE : À configurer avant déploiement

# Base de données
DATABASE_URL="postgresql://user:STRONG_PASSWORD@prod-db.example.com:5432/edupilot?schema=public&sslmode=require"

# NextAuth (CRITIQUE)
NEXTAUTH_URL="https://edupilot.votredomaine.com"
NEXTAUTH_SECRET="[GÉNÉRER: openssl rand -base64 32]"
# ⚠️ NE JAMAIS réutiliser le secret de dev en production !

# Application
NEXT_PUBLIC_APP_NAME="EduPilot"
NEXT_PUBLIC_APP_URL="https://edupilot.votredomaine.com"
NODE_ENV="production"

# Sécurité 2FA
TOTP_ENCRYPTION_KEY="[GÉNÉRER: openssl rand -hex 64]"

# Email (OBLIGATOIRE pour reset password)
EMAIL_PROVIDER="resend"  # ou "sendgrid"
EMAIL_API_KEY="re_prod_xxxxxxxxxxxxxxxx"
EMAIL_FROM="noreply@votredomaine.com"

# Redis Cache & Rate Limiting (RECOMMANDÉ pour production)
UPSTASH_REDIS_REST_URL="https://xxx-xxx.upstash.io"
UPSTASH_REDIS_REST_TOKEN="AYxxxx..."
```

---

### 2. Base de Données Production

#### A. Migration Prisma
```bash
# Appliquer les migrations en production
npx prisma migrate deploy

# Vérifier l'état des migrations
npx prisma migrate status
```

#### B. Seeding Initial (Optionnel)
```bash
# Créer données de base (uniquement 1ère fois)
npx tsx scripts/seed-reference-data.ts

# ⚠️ NE PAS utiliser create-test-data.ts en production !
```

#### C. Backup Automatique
```bash
# Configurer cron job pour backups quotidiens
# Éditer : scripts/backup/crontab.example
0 2 * * * /app/scripts/backup/backup.sh

# Tester backup manuel
./scripts/backup/backup.sh

# Tester restore
./scripts/backup/restore.sh backup-2025-03-23.sql
```

---

### 3. Build de Production

```bash
# 1. Nettoyer les fichiers temporaires
yarn clean
rm -rf .next out

# 2. Vérifier TypeScript
yarn type-check

# 3. Lancer les tests
yarn test

# 4. Build optimisé
yarn build

# 5. Vérifier la taille du bundle
# ⚠️ Si > 1MB, optimiser les imports
```

#### Optimisations Build
```javascript
// next.config.js - Vérifier ces options en prod

module.exports = {
  // Compression activée
  compress: true,
  
  // Génération de source maps désactivée en prod (sécurité)
  productionBrowserSourceMaps: false,
  
  // Optimisation images
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400, // 24h
  },
}
```

---

### 4. Sécurité Production

#### A. Secrets Management
```bash
# ✅ BON : Variables d'environnement
export DATABASE_URL="postgresql://..."

# ❌ MAUVAIS : Hardcodé dans le code
const dbUrl = "postgresql://user:pass@..."

# ✅ BON : Utiliser service de secrets (AWS Secrets Manager, etc.)
```

#### B. Rate Limiting
```bash
# Vérifier que Redis Upstash est configuré
# Sinon, le fallback in-memory ne scale pas en multi-instance
echo $UPSTASH_REDIS_REST_URL
```

#### C. Headers de Sécurité
```bash
# Déjà configurés dans /app/src/proxy.ts
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security: max-age=31536000
- Content-Security-Policy: ...
```

#### D. HTTPS Obligatoire
```bash
# S'assurer que NEXTAUTH_URL commence par https://
# Configurer redirect HTTP → HTTPS au niveau reverse proxy
```

---

### 5. Monitoring & Logs

#### A. Configuration Logs
```typescript
// Activer logs structurés en production
// Dans src/lib/logger.ts (si existe)
const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  formatters: {
    level: (label) => ({ level: label }),
  },
})
```

#### B. Services de Monitoring Recommandés
- **Sentry** : Error tracking (déjà intégré ?)
- **Vercel Analytics** : Si déployé sur Vercel
- **Upstash Redis Insights** : Monitoring cache/rate limiting
- **PostgreSQL logs** : Activer slow query log

#### C. Health Check Endpoint
```bash
# Vérifier que l'endpoint existe
curl https://edupilot.votredomaine.com/api/health

# Devrait retourner
{"status":"ok","timestamp":"2025-03-23T..."}
```

---

### 6. Performance Production

#### A. CDN pour Assets Statiques
```javascript
// next.config.js
module.exports = {
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? 'https://cdn.votredomaine.com' 
    : '',
}
```

#### B. Cache Strategy
```typescript
// Vérifier que le cache Redis est actif
// Dans /app/src/lib/cache/redis.ts
- Cache finance/stats : 5 minutes
- Cache utilisateurs : 1 minute
- Cache écoles : 15 minutes
```

#### C. Database Indexing
```sql
-- Vérifier que ces index existent
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_school_id ON users(school_id);
CREATE INDEX idx_students_class_id ON student_profiles(class_id);
CREATE INDEX idx_invoices_school_date ON invoices(school_id, issue_date);
```

---

### 7. Tests Avant Lancement

#### A. Tests Critiques
```bash
# Tester en environnement staging d'abord
# 1. Authentification
curl -X POST https://staging.edupilot.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"test123"}'

# 2. Import étudiants (avec fichier test)
# Via UI : https://staging.edupilot.com/dashboard/import

# 3. Endpoints critiques
curl https://staging.edupilot.com/api/finance/stats
curl https://staging.edupilot.com/api/students?limit=10

# 4. Performance
# Vérifier temps de réponse < 500ms
```

#### B. Load Testing (Optionnel mais recommandé)
```bash
# Installer k6
brew install k6  # ou snap install k6

# Test de charge basique
k6 run - <<EOF
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // 100 users
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
};

export default function () {
  let res = http.get('https://staging.edupilot.com');
  check(res, { 'status was 200': (r) => r.status === 200 });
  sleep(1);
}
EOF
```

---

### 8. Plan de Rollback

#### En cas de problème post-déploiement

```bash
# 1. Rollback code (Vercel/Railway)
vercel rollback

# 2. Rollback DB (si migration problématique)
npx prisma migrate resolve --rolled-back <migration_name>

# 3. Restaurer backup DB
./scripts/backup/restore.sh backup-pre-deploy.sql

# 4. Vérifier services
curl https://edupilot.com/api/health
```

---

## 📋 Checklist Finale (Cocher avant DEPLOY)

### Infrastructure
- [ ] PostgreSQL production configuré et accessible
- [ ] Redis Upstash configuré (ou alternative)
- [ ] DNS configuré (edupilot.votredomaine.com)
- [ ] SSL/TLS certificat installé (Let's Encrypt/Cloudflare)
- [ ] Firewall configuré (port 443 ouvert, 22 restreint)

### Configuration
- [ ] Toutes les variables d'environnement production saisies
- [ ] `NEXTAUTH_SECRET` généré et unique (pas celui de dev)
- [ ] `DATABASE_URL` pointe vers DB production
- [ ] Email provider configuré et testé
- [ ] Rate limiting Redis configuré

### Code
- [ ] `yarn build` réussit sans erreur
- [ ] `yarn test` : 240 tests passent
- [ ] `yarn type-check` : pas d'erreur TypeScript
- [ ] Version git taggée (ex: v1.1.0)

### Base de Données
- [ ] Migrations appliquées (`prisma migrate deploy`)
- [ ] Backup automatique configuré (cron job)
- [ ] Index DB créés pour performance
- [ ] Données de référence (plans, etc.) insérées

### Sécurité
- [ ] Secrets jamais commitées dans git
- [ ] HTTPS obligatoire (pas de HTTP)
- [ ] Headers de sécurité activés
- [ ] Rate limiting testé
- [ ] 2FA disponible pour admins

### Monitoring
- [ ] Logs configurés et persistés
- [ ] Sentry (ou équivalent) configuré
- [ ] Health check endpoint testé
- [ ] Alertes configurées (CPU, RAM, DB)

### Tests
- [ ] Tests E2E sur staging réussis
- [ ] Import CSV testé avec données réelles
- [ ] Authentification testée
- [ ] Endpoints critiques testés
- [ ] Performance vérifiée (< 500ms)

### Documentation
- [ ] README à jour avec URL production
- [ ] Variables d'environnement documentées
- [ ] Procédure de rollback documentée
- [ ] Contacts support définis

### Communication
- [ ] Équipe prévenue de la date de déploiement
- [ ] Users prévenus (maintenance window si nécessaire)
- [ ] Plan de communication incident préparé

---

## 🎯 Après le Déploiement

### Jour 1
- [ ] Monitoring actif (vérifier toutes les heures)
- [ ] Tests smoke post-deploy
- [ ] Surveiller logs d'erreur
- [ ] Tester fonctionnalités critiques en prod

### Semaine 1
- [ ] Analyser métriques performance
- [ ] Collecter feedback utilisateurs
- [ ] Corriger bugs mineurs rapidement
- [ ] Optimiser si bottlenecks détectés

### Mois 1
- [ ] Review complète sécurité
- [ ] Optimisations performance
- [ ] Planifier prochaines features
- [ ] Documentation retour d'expérience

---

## 📞 Contacts d'Urgence Production

```
- Lead Dev: [Nom] - [Email] - [Téléphone]
- DevOps: [Nom] - [Email] - [Téléphone]
- DB Admin: [Nom] - [Email] - [Téléphone]
- Provider Support: [Links]
```

---

## 🔧 Commandes Utiles Production

```bash
# Voir logs en temps réel (si PM2)
pm2 logs edupilot --lines 100

# Redémarrer application
pm2 restart edupilot

# Voir métriques
pm2 monit

# Backup DB manuel
./scripts/backup/backup.sh

# Vérifier état services
systemctl status postgresql
systemctl status nginx  # si utilisé

# Test connectivité DB
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"

# Clear cache Redis (si nécessaire)
redis-cli -u $UPSTASH_REDIS_REST_URL FLUSHALL
```

---

**Document créé** : 23 Mars 2025  
**Version** : 1.0  
**Révision recommandée** : Avant chaque déploiement majeur
