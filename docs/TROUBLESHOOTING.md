# Guide de dépannage - EduPilot

## Problème: "This page isn't working" après le login

### Symptômes
- La connexion semble réussir
- Vous êtes redirigé vers `/dashboard`
- Le navigateur affiche "This page isn't working"

### SOLUTION DÉFINITIVE (testée et validée)

Le problème était causé par l'absence des variables d'environnement nécessaires dans `.env.local`.

**Étapes pour corriger définitivement:**

1. **Créer ou compléter le fichier `.env.local`** :
```bash
# Copier le template
cp .env.example .env.local

# Générer un NEXTAUTH_SECRET sécurisé
openssl rand -base64 32
```

2. **Éditer `.env.local`** avec les valeurs correctes :
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/edupilot?schema=public"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<résultat de openssl rand -base64 32>"

# Application
NEXT_PUBLIC_APP_NAME="EduPilot"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

3. **Régénérer Prisma et redémarrer** :
```bash
npx prisma generate
npm run dev
```

4. **Tester le login** :
```bash
./scripts/test-login.sh admin@gmail.com
```

### Causes possibles et solutions

#### 1. Variables d'environnement manquantes (CAUSE PRINCIPALE)
**Solution:** Suivre les étapes ci-dessus pour créer un `.env.local` complet

#### 2. Base de données non accessible
**Solution:**
```bash
# Vérifiez que PostgreSQL est démarré
sudo systemctl status postgresql
# ou
sudo service postgresql status

# Si non démarré:
sudo systemctl start postgresql
# ou
sudo service postgresql start

# Testez la connexion
psql -U postgres -d edupilot
```

#### 3. Cache du navigateur
**Solution:**
```bash
# Ouvrez la console développeur (F12)
# Allez dans l'onglet "Application" > "Storage"
# Cliquez sur "Clear site data"

# Ou en ligne de commande:
# Chrome/Edge: Ctrl+Shift+Delete
# Firefox: Ctrl+Shift+Delete
```

#### 4. Session corrompue
**Solution:**
```bash
# Supprimez les cookies NextAuth
# Dans la console développeur > Application > Cookies
# Supprimez tous les cookies commençant par "next-auth"
```

#### 5. Erreur de compilation côté serveur
**Solution:**
```bash
# Arrêtez le serveur (Ctrl+C)
# Nettoyez le cache Next.js
rm -rf .next

# Redémarrez le serveur
npm run dev
```

#### 6. Port déjà utilisé
**Solution:**
```bash
# Vérifiez quel processus utilise le port 3000
lsof -i :3000
# ou
netstat -tuln | grep 3000

# Tuez le processus
kill -9 <PID>

# Ou utilisez un autre port
PORT=3001 npm run dev
```

### Procédure de diagnostic

#### Étape 1: Vérifier les logs du serveur
```bash
# Les logs s'affichent dans le terminal où vous avez lancé npm run dev
# Recherchez les erreurs (lignes rouges)
```

#### Étape 2: Vérifier la console du navigateur
```bash
# Ouvrez la console (F12) > onglet "Console"
# Recherchez les erreurs JavaScript
# Recherchez les erreurs de réseau dans l'onglet "Network"
```

#### Étape 3: Tester avec curl
```bash
# Exécutez le script de test
./scripts/test-login.sh

# Ou manuellement:
curl -I http://localhost:3000/dashboard
```

#### Étape 4: Vérifier l'authentification
```bash
# Dans la console du navigateur, vérifiez la session:
# Ouvrez http://localhost:3000/api/auth/session
# Vous devriez voir vos informations d'utilisateur si connecté
```

### Solutions de dernier recours

#### Réinitialisation complète
```bash
# 1. Arrêtez le serveur
# 2. Nettoyez tout
rm -rf .next
rm -rf node_modules
npm cache clean --force

# 3. Réinstallez
npm install

# 4. Régénérez Prisma
npx prisma generate

# 5. Redémarrez
npm run dev
```

#### Vérification de la base de données
```bash
# Reconnectez-vous à la base de données
psql -U postgres -d edupilot

# Vérifiez que les tables existent
\dt

# Vérifiez qu'il y a des utilisateurs
SELECT id, email, role FROM "User";
```

### Problèmes connus

#### Le dashboard charge indéfiniment
**Cause:** Le middleware bloque la requête
**Solution:**
- Vérifiez src/middleware.ts
- Assurez-vous que /dashboard est accessible pour les utilisateurs connectés

#### Erreur "NEXTAUTH_URL mismatch"
**Cause:** URL configurée différente de l'URL réelle
**Solution:**
```bash
# Dans .env, assurez-vous que:
NEXTAUTH_URL="http://localhost:3000"
# correspond à l'URL que vous utilisez
```

#### Erreur "JWT token invalid"
**Cause:** NEXTAUTH_SECRET a changé ou est invalide
**Solution:**
```bash
# Générez un nouveau secret
openssl rand -base64 32

# Mettez à jour .env
# Supprimez les cookies du navigateur
# Reconnectez-vous
```

## Support

Si le problème persiste:
1. Vérifiez les logs du serveur pour des erreurs spécifiques
2. Vérifiez la console du navigateur pour des erreurs JavaScript
3. Consultez la documentation Next.js: https://nextjs.org/docs
4. Consultez la documentation NextAuth: https://next-auth.js.org/
