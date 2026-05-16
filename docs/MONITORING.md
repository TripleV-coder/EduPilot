# Monitoring & Observabilité — EduPilot

Stack et procédures pour surveiller la santé du système, identifier les régressions, et alerter sur les incidents.

---

## 1. Stack

```
┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────────┐
│ EduPilot │───>│ Sentry      │    │ Web Vitals   │    │ Better       │
│ (Next.js)│    │ FE + BE     │    │ Vercel/Edge  │    │ Uptime       │
└────┬─────┘    └─────────────┘    └──────────────┘    └──────────────┘
     │
     ▼
┌──────────┐    ┌─────────────┐
│ pino     │───>│ Vercel Logs │
│ (stdout) │    │  / Datadog  │
└──────────┘    └─────────────┘
```

| Outil | Couche | Donnée capturée |
|-------|--------|-----------------|
| Sentry | Frontend + Backend | Erreurs, traces, releases, sourcemaps |
| Web Vitals (`web-vitals`) | Frontend | LCP, INP, CLS, TTFB par route |
| Pino + logger structuré | Backend | Logs JSON contextuels |
| Better Uptime | Externe | Disponibilité, SSL, statut public |
| GitHub Actions / Vercel | Build | Durées, succès/échecs |

---

## 2. Sentry

### 2.1 Configuration
- DSN : `SENTRY_DSN` (variable d'env), différent par environnement
- `SENTRY_ENVIRONMENT` : `production`, `staging`, `dev`
- `SENTRY_AUTH_TOKEN` (CI only) : pour uploader les sourcemaps
- Sample rate prod : `tracesSampleRate: 0.1` (10 % des requêtes profilées), `errorSampleRate: 1.0`

### 2.2 Conventions
- **Tag** chaque erreur backend avec : `userId`, `tenantId` (`schoolId`), `requestId`, `route`
- **Context** ajouté pour les erreurs de paiement : `provider`, `transactionId`, `amount`
- **Releases** : la SHA git est envoyée à Sentry à chaque déploiement (cf. `ci-cd.yml` étape "Notify Sentry of release")

### 2.3 Filtrer le bruit
Erreurs ignorées dans la config Sentry (`sentry.client.config.ts` et `sentry.server.config.ts`) :
- `ResizeObserver loop limit exceeded` (bruit navigateur)
- `Non-Error promise rejection captured` sans stack
- 4xx volontaires (validation Zod) : capturés comme `breadcrumb`, pas comme erreur

---

## 3. Logs structurés (Pino)

### 3.1 Format
```json
{
  "level": "info",
  "time": "2026-05-16T08:42:11.234Z",
  "app": "edupilot",
  "environment": "production",
  "module": "auth",
  "userId": "u-123",
  "requestId": "req-abc",
  "msg": "User logged in",
  "ip": "1.2.3.4"
}
```

### 3.2 Niveaux
| Level | Quand |
|-------|-------|
| `debug` | Détails de dev (cache hits, query planner). Désactivé en prod. |
| `info` | Événements business : `User created`, `Payment confirmed`, `Webhook received` |
| `warn` | Anomalies non bloquantes : `Out-of-order installment payment`, `MFA disabled by admin` |
| `error` | Erreur catchée : exception, Prisma error, HTTP 5xx |

### 3.3 Ne **jamais** logger
- Mots de passe (en clair OU hashé)
- Tokens JWT, OAuth, MFA secrets
- Email + nom au même endroit (PII séparée)
- Body de paiement complet (juste `provider`, `amount`, `currency`, `reference`)

### 3.4 Recherche en prod
Via le dashboard Vercel Logs (ou Datadog si configuré) :
```
filter: app="edupilot" environment="production" level="error" message:"Webhook"
period: last 1h
```

---

## 4. Métriques métier (KPIs)

À implémenter via une table `MetricsSnapshot` quotidienne (V2) :

| Métrique | Description | Source |
|----------|-------------|--------|
| MAU | Utilisateurs actifs mensuels | `Session` (login dans les 30 derniers jours) |
| Écoles actives | Écoles ayant ≥ 1 enseignant connecté ce mois-ci | `User.schoolId` + `Session` |
| Notes saisies | Total / semaine | `Grade.createdAt` |
| Paiements traités | Volume + montant | `Payment.amount` |
| Taux de connexion parents | % parents s'étant connectés sur 30 jours | `User` role=PARENT + `Session` |
| Engagement enseignants | Médiane des saisies par enseignant / semaine | `Grade.gradedBy` |
| Erreurs critiques | Sentry P0/P1 / 24h | API Sentry |

Dashboard : `/dashboard/admin/metrics` (SUPER_ADMIN uniquement).

---

## 5. Web Vitals

Le package `web-vitals` capture en temps réel sur le client :
- **LCP** : Largest Contentful Paint (cible < 2.5s)
- **INP** : Interaction to Next Paint (cible < 200ms)
- **CLS** : Cumulative Layout Shift (cible < 0.1)
- **TTFB** : Time To First Byte (cible < 800ms)

Les valeurs sont envoyées à Sentry via `Sentry.metrics.distribution()`.

Page cible à monitorer en priorité :
1. `/login` (porte d'entrée)
2. `/dashboard` (page principale après login)
3. `/dashboard/grades` (page la plus utilisée par les enseignants)
4. `/dashboard/finance/payments` (page la plus utilisée par les parents)

---

## 6. Uptime monitoring

### 6.1 Probes
| Endpoint | Fréquence | Région | Threshold alerte |
|----------|-----------|--------|------------------|
| `https://app.edupilot.bj/api/health` | 60s | Paris + Lagos | 3 échecs consécutifs |
| `https://app.edupilot.bj` (page d'accueil) | 5min | Paris | 3 échecs consécutifs |
| Certif SSL expire dans < 30 jours | 24h | — | alerte unique |
| DNS resolves | 60s | global | 2 échecs |

### 6.2 Status page publique
À créer : `https://status.edupilot.bj` (via Better Uptime ou Statuspage.io). Public, accessible sans login.

---

## 7. Alerting

### 7.1 Routage
| Sévérité | Canal | Délai |
|----------|-------|-------|
| P0 | SMS + appel téléphonique au oncall | Immédiat |
| P1 | Slack #alerts + email oncall | < 5 min |
| P2 | Slack #alerts | < 30 min |
| P3 | Slack #monitoring | Non urgent |

### 7.2 Règles d'alerte Sentry
| Règle | Trigger | Sévérité |
|-------|---------|----------|
| Nouvelle issue marquée `level=fatal` | 1 occurrence | P0 |
| Issue avec > 100 occurrences / 1h | volume | P1 |
| Régression d'une issue résolue | resurrection | P1 |
| Erreur sur route `/api/auth/*` | toute | P1 |
| Erreur sur route `/api/payments/*` | toute | P0 |

### 7.3 Règles d'alerte Uptime
| Règle | Sévérité |
|-------|----------|
| `/api/health` KO 3× consécutifs | P0 |
| Latence p95 > 3s sur 10 min | P1 |
| SSL expire < 30 jours | P2 |
| SSL expire < 7 jours | P0 |

---

## 8. Dashboards à créer

### 8.1 Dashboard SRE (Grafana / Vercel Analytics)
- Disponibilité 24h / 7j / 30j
- Latence p50/p95/p99 par endpoint
- Error rate par endpoint
- Top 10 endpoints lents
- Top 10 erreurs en volume

### 8.2 Dashboard Produit (Posthog ou interne)
- Funnel inscription (visit → register → first login → first action)
- Taux d'adoption par feature
- Heatmap des pages les plus consultées

### 8.3 Dashboard Finance (interne)
- Volume de paiements traités / jour
- Distribution par méthode (Mobile Money / CB / virement)
- Taux de réconciliation
- Webhooks reçus vs paiements créés

---

## 9. Tracing distribué

À implémenter en V2 via OpenTelemetry :
- Trace ID propagé via `X-Request-Id` (déjà en place côté API)
- Trace inclut : route Next.js → service → query Prisma → cache hit/miss
- Visualisation dans Sentry Performance ou Tempo

---

## 10. Checklist pre-incident

Avant chaque release majeure, vérifier :
- [ ] Sentry release créée et sourcemaps uploadées
- [ ] Alertes Better Uptime actives sur prod
- [ ] DSN Sentry présent dans les env staging + prod
- [ ] Pas de nouveau secret manquant dans `.env.production`
- [ ] Disque Postgres < 70 % d'occupation
- [ ] Sauvegarde DB datée < 24h disponible
- [ ] Runbook mis à jour si nouveau type d'erreur possible

---

## 11. Checklist post-mortem

Pour tout incident P0 ou P1, sous 48h :
1. Créer `docs/post-mortems/YYYY-MM-DD-<slug>.md`
2. Inclure timeline minute par minute (qui, quoi, quand)
3. Identifier la **root cause** (pas le symptôme — utiliser les 5 pourquoi)
4. Lister les actions correctives avec deadline
5. Partager dans le canal #post-mortems
6. Mettre à jour ce document (`MONITORING.md`) si l'incident révèle un trou de couverture
