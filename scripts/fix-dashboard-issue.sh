#!/bin/bash

# Script pour résoudre le problème "This page isn't working" après le login
# Ce script nettoie le cache et redémarre le serveur proprement

echo "🔧 Résolution du problème de redirection dashboard"
echo "=================================================="

# Étape 1: Arrêter le serveur
echo ""
echo "1️⃣ Arrêt du serveur..."
pkill -f "node server.js" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
sleep 2
echo "✅ Serveur arrêté"

# Étape 2: Nettoyer le cache Next.js
echo ""
echo "2️⃣ Nettoyage du cache Next.js..."
if [ -d ".next" ]; then
    rm -rf .next
    echo "✅ Cache .next supprimé"
else
    echo "ℹ️  Pas de cache .next trouvé"
fi

# Étape 3: Vérifier les variables d'environnement
echo ""
echo "3️⃣ Vérification des variables d'environnement..."
if [ ! -f ".env" ]; then
    echo "⚠️  Fichier .env manquant!"
    echo "   Copiez .env.example vers .env et configurez-le"
    exit 1
fi

# Vérifier NEXTAUTH_SECRET
if grep -q "generate-a-secure-secret" .env 2>/dev/null; then
    echo "⚠️  NEXTAUTH_SECRET utilise la valeur d'exemple!"
    echo "   Génération d'un nouveau secret..."
    NEW_SECRET=$(openssl rand -base64 32)
    sed -i "s/NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=\"$NEW_SECRET\"/" .env
    echo "✅ Nouveau secret généré"
else
    echo "✅ NEXTAUTH_SECRET configuré"
fi

# Étape 4: Vérifier Prisma
echo ""
echo "4️⃣ Vérification de Prisma..."
if npx prisma validate > /dev/null 2>&1; then
    echo "✅ Schéma Prisma valide"
else
    echo "❌ Erreur dans le schéma Prisma"
    npx prisma validate
    exit 1
fi

# Étape 5: Régénérer le client Prisma
echo ""
echo "5️⃣ Régénération du client Prisma..."
npx prisma generate > /dev/null 2>&1
echo "✅ Client Prisma régénéré"

# Étape 6: Instructions pour le navigateur
echo ""
echo "6️⃣ Actions requises dans le navigateur:"
echo "   📋 Ouvrez la console développeur (F12)"
echo "   📋 Onglet Application > Storage > Clear site data"
echo "   📋 Ou supprimez manuellement les cookies 'next-auth'"
echo ""

# Étape 7: Redémarrer le serveur
echo "=================================================="
echo ""
echo "✅ Nettoyage terminé!"
echo ""
echo "Pour redémarrer le serveur, exécutez:"
echo "  npm run dev"
echo ""
echo "Puis dans votre navigateur:"
echo "  1. Videz le cache et les cookies"
echo "  2. Allez sur http://localhost:3000/login"
echo "  3. Connectez-vous avec vos identifiants"
echo "  4. Vous devriez être redirigé vers /dashboard sans erreur"
echo ""
