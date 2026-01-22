# 🤖 EduPilot AI Suite - n8n Setup

Ce dossier contient la configuration pour lancer le moteur d'IA d'EduPilot basé sur n8n et Ollama.

## 🚀 Démarrage Rapide

1. **Lancer n8n et Postgres**
   ```bash
   cd infrastructure/n8n
   docker-compose up -d
   ```

2. **Accéder à l'interface**
   - Ouvrez [http://localhost:5678](http://localhost:5678)
   - Créez votre compte admin

3. **Importer les Workflows**
   - Dans n8n, cliquez sur "Add Workflow" > "Import from File"
   - Sélectionnez les fichiers dans `infrastructure/n8n/workflows/` :
     - `chat.json` (Chatbot)
     - `analyze.json` (Analyse performance)

4. **Configurer Ollama (Local LLM)**
   - Assurez-vous d'avoir [Ollama](https://ollama.com/) installé sur votre machine hôte.
   - Modifiez les nodes "Ollama" dans n8n pour pointer vers `http://host.docker.internal:11434` si vous êtes sur Docker Desktop, ou l'IP locale.

5. **Lier à EduPilot**
   Ajoutez ces variables dans votre `.env.local` EduPilot :
   ```env
   N8N_HOST="http://localhost:5678"
   # Clé API si vous activez l'auth dans les headers n8n
   N8N_WEBHOOK_KEY="votre_cle_secrete" 
   ```

## 🛠️ Workflows Inclus

| Workflow | Endpoint | Description |
|----------|----------|-------------|
| **Chat** | `/webhook/chat` | Gère les conversations avec le chatbot |
| **Analyze** | `/webhook/analyze-performance` | Analyse les notes et détecte les risques |

## 💡 Notes
- Par défaut, EduPilot utilise un **mock** si n8n n'est pas accessible.
- Pour la production, sécurisez l'accès avec un tunnel ou un reverse proxy.
