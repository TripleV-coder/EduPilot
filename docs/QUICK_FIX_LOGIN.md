# Correction rapide: Problème de redirection après login

## Symptôme
Après vous être connecté, vous êtes redirigé vers `/dashboard` mais la page affiche "This page isn't working".

## Solution rapide (5 minutes)

### Option 1: Script automatique

```bash
# Exécutez le script de correction
./scripts/fix-dashboard-issue.sh

# Puis redémarrez le serveur
npm run dev
```

### Option 2: Manuel

#### A. Nettoyez le serveur
```bash
# 1. Arrêtez le serveur (Ctrl+C dans le terminal)

# 2. Nettoyez le cache
rm -rf .next

# 3. Redémarrez
npm run dev
```

#### B. Nettoyez le navigateur
1. Ouvrez la console développeur (F12)
2. Allez dans **Application** > **Storage**
3. Cliquez sur **Clear site data**
4. Fermez et rouvrez le navigateur

#### C. Testez à nouveau
1. Allez sur http://localhost:3000/login
2. Connectez-vous
3. Vous devriez voir le dashboard correctement

## Si le problème persiste

### 1. Vérifiez les logs du serveur
Regardez le terminal où le serveur tourne. Y a-t-il des erreurs en rouge?

### 2. Vérifiez la console du navigateur
Ouvrez la console (F12) > onglet "Console". Y a-t-il des erreurs?

### 3. Vérifiez votre session
Visitez http://localhost:3000/api/auth/session
- Si vous voyez vos informations: la session est valide
- Si vous voyez `{}`: la session est invalide, reconnectez-vous

### 4. Vérifiez la base de données
```bash
# Testez la connexion à PostgreSQL
psql -U postgres -d edupilot -c "SELECT COUNT(*) FROM \"User\";"
```

## Causes fréquentes

### ❌ Cache du navigateur
Le navigateur garde l'ancienne version en cache.
**Solution:** Videz le cache (Ctrl+Shift+Delete)

### ❌ Session corrompue
Les cookies de session sont invalides.
**Solution:** Supprimez les cookies et reconnectez-vous

### ❌ Cache Next.js
Le serveur utilise une ancienne version compilée.
**Solution:** Supprimez `.next` et redémarrez

### ❌ NEXTAUTH_SECRET invalide
Le secret d'authentification est manquant ou invalide.
**Solution:**
```bash
# Générez un nouveau secret
openssl rand -base64 32

# Copiez-le dans .env comme NEXTAUTH_SECRET
```

## Vérification finale

Une fois tout corrigé, exécutez le test:
```bash
./scripts/test-login.sh
```

Tous les tests devraient passer ✅

## Besoin d'aide?

Consultez le guide complet: [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
