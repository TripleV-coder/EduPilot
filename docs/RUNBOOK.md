# Runbook — Incidents EduPilot

Procédures opérationnelles pour les incidents les plus courants. Chaque runbook suit le même format : Sévérité, Détection, Diagnostic, Mitigation, Résolution, Post-mortem.

> Convention de sévérité :
> - **P0** : Production HS / paiements ou auth bloqués / fuite de données
> - **P1** : Parcours métier critique HS (notes, présences, communication parent)
> - **P2** : Fonctionnalité dégradée, contournement possible
> - **P3** : Cosmétique ou support utilisateur

---

## R1 — Application HS (5xx massif)

**Sévérité** : P0
**Impact** : Tous les utilisateurs

### Détection
- Better Uptime alerte sur `/api/health` → 503 ou timeout
- Sentry : error rate > 5 % sur 1 minute
- Plaintes utilisateur sur le canal support

### Diagnostic (< 5 min)
1. Vérifier le statut Vercel : https://vercel.com/<owner>/edupilot
2. Vérifier le statut Postgres : dashboard du fournisseur
3. Vérifier le statut Upstash : https://console.upstash.com
4. Vérifier les derniers déploiements : `gh run list --workflow=ci-cd.yml --limit 5`
5. Consulter les logs Vercel des 15 dernières minutes (chercher `ERROR`)

### Mitigation
- **Si déploiement récent (< 30 min)** : rollback immédiat
  ```bash
  vercel rollback  # ou docker compose pull <image-précédente>
  ```
- **Si Postgres KO** : basculer en lecture seule via feature flag `READ_ONLY_MODE=true` (à implémenter en V2)
- **Si Upstash KO** : le rate-limiter et le cache basculent automatiquement en mémoire (single instance). L'app continue mais sans cache distribué.

### Résolution
- Si cause = bug de code : créer hotfix branch, PR, merge accéléré (skip review optionnel pour P0), redéploiement
- Si cause = infra : escalader fournisseur

### Post-mortem
Obligatoire sous 48h, modèle `docs/post-mortems/YYYY-MM-DD-app-down.md`.

---

## R2 — Paiement bloqué / webhook non reçu

**Sévérité** : P0 (impact financier direct)
**Impact** : Parents ne peuvent pas régler les frais

### Détection
- Parent signale paiement effectué mais non visible dans EduPilot
- Sentry : `Webhook signature invalid` répété
- Dashboard Flutterwave / Stripe : transactions `successful` mais EduPilot ne confirme pas

### Diagnostic
1. Identifier la transaction côté provider (référence `tx_ref`)
2. Chercher dans EduPilot :
   ```sql
   SELECT * FROM "Payment" WHERE reference = '<tx_ref>';
   SELECT * FROM "WebhookDelivery" WHERE eventType LIKE 'payment%' AND payload::text LIKE '%<tx_ref>%';
   ```
3. Vérifier la validité de la signature HMAC : le secret Flutterwave a-t-il changé sans MAJ du `.env` ?
4. Vérifier les logs Sentry filtrés par `webhook` ces dernières heures

### Mitigation
- **Réconciliation manuelle** : un admin avec rôle `ACCOUNTANT` peut entrer le paiement via `/dashboard/finance/reconciliation` avec la référence du provider
- **Re-déclencher le webhook** : depuis le dashboard du provider, fonction "Resend webhook"

### Résolution
- Si signature : rotation du secret + MAJ env + redéploiement
- Si endpoint webhook KO : voir R1
- Si logique métier buggée : ticket bug + hotfix

### Post-mortem
Obligatoire. Inclure le nombre de paiements impactés et le délai de réconciliation.

---

## R3 — Compte verrouillé en boucle

**Sévérité** : P2
**Impact** : Un utilisateur ne peut pas se connecter

### Détection
- Ticket support
- Audit log : `ACCOUNT_LOCKED` à répétition

### Diagnostic
1. Récupérer l'`userId` :
   ```sql
   SELECT id, email, "failedLoginAttempts", "lockedUntil" FROM "User" WHERE email = '<email>';
   ```
2. Vérifier dans `AuditLog` :
   ```sql
   SELECT * FROM "AuditLog" WHERE "userId" = '<id>' AND action LIKE 'LOGIN%' ORDER BY "createdAt" DESC LIMIT 20;
   ```
3. Identifier la cause : phishing externe (échecs depuis IPs étrangères), oubli du mot de passe, MFA mal configuré

### Mitigation
- Vérifier l'identité de l'utilisateur (canal hors-bande : appel, manager)
- Déverrouiller :
  ```typescript
  await unlockAccount(userId, adminId);  // src/lib/auth/account-lockout.ts
  ```
  ou via UI : `/dashboard/admin/users/<id>` → bouton "Déverrouiller"

### Résolution
- Réinitialiser le mot de passe via `/api/auth/forgot-password`
- Si attaque externe suspectée : bloquer la plage IP côté Vercel / Cloudflare

### Post-mortem
Non obligatoire sauf si > 10 comptes touchés simultanément (signal d'attaque coordonnée).

---

## R4 — Fuite de données suspectée (Data Breach)

**Sévérité** : P0
**Impact** : Conformité RGPD, réputation, légal

### Détection
- Alerte Sentry sur exfiltration anormale (volumes de requêtes)
- Signalement externe (chercheur, utilisateur, presse)
- Audit log : pattern d'accès massif (`VIEW` répétés sur des entités d'un autre tenant)

### Diagnostic immédiat (< 1h)
1. **Bloquer l'attaquant si identifié** : révoquer ses sessions, désactiver son compte, bloquer son IP
2. Quantifier l'impact :
   ```sql
   SELECT COUNT(DISTINCT "entityId"), array_agg(DISTINCT entity)
   FROM "AuditLog"
   WHERE "userId" = '<suspect>'
   AND "createdAt" > NOW() - INTERVAL '24 hours'
   AND action LIKE 'VIEW%';
   ```
3. Identifier la nature des données accédées (PII, paiements, mineurs)
4. Préserver les preuves : snapshot Postgres immédiat tagué `breach-<date>`

### Mitigation
- Couper l'accès si nécessaire (mode maintenance via env `MAINTENANCE_MODE=true`)
- Forcer la rotation des sessions de tous les utilisateurs impactés
- Faire tourner les secrets potentiellement compromis

### Procédure légale (sous 72h, obligation CNIL)
1. **Notifier la CNIL** via `https://www.cnil.fr/notifications/diffusion/breach.htm`
2. **Notifier le DPO** : `bosco29962355977@gmail.com`
3. **Notifier les utilisateurs impactés** : template email dans `templates/breach-notification.txt`
4. **Documenter** : créer `docs/post-mortems/YYYY-MM-DD-breach.md` avec timeline détaillée

### Post-mortem
Obligatoire, exhaustif, partagé en interne ET en externe (transparence). Plan d'actions correctives sous 30 jours.

---

## R5 — Latence dégradée (p95 > 2s)

**Sévérité** : P1
**Impact** : UX dégradée, taux d'abandon ↑

### Détection
- Sentry traces : p95 > 2s sur 10 min
- Plaintes utilisateurs ("c'est lent")

### Diagnostic
1. Identifier l'endpoint coupable : Sentry → Performance → trier par `p95 latency`
2. Slow queries Postgres :
   ```sql
   SELECT query, mean_exec_time, calls
   FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 10;
   ```
3. Profiling Node.js si CPU élevé : `kill -USR2 <pid>` pour générer un heap snapshot

### Mitigation immédiate
- Activer le cache sur l'endpoint coupable si pas déjà fait (`withCache` dans `src/lib/api/cache-helpers.ts`)
- Augmenter le TTL si données peu volatiles
- Si Postgres saturé : redimensionnement vertical (passer t3.medium → t3.large)

### Résolution
- Ajouter un index sur les colonnes filtrées (toujours via migration Prisma)
- Refactoriser la query (éliminer N+1 avec `include` Prisma)
- Pré-calcul via cron si dashboard
- Code splitting frontend si bundle > 500 ko

### Post-mortem
Obligatoire si > 1h. Inclure le nouveau plan de capacité.

---

## R6 — Email transactionnel non envoyé

**Sévérité** : P2 (P1 si reset password)
**Impact** : Utilisateurs ne reçoivent pas leurs mails

### Détection
- Plainte utilisateur
- Resend dashboard : `bounced` ou `failed` augmente
- Sentry : `Resend API error` répété

### Diagnostic
1. Statut Resend : https://status.resend.com
2. Vérifier la quota : Resend dashboard → Usage
3. Vérifier que le domaine est toujours validé (DKIM/SPF)
4. Logs applicatifs : `grep "email" $LOGS | tail -50`

### Mitigation
- Si quota dépassé : upgrade du plan, ou bascule sur fournisseur de secours (à implémenter)
- Si domaine non validé : re-configurer DNS
- Si Resend HS : passer en mode batch et réessayer plus tard via queue (V2)

### Résolution
Communication aux utilisateurs : "Si vous n'avez pas reçu votre email, contactez le support".

---

## R7 — Migration Prisma échouée en prod

**Sévérité** : P0
**Impact** : Le déploiement est bloqué, app peut être incohérente

### Détection
- Pipeline `deploy-staging` ou `deploy-production` échoue à l'étape `prisma migrate deploy`
- Erreur explicite dans les logs

### Diagnostic
1. Lire l'erreur exacte (souvent : contrainte unique violée, type incompatible, données existantes incompatibles)
2. Vérifier l'état :
   ```bash
   DATABASE_URL=$PROD_URL npx prisma migrate status
   ```
3. Identifier la migration coupable

### Mitigation
**Cas 1 — La migration a été partiellement appliquée** :
- Marquer comme rolled back : `npx prisma migrate resolve --rolled-back <name>`
- Restaurer le state via snapshot si nécessaire

**Cas 2 — Données existantes incompatibles** (ex: NOT NULL ajouté mais colonne contient NULL) :
- Créer une migration de cleanup avant (en deux étapes) :
  1. `UPDATE table SET col = '<default>' WHERE col IS NULL;`
  2. Puis `ALTER TABLE table ALTER COLUMN col SET NOT NULL;`

### Résolution
- Tester systématiquement les migrations sur un dump anonymisé de la prod en staging
- Ne **jamais** mélanger un changement de schema et un changement de code dans la même release sans plan en 2 étapes

### Post-mortem
Obligatoire. Améliorer le process de validation migrations.

---

## R8 — Mode maintenance (planifié ou urgence)

**Sévérité** : géré, pas un incident
**Impact** : Application inaccessible pour les utilisateurs

### Activation
```bash
# Vercel
vercel env add MAINTENANCE_MODE production
# valeur : "true"
vercel --prod
```

Ou via flag DB (V2). Une page statique `app/maintenance.tsx` doit être servie en priorité par le middleware.

### Communication
- Annonce sur l'app **48h avant** pour maintenance planifiée
- Email aux administrateurs d'établissement
- Status page : `https://status.edupilot.bj` (à mettre en place)

### Vérification après
```bash
curl -I https://app.edupilot.bj  # Doit retourner 200, pas 503
curl https://app.edupilot.bj/api/health  # Doit retourner 200 JSON
```

---

## Annexes

### A. Liens utiles
- Statut Vercel : https://vercel-status.com
- Statut Postgres (Neon) : https://neonstatus.com
- Statut Upstash : https://upstash.com/status
- Statut Sentry : https://status.sentry.io
- Statut Stripe : https://status.stripe.com
- Statut Flutterwave : https://status.flutterwave.com

### B. Commandes psql utiles
```sql
-- Top 10 tables par taille
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;

-- Connexions actives par utilisateur
SELECT usename, state, COUNT(*) FROM pg_stat_activity GROUP BY usename, state;

-- Locks en attente
SELECT * FROM pg_locks l JOIN pg_stat_activity a ON l.pid = a.pid WHERE NOT l.granted;
```

### C. Variables de feature flags à connaître
| Flag | Effet |
|------|-------|
| `MAINTENANCE_MODE=true` | Mode maintenance (V2) |
| `READ_ONLY_MODE=true` | Lecture seule globale (V2) |
| `DISABLE_AI=true` | Coupe les appels Gemini |
| `DISABLE_EMAIL=true` | Coupe Resend (utile en test) |
| `DEBUG=true` | Logs verbeux Pino |
