# ADR-0009 : Gemini pour les fonctionnalités IA (bulletins, plans d'action)

**Statut** : Accepté
**Date** : 2025-09-20

## Contexte
EduPilot intègre 3 features IA : génération de commentaires de bulletins pour les enseignants, plans d'action personnalisés pour élèves en difficulté, alertes proactives basées sur l'évolution des notes.

Le contexte (élèves au Bénin, niveau économique modeste) impose un coût bas par appel. Le volume estimé V1 : ~50k appels/mois.

## Options évaluées

| LLM | Cost / 1M tokens (input) | Pros | Cons | Score |
|-----|--------------------------|------|------|-------|
| **Gemini 2.5 Flash** | ~0.30 USD | Pas cher, contexte 1M, multimodal | Qualité légèrement inférieure à Claude/GPT sur tâches complexes | **8/10** |
| Claude Haiku | ~0.80 USD | Très bon rapport perf/prix | Plus cher que Gemini Flash | 7/10 |
| GPT-4o-mini | ~0.15 USD | Pas cher | Suivi des instructions parfois imprécis | 7/10 |
| Llama 3 self-hosted | infra-dependent | Pas de coût par appel, données privées | Coût infra GPU ~500 USD/mois min | 5/10 |

## Décision
**Google Gemini** via `@google/generative-ai` SDK pour V1. Configuration centralisée dans `src/lib/ai/`.

## Conséquences positives
- Coût acceptable (~5 USD/mois pour 50k appels Flash)
- Latence très basse en français (datacenters EU)
- Streaming SSE supporté pour la génération longue

## Conséquences négatives
- Dépendance Google : si l'API change ou est dépréciée, refonte requise
- Données scolaires sortent du périmètre RGPD européen : impose une DPA avec Google + opt-in explicite des écoles
- Prompts en français à finetuner : la qualité varie selon la concision du contexte

## Règles
- **Aucune** donnée personnelle d'élève mineur n'est envoyée à Gemini sans consentement de l'établissement (toggle `aiFeaturesEnabled` au niveau école)
- Les prompts sont versionnés dans `src/lib/ai/prompts/` (pas de strings inline)
- Chaque appel logge : `model`, `promptTokens`, `completionTokens`, `costUsd`, `latencyMs` dans `AiUsageLog` (table dédiée)
- Quota par école : 1000 appels / jour (configurable). Au-delà : message d'erreur clair + bouton "demander une augmentation"
- Si Gemini timeout > 10s : fallback "Génération indisponible, réessayer plus tard" (jamais d'erreur silencieuse)
- Toute sortie IA est encadrée par un disclaimer dans l'UI : "Suggestion générée par IA, à valider par l'enseignant"

## Évolution
- Si la qualité Gemini Flash n'est pas suffisante pour les bulletins : tester Gemini Pro (10x plus cher) ou bascule conditionnelle Claude pour la génération de bulletins seulement
- Si volume > 500k appels/mois : envisager self-hosted Llama 3 pour rentabiliser le GPU
