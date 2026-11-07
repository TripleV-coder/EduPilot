# ADR-0012 : IA 100 % locale — aucun modèle de langage externe

**Statut** : Accepté (décision du propriétaire, 2026-11-07)
**Remplace** : [ADR-0009 (Gemini)](0009-ai-gemini.md)

## Contexte

L'assistant passait par une cascade de services externes (Groq, Gemini, OpenAI, Anthropic, puis n8n relié à Ollama), avec repli sur des réponses toutes faites choisies par mots-clés. Constats vérifiés dans le code :

- le modèle externe ne recevait **aucune donnée de l'école** : il répondait de façon générique ;
- sans service configuré, les réponses toutes faites ne contenaient aucun chiffre réel ;
- le « streaming » découpait une réponse déjà complète, toutes les 15 ms, pour imiter une écriture en direct ;
- les routes d'analyse appelaient `localhost:5678` (n8n) même sans n8n, et attendaient jusqu'à 20 s ;
- chaque fournisseur ajoutait des variables d'environnement, une sortie de données et un conteneur (n8n) à déployer.

Le propriétaire ne peut ni héberger Ollama ni dépendre d'un VPS, et veut un `.env` minimal.

## Décision

Toute l'IA est calculée sur le serveur, en TypeScript, sans dépendance ajoutée :

- **Assistant** (`src/lib/ai/assistant/`) : compréhension du français (normalisation, racines, tolérance aux fautes de Damerau-Levenshtein bornée), reconnaissance des élèves, classes, matières et dates **dans le seul périmètre de la personne**, classement pondéré des intentions, reprise du contexte de conversation, demandes de précision en cas d'ambiguïté. Chaque réponse lit les données réelles et réutilise les calculs officiels (gouvernance, prévision calibrée, finance famille, recouvrement).
- **Formulation** (`phrasing.ts`) : tournures variées mais stables pour une même question, registre familial ou professionnel selon le rôle, synthèse rédigée d'un élève, explication des causes (facteurs pondérés du modèle de risque), reformulation et suite de conversation.
- **Analyses, risques, prévisions, orientation, plans d'action, appréciations** : uniquement les gabarits et moteurs locaux déjà en place (`governance-service.ts`, `ai-predictive/`).
- Supprimés : `external-client.ts`, `n8n-client.ts`, `http-client.ts`, `pii.ts`, les routes `/api/ai/chatbot`, `/api/ai/analyze`, `/api/ai/predict-failure` et `/api/ai/local` (aucun appelant dans l'interface), le service n8n de `docker-compose.yml`, `infrastructure/n8n/`, les variables `AI_*`, `GROQ_*`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, `N8N_*`, et les hôtes des fournisseurs d'IA dans la CSP.

## Conséquences positives

- Aucune donnée d'élève ne quitte le serveur ; plus de pseudonymisation à maintenir.
- Réponses chiffrées et exactes, avec liens vers la page où agir.
- Aucune variable, aucune clé, aucun coût par appel ; aucun délai réseau.
- Compréhension mesurée : corpus de régression de 57 questions (toutes comprises) ; 30 formulations nouvelles écrites après le réglage : 29 comprises au premier essai, la 30ᵉ corrigée (faux rapprochement « cette » ↔ « dette ») et ajoutée au corpus.

## Conséquences négatives

- Pas de conversation libre : une question hors des sujets couverts reçoit « je n'ai pas compris » et des exemples.
- Les appréciations et plans d'action restent rédigés par gabarits (déjà le cas sans clé configurée).
- Ajouter un sujet demande d'ajouter une intention (déclencheurs) et une réponse (`skills.ts`), avec leurs tests.

## Pistes ouvertes

- Petit modèle de compréhension embarqué (ONNX, sans génération de texte) si les questions réelles montrent des formulations non couvertes ; à décider sur mesures.
- Journaliser (sans contenu personnel) les questions non comprises pour enrichir les déclencheurs.
