# Monitoring & Observabilité — EduPilot

Stack et procédures pour surveiller la santé du système, identifier les régressions, et alerter sur les incidents.

---

## 1. Stack

Tout est interne : aucun service tiers, aucune variable à configurer (2026-11-08).

| Outil | Couche | Donnée capturée |
|-------|--------|-----------------|
| Journal des erreurs (`error_logs`) | Serveur + navigateur | Erreurs 500 d'API, erreurs de rendu, écrans d'erreur du navigateur |
| Alertes aux super-administrateurs | Plateforme | Notification instantanée + e-mail, une fois par incident et par période |
| Web Vitals (`web-vitals`) | Navigateur | LCP, INP, CLS, FCP, TTFB par page (un envoi groupé par page) |
| Logger structuré | Serveur | Journaux JSON contextuels (stdout) |
| `/api/metrics` | Serveur | Métriques Prometheus (jeton dérivé du secret maître) |

---

## 2. Journal des erreurs (remplace Sentry)

### 2.1 Ce qui est capturé
- **Erreurs 500 des routes API** (`createApiHandler`) : Sentry ne les voyait pas.
- **Erreurs de rendu et de route non interceptées** (`onRequestError`, `instrumentation.ts`).
- **Erreurs affichées dans le navigateur** (`global-error.tsx` et écrans `error.tsx`) →
  `POST /api/monitoring/client-error`, même avant la connexion (10/min par IP).

### 2.2 Garanties
- **Sans donnée personnelle** : chemin sans chaîne de requête, identifiants remplacés par `:id`, textes tronqués.
- **Regroupement** par empreinte (source + message sans nombres ni identifiants + chemin).
- **Volume borné** : 60 inscriptions par minute et par processus ; purge après 30 jours (maintenance quotidienne).
- **Alerte** : chaque erreur distincte prévient les super-administrateurs actifs (limités à `ROOT_USER_EMAILS`
  si définie) par notification et e-mail, au plus une fois par 30 min (verrou partagé en base).
- Consultation : **Supervision › Journal des erreurs** (les plus fréquentes sur 7 jours, les plus récentes sur 24 h).

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
| Erreurs | Erreurs serveur et navigateur / 24h | `error_logs` (Supervision) |

Dashboard : `/dashboard/admin/metrics` (SUPER_ADMIN uniquement).

---

## 5. Web Vitals

Le package `web-vitals` capture en temps réel sur le client :
- **LCP** : Largest Contentful Paint (cible < 2.5s)
- **INP** : Interaction to Next Paint (cible < 200ms)
- **CLS** : Cumulative Layout Shift (cible < 0.1)
- **TTFB** : Time To First Byte (cible < 800ms)

Les valeurs d'une page partent en un seul envoi (sendBeacon) vers `/api/analytics/web-vitals`, stockées en base (`PerformanceMetric`) et agrégées par le tableau Performance. Toujours actif, rien à configurer.

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

### 7.2 Alertes du journal des erreurs (intégrées)
| Règle | Canal | Fréquence |
|-------|-------|-----------|
| Nouvelle erreur distincte (empreinte) | Notification + e-mail aux super-administrateurs | 1 fois / 30 min par erreur |
| Seuils de performance dépassés | Notification + e-mail aux super-administrateurs | 1 fois / heure par combinaison |

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
- Visualisation dans Tempo (ou équivalent OpenTelemetry)

---

## 10. Checklist pre-incident

Avant chaque release majeure, vérifier :
- [ ] Supervision › Journal des erreurs : aucune erreur nouvelle non expliquée
- [ ] Alertes Better Uptime actives sur prod
- [ ] Au moins un super-administrateur actif reçoit les alertes (e-mail configuré)
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
