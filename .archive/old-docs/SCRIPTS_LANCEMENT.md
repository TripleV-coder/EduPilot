# 🚀 GUIDE DE LANCEMENT - EDUPILOT

## ✨ Lancement en UNE SEULE COMMANDE

### Linux / macOS
```bash
./run.sh dev
```

### Windows (PowerShell)
```powershell
.\run.ps1 dev
```

---

## 📋 TABLE DES MATIÈRES

1. [Scripts Disponibles](#scripts-disponibles)
2. [Modes de Lancement](#modes-de-lancement)
3. [Scripts NPM](#scripts-npm)
4. [Configuration Socket.IO](#configuration-socketio)
5. [PM2 Production](#pm2-production)
6. [Troubleshooting](#troubleshooting)

---

## 📝 SCRIPTS DISPONIBLES

### Script Unifié (run.sh / run.ps1)

Le script principal lance **Next.js + Socket.IO** automatiquement avec toutes les vérifications nécessaires.

#### Linux / macOS
```bash
# Mode interactif (menu)
./run.sh

# Mode direct
./run.sh dev        # Développement
./run.sh prod       # Production
./run.sh pm2        # Production avec PM2
./run.sh setup      # Installation complète
```

#### Windows
```powershell
# Mode interactif (menu)
.\run.ps1

# Mode direct
.\run.ps1 dev       # Développement
.\run.ps1 prod      # Production
.\run.ps1 pm2       # Production avec PM2
.\run.ps1 setup     # Installation complète
```

---

## 🎯 MODES DE LANCEMENT

### 1. Mode Développement (dev) 🛠️

Lance l'application en mode développement avec **hot-reload**.

```bash
./run.sh dev
# ou
npm run dev
```

**Fonctionnalités:**
- ✅ Next.js avec hot-reload
- ✅ Socket.IO temps réel
- ✅ Affichage des erreurs détaillées
- ✅ Rechargement automatique
- 🌐 Port: 3000

**Utilise:** `server.js` qui lance Next.js et Socket.IO ensemble

---

### 2. Mode Production (prod) 🏭

Lance l'application en mode production optimisée.

```bash
./run.sh prod
# ou
npm run start
```

**Fonctionnalités:**
- ✅ Build optimisé
- ✅ Compression activée
- ✅ Cache activé
- ✅ Performance maximale
- 🌐 Port: 3000

**Étapes:**
1. Build automatique si nécessaire
2. Lancement en mode production

---

### 3. Mode PM2 (pm2) 🔥

Lance l'application avec **PM2** pour la production.

```bash
./run.sh pm2
# ou
npm run start:pm2
```

**Fonctionnalités:**
- ✅ Clustering (tous les CPU)
- ✅ Auto-restart en cas d'erreur
- ✅ Load balancing
- ✅ Monitoring en temps réel
- ✅ Logs centralisés
- ✅ Zero-downtime reload

**Commandes PM2:**
```bash
npm run start:pm2     # Démarrer
npm run stop:pm2      # Arrêter
npm run restart:pm2   # Redémarrer
npm run logs:pm2      # Voir les logs
npm run monitor:pm2   # Monitoring
```

---

### 4. Mode Setup (setup) ⚙️

Installation et configuration complètes.

```bash
./run.sh setup
# ou
npm run setup:full
```

**Actions:**
1. Installation des dépendances
2. Génération Prisma
3. Migration base de données
4. Seed données de référence

---

## 📦 SCRIPTS NPM

### Scripts Principaux

```json
{
  "dev": "node server.js",           // Dev avec Socket.IO
  "start": "NODE_ENV=production node server.js",  // Prod
  "build": "next build",              // Build production
}
```

### Scripts Base de Données

```bash
npm run db:generate          # Générer Prisma Client
npm run db:push              # Pousser le schéma
npm run db:migrate           # Migration dev
npm run db:migrate:deploy    # Migration prod
npm run db:seed              # Seed principal
npm run db:seed:reference    # Seed données référence
npm run db:studio            # Interface Prisma Studio
npm run db:validate          # Valider schéma
npm run db:reset             # Reset complet (⚠️ danger)
```

### Scripts Qualité

```bash
npm run lint                 # Linter
npm run lint:fix             # Fix auto
npm run type-check           # Vérif TypeScript
npm run test                 # Tests
npm run test:watch           # Tests en watch
npm run test:coverage        # Couverture
```

### Scripts PM2

```bash
npm run start:pm2            # Démarrer PM2
npm run stop:pm2             # Arrêter PM2
npm run restart:pm2          # Redémarrer PM2
npm run logs:pm2             # Logs PM2
npm run monitor:pm2          # Monitoring PM2
```

---

## 🔌 CONFIGURATION SOCKET.IO

### Serveur Socket.IO

**Fichier:** `server.js`

Le serveur Socket.IO est intégré directement avec Next.js pour une expérience unifiée.

### Events Disponibles

#### Authentication
```javascript
socket.emit('authenticate', {
  userId: 'user-id',
  role: 'STUDENT'
});
```

#### Notifications
```javascript
// Envoyer à un utilisateur
socket.emit('notification:send', {
  targetUserId: 'user-id',
  notification: { title: 'Test', message: 'Hello' }
});

// Broadcast à un rôle
socket.emit('notification:broadcast', {
  targetRole: 'TEACHER',
  notification: { title: 'Test', message: 'Hello' }
});
```

#### Messages
```javascript
// Envoyer message
socket.emit('message:send', {
  recipientId: 'user-id',
  message: { content: 'Hello!' }
});

// Indicateur frappe
socket.emit('message:typing', { recipientId: 'user-id' });
socket.emit('message:stop-typing', { recipientId: 'user-id' });
```

#### Mises à jour temps réel
```javascript
// Note ajoutée
socket.emit('grade:updated', {
  studentId: 'student-id',
  grade: { subject: 'Math', value: 18 }
});

// Présence mise à jour
socket.emit('attendance:updated', {
  studentId: 'student-id',
  attendance: { status: 'PRESENT' }
});
```

#### Annonces
```javascript
socket.emit('announcement:new', {
  targetAudience: 'ALL', // ou ['TEACHER', 'STUDENT']
  announcement: { title: 'Important', content: 'Test' }
});
```

### Connexion Client

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  path: '/api/socket'
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);

  // S'authentifier
  socket.emit('authenticate', {
    userId: currentUser.id,
    role: currentUser.role
  });
});

// Écouter les notifications
socket.on('notification:received', (notification) => {
  console.log('New notification:', notification);
});
```

---

## 🏭 PM2 PRODUCTION

### Configuration

**Fichier:** `ecosystem.config.js`

```javascript
module.exports = {
  apps: [{
    name: 'edupilot',
    script: './server.js',
    instances: 'max',        // Tous les CPU
    exec_mode: 'cluster',     // Mode cluster
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

### Commandes PM2

```bash
# Démarrer
pm2 start ecosystem.config.js --env production

# Arrêter
pm2 stop edupilot

# Redémarrer
pm2 restart edupilot

# Recharger (zero-downtime)
pm2 reload edupilot

# Supprimer
pm2 delete edupilot

# Monitoring
pm2 monit

# Logs
pm2 logs edupilot

# Logs en temps réel
pm2 logs edupilot --lines 100

# Status
pm2 status

# Infos détaillées
pm2 info edupilot
```

### Démarrage Auto au Boot

```bash
# Générer script startup
pm2 startup

# Sauvegarder config
pm2 save

# Désactiver
pm2 unstartup
```

### Monitoring Web

```bash
# Installer PM2 Plus (optionnel)
pm2 link [secret] [public]

# Monitoring web sur pm2.io
```

---

## 🐳 DOCKER (Optionnel)

### Dockerfile

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["node", "server.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/edupilot
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: edupilot
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Lancement:**
```bash
docker-compose up -d
```

---

## 🔧 VARIABLES D'ENVIRONNEMENT

### Fichier .env

```bash
# Application
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/edupilot

# Auth
NEXTAUTH_SECRET=your-secret-key-here
NEXTAUTH_URL=http://localhost:3000

# Email (optionnel)
SENDGRID_API_KEY=your-sendgrid-key

# Redis (optionnel)
UPSTASH_REDIS_REST_URL=your-redis-url
UPSTASH_REDIS_REST_TOKEN=your-redis-token
```

---

## 🐛 TROUBLESHOOTING

### Port déjà utilisé

**Erreur:** `Port 3000 is already in use`

**Solutions:**
```bash
# Trouver le processus
lsof -ti:3000

# Tuer le processus
kill -9 $(lsof -ti:3000)

# Ou changer le port dans .env
PORT=3001
```

### Erreur de connexion PostgreSQL

**Erreur:** `Can't reach database server`

**Solutions:**
1. Vérifier que PostgreSQL est démarré
   ```bash
   sudo systemctl status postgresql
   # ou
   brew services list
   ```

2. Vérifier DATABASE_URL dans .env

3. Créer la base de données
   ```bash
   createdb edupilot
   ```

### Erreur Prisma

**Erreur:** `Prisma schema not found`

**Solution:**
```bash
npm run db:generate
```

### Module non trouvé

**Erreur:** `Cannot find module 'xxx'`

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Socket.IO ne se connecte pas

**Solutions:**
1. Vérifier le path: `/api/socket`
2. Vérifier CORS dans `server.js`
3. Vérifier les logs serveur

### PM2 n'installe pas

**Solution:**
```bash
npm install -g pm2
# ou
sudo npm install -g pm2
```

---

## 📊 MONITORING

### Logs en Temps Réel

```bash
# PM2
pm2 logs edupilot --lines 100

# Direct
npm run dev # Les logs s'affichent directement
```

### Métriques PM2

```bash
pm2 monit           # Interface interactive
pm2 status          # Status de tous les process
pm2 describe edupilot  # Détails complets
```

### Health Check

```bash
# Vérifier que l'app répond
curl http://localhost:3000

# Avec détails
curl -I http://localhost:3000
```

---

## ⚡ PERFORMANCES

### Mode Cluster (PM2)

Utilise automatiquement tous les cœurs CPU:
```bash
npm run start:pm2
```

### Cache

Next.js cache automatiquement:
- Pages statiques
- API routes
- Images optimisées

### Compression

Activée automatiquement en production.

---

## 🔒 SÉCURITÉ

### En Production

1. ✅ Changer `NEXTAUTH_SECRET`
2. ✅ Utiliser HTTPS
3. ✅ Activer rate limiting
4. ✅ Configurer CORS correctement
5. ✅ Mettre à jour les dépendances

```bash
npm audit
npm audit fix
```

---

## 📚 RESSOURCES

### Documentation
- [Next.js](https://nextjs.org/docs)
- [Socket.IO](https://socket.io/docs)
- [PM2](https://pm2.keymetrics.io/docs)
- [Prisma](https://www.prisma.io/docs)

### Commandes Rapides
```bash
# Premier lancement
./run.sh setup
./run.sh dev

# Production
npm run build
./run.sh pm2

# Monitoring
npm run monitor:pm2
npm run logs:pm2
```

---

## ✅ CHECKLIST DÉPLOIEMENT

- [ ] Variables d'environnement configurées
- [ ] Base de données créée et migrée
- [ ] Build production créé (`npm run build`)
- [ ] PM2 installé globalement
- [ ] Firewall configuré (port 3000)
- [ ] SSL/HTTPS configuré
- [ ] Backups base de données configurés
- [ ] Monitoring activé
- [ ] Logs configurés

---

## 🎉 RÉCAPITULATIF

### Développement
```bash
./run.sh dev
```
✅ Next.js + Socket.IO en une commande!

### Production
```bash
./run.sh pm2
```
✅ Cluster + Auto-restart + Monitoring!

### Installation
```bash
./run.sh setup
```
✅ Tout configuré automatiquement!

---

**L'application EduPilot est maintenant prête à être lancée en UNE SEULE COMMANDE! 🚀**
