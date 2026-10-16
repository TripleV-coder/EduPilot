# Livrable 6 — API, services et traitements

> Inventaire complet : **annexe A1** (313 routes, 506 gestionnaires ; rôles et permissions bruts ; modèles lus et écrits ; gardes ; transactions, cache, invalidation, notifications, file de tâches, journal, débit, Zod, contexte système, SQL brut, fichiers ; fournisseurs externes ; nombre d'appelants dans l'interface).

## 1. Chiffres clés

| Indicateur | Valeur | Preuve |
|---|---|---|
| Routes / gestionnaires | 313 / 506 | annexe A1 |
| Gestionnaires via `createApiHandler` | 499. Les 7 autres : NextAuth (`auth/[...nextauth]`, ré-export), `setup`, `metrics` (fonctions exportées), service worker (`serwist/[path]`) | annexe A1 |
| Points publics (`requireAuth: false`) | 26 : authentification, webhooks de paiement (signés), vitrine publique, santé, docs, `system/automation` et `system/retention` (secret CRON) | annexe A1 |
| Routes sans URL littérale dans l'interface | 73. Elles sont appelées par des fournisseurs, le cron, des scripts, des tests, ou plus du tout. Exemples **sans aucun appelant trouvé, même en test** : `/api/attendance/alerts`, `/api/config/benin`, `/api/debug/session` (désactivée hors développement), `/api/incidents/notifications`, `/api/integrations/fedapay`, `/api/organizations/members`, `/api/parents/dashboard`, `/api/root/auth`, `/api/root/session`, `/api/settings/configs`, `/api/students/[id]/balances`, `/api/system/clean-logs` | `pages.json` + `grep` sur `scripts/`, `e2e/`, `tests/` |

## 2. Traitements asynchrones et planifiés

| Traitement | Déclenchement | Mécanisme | Idempotence et reprise | Référence |
|---|---|---|---|---|
| Maintenance quotidienne | Cron 06:00 → `run-task.sh automation` → `POST /api/system/automation` (secret) | Réponse 202, exécution après la réponse sous **bail exclusif** (409 si une exécution est déjà en cours) | Bail repris après 1 h si le processus s'est arrêté | `src/app/api/system/automation/route.ts` |
| ↳ Réconciliation des paiements en ligne de plus de 24 h | 1re étape de la maintenance | Interrogation du fournisseur, puis validé / annulé / expiré | Transitions conditionnelles, verrou | `src/lib/finance/online-payments.ts` |
| ↳ Synchronisation des analyses de toutes les écoles | Maintenance | `syncAllStudentsForSchool`, regroupé par école | Mesuré à 236 s par école réaliste | `analytics-sync.ts` |
| ↳ Alertes d'absentéisme, relances d'échéances | Maintenance | Notifications et file de tâches | Marquage avant envoi, retour arrière en cas d'échec | `automation.service.ts`, `reminders.ts` |
| File de tâches (email, SMS) | `enqueueJobs` depuis l'appel, les relances, les SMS | Table `background_jobs` (RLS), prise par `FOR UPDATE SKIP LOCKED`, débit plafonné, coupe-circuit fournisseur, tentatives à délai croissant puis FAILED | Tâche RUNNING reprise après expiration du verrou ; tâches terminées purgées | `src/lib/jobs/queue.ts` |
| Purge de conservation | `POST /api/system/retention` (secret) ; `run-task.sh retention` | Politiques par école | Aperçu `--dry` | `src/lib/security/retention.ts` — **absent du cron livré** |
| Sauvegarde | Cron 02:00 → `scripts/backup/postgres-backup.sh` | `pg_dump` | — | `scripts/cron/edupilot.cron` |
| Webhooks de paiement | Fournisseurs | Signature vérifiée, contexte système, confirmation contrôlée | Idempotents | livrable 3 FINANCE-001 |

## 3. Intégrations externes (repérées dans les routes)

FedaPay (SDK officiel), MTN MoMo (API Collection), Flutterwave, Paystack, n8n (IA, HMAC), fournisseurs LLM (route `ai/*`, débit limité), SMTP (email), passerelle SMS, Redis (TCP ou Upstash).

Pour chacune, la dégradation en cas d'indisponibilité est gérée par des coupe-circuits (`src/lib/resilience/*`) : réponse 503 avec `Retry-After`. Le détail par fournisseur est dans l'annexe A1 (colonne Externe).

## 4. Constats

| ID | Constat | Classe |
|---|---|---|
| API-01 | `PATCH /api/root/users` sans validation des champs ni journal (MS-05) | Anomalie confirmée |
| API-02 | `DELETE /api/schools/[id]` : suppression définitive en cascade, sans journal (DA-03) | Anomalie confirmée |
| API-03 | Pas de journal d'audit sur la création de comptes (`POST /api/users`, `/api/teachers`, `/api/users/invite`) | Constat (drapeau A absent) |
| API-04 | Routes sans appelant (liste §1) : code mort probable ou parcours non branché (ex. `/api/parents/dashboard`, que la mémoire du projet décrit comme utilisé par l'accueil parent : il ne l'est plus) | À confirmer, puis nettoyer |
| API-05 | Flux SSE `/api/notifications/stream` non consommé : une connexion Redis par client ou une requête en base toutes les 5 s | Risque latent (R-CA-06) |
