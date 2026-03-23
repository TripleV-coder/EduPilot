#!/bin/bash
# EduPilot AI Production Startup Script
# This script starts the application with AI services in production mode

set -e

echo "🚀 Démarrage d'EduPilot AI en production..."
echo "=========================================="

# Check environment
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  Warning: NODE_ENV is not set to 'production'"
fi

# Create necessary directories
mkdir -p logs
mkdir -p .ai-cache
mkdir -p models

# Set environment variables
export NODE_ENV=production
export AI_MODEL_PATH="${AI_MODEL_PATH:-./models}"
export AI_CACHE_DIR="${AI_CACHE_DIR:-./.ai-cache}"

echo "📁 Répertoires configurés:"
echo "   - AI Models: $AI_MODEL_PATH"
echo "   - AI Cache: $AI_CACHE_DIR"
echo "   - Logs: ./logs"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Erreur: Node.js 18+ requis (version actuelle: $(node -v))"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Check database connection
echo "🔗 Vérification de la connexion à la base de données..."
if ! npm run db:validate > /dev/null 2>&1; then
    echo "⚠️  Attention: La base de données pourrait ne pas être accessible"
    echo "   Les fonctionnalités IA seront limitées sans base de données"
fi

# Pre-warm AI models (if available)
if [ -d "$AI_MODEL_PATH" ]; then
    echo "🤖 Préchauffage des modèles IA..."
    # Models will be loaded on first request
fi

# Start the application
echo ""
echo "🌐 Démarrage du serveur EduPilot AI..."
echo "=========================================="

# Use PM2 if available, otherwise node
if command -v pm2 &> /dev/null; then
    echo "📊 Utilisation de PM2 pour la gestion des processus..."
    pm2 start ecosystem.config.js --env production
    pm2 monit
else
    echo "📊 Démarrage avec Node.js direct..."
    node server.js
fi

echo ""
echo "✅ EduPilot AI est maintenant en production!"
echo "📍 Accès: http://localhost:3000"
echo "🔧 API IA: http://localhost:3000/api/ai/v2"
