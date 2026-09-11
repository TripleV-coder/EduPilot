# Plan de consolidation pré-pilote — EduPilot

> **Objectif** : passer de **8,3/10** à **≥ 9/10** sur toutes les dimensions de `QUALITY_GATE_9_10.md`,
> **sans ajouter de nouvelle fonctionnalité**, puis lancer un pilote école.
>
> **Date de rédaction** : 28 août 2026  
> **Version cible** : `1.2.x` (tag après validation staging)  
> **Durée estimée** : **12 à 15 jours ouvrés** (1 développeur à temps plein)

---

## Règles du plan

1. **Zéro nouvelle feature** — uniquement fiabiliser, tester, finaliser l’existant.
2. **Hors scope** : GPS transport, apps mobiles natives, nouveaux modules métier.
3. Chaque lot se termine par des **critères de sortie mesurables** (commandes ci-dessous).
4. Mettre à jour `TECH_DEBT.md` et `CHANGELOG.md` à chaque lot clos.
5. Une PR par lot (ou sous-lot) — pas de mega-commit.

### Commandes de référence

```bash
npm run lint
npm run type-check
npm run test
npm run test:coverage
npm run test:e2e
npm run build
```

---

## Vue d’ensemble

```
Semaine 1                          Semaine 2                          Semaine 3
├─ Lot 0  Gel & baseline (0,5j)    ├─ Lot 4  Intégrations (2j)        ├─ Lot 7  Prod (1,5j)
├─ Lot 1  Tests API cœur (3j)       ├─ Lot 5  Perf + A11y (2j)        └─ Lot 8  Pilote (1j)
├─ Lot 2  RLS (2j)                 ├─ Lot 6  E2E + docs (1,5j)
└─ Lot 3  UX existant (1,5j)       └─ Buffer / reprises (0,5j)
```

| Lot | Intitulé | Durée | Priorité | Bloque le pilote ? |
|-----|----------|-------|----------|-------------------|
| 0 | Gel fonctionnel & baseline | 0,5 j | P0 | Oui |
| 1 | Tests API — cœur métier | 3 j | P0 | Oui |
| 2 | RLS Postgres généralisé | 2 j | P0 | Oui |
| 3 | UX modules existants | 1,5 j | P1 | Non |
| 4 | Intégrations (SMS / WhatsApp / MoMo) | 2 j | P1 | Non |
| 5 | Performance & accessibilité | 2 j | P1 | Non |
| 6 | E2E bout-en-bout + documentation | 1,5 j | P0 | Oui |
| 7 | Staging, smoke test, release | 1,5 j | P0 | Oui |
| 8 | Lancement pilote école | 1 j | — | — |

---

## Lot 0 — Gel fonctionnel & baseline *(0,5 jour)*

### Objectif
Figurer le périmètre et mesurer l’état de départ pour ne pas dériver.

### Actions
- [x] Créer branche `release/1.2-consolidation`
- [ ] Lister les modules **gelés** (aucun nouveau endpoint, aucune nouvelle page)
- [ ] Exécuter baseline et noter les chiffres dans ce fichier :

| Indicateur | Valeur baseline (28/08/2026) | Cible fin plan |
|------------|------------------------------|----------------|
| Tests Vitest | 2 666 → **2 703** | ≥ 2 900 |
| Couverture globale (lignes) | 63 % | ≥ 65 % |
| Couverture API (`src/app/api/**`) | **72 / 60 / 73 %** (seuil **40/30/40** ✅) | **40/30/40** |
| Routes `createApiHandler` | 281/285 | 281/285 (inchangé) |
| Routes `withTenantRls` | 2 | ≥ 15 routes critiques |
| Specs E2E vertes | à mesurer | 11/11 |
| Lighthouse perf (landing) | à mesurer | ≥ 0,90 |
| Lighthouse a11y (landing) | à mesurer | ≥ 0,90 |

### Done quand
- [ ] Baseline documentée
- [ ] Équipe alignée : **pas de feature** jusqu’à fin Lot 7

---

## Lot 1 — Tests API cœur métier *(3 jours)* — TD-005 / TD-006

### Objectif
Couvrir les routes à fort risque métier et financier — aujourd’hui sous-testées.

### Périmètre prioritaire (ordre strict)

#### Jour 1 — Notes & bulletins
| Route / module | Fichier test cible | Cas à couvrir |
|----------------|-------------------|---------------|
| `GET/POST /api/grades` | `tests/api/grades-route.test.ts` | RBAC, tenant, filtres classe/matière |
| `GET/PATCH/DELETE /api/grades/[id]` | idem ou fichier dédié | 404 cross-tenant, validation Zod |
| `POST /api/grades/batch` | `tests/api/grades-batch.test.ts` | lot, erreurs partielles |
| `GET/POST /api/bulletins` | `tests/api/bulletins.test.ts` | génération, permissions |
| `GET/POST /api/grades/report-cards` | `tests/api/report-cards.test.ts` | PDF metadata, signatures |
| `GET /api/grades/statistics` | `tests/api/grades-statistics.test.ts` | agrégations par classe |

#### Jour 2 — Paiements & finance
| Route / module | Fichier test cible | Cas à couvrir |
|----------------|-------------------|---------------|
| `GET/POST /api/payments` | enrichir `tests/api/payments.test.ts` | liste, création, filtres |
| `GET /api/payments/[id]` | idem | IDOR parent (déjà corrigé — verrouiller par test) |
| `POST /api/payments/initiate` | `tests/api/payments-initiate.test.ts` | FedaPay mock |
| Webhooks FedaPay / MoMo | `tests/api/fedapay-webhook.test.ts` + momo | HMAC, statuts PENDING→VERIFIED |
| `GET/POST /api/payment-plans` | enrichir existant | échéanciers, installments |
| `GET /api/finance/dashboard` | `tests/api/finance-dashboard.test.ts` | KPIs, scope école |

#### Jour 3 — Élèves & classes
| Route / module | Fichier test cible | Cas à couvrir |
|----------------|-------------------|---------------|
| `GET/POST /api/students` | `tests/api/students-route.test.ts` | CRUD, pagination, schoolId |
| `GET/PATCH /api/students/[id]` | idem | profil, cross-tenant 404 |
| `POST /api/students/bulk-import` | `tests/api/students-bulk-import.test.ts` | 500 lignes max, doublons |
| `GET/POST /api/classes` | `tests/api/classes-route.test.ts` | création, promotion |
| `GET /api/students/[id]/profile-360` | `tests/api/students-profile-360.test.ts` | agrégat notes/absences |

### Seuils à atteindre
Mettre à jour `vitest.config.ts` :

```ts
'src/app/api/**': { statements: 40, branches: 30, functions: 40 },
```

### Done quand
- [x] `npm run test:coverage` vert avec nouveaux seuils API (40/30/40 — 28/08/2026)
- [ ] +150 tests minimum ajoutés sur le lot (+37 à ce jour)
- [x] Aucune route P0 du périmètre sans au moins 1 test comportemental
- [ ] `TECH_DEBT.md` TD-005 mis à jour

---

## Lot 2 — RLS Postgres généralisé *(2 jours)*

### Objectif
Défense en profondeur : l’isolation tenant ne repose plus uniquement sur le code applicatif.

### État actuel
- Migration RLS sur `student_profiles`, `grades`, `payments`
- `withTenantRls` actif sur : `accounting/entries`, `academic-years` seulement

### Jour 1 — Étendre les politiques RLS
- [ ] Vérifier / compléter migration existante `20260804083000_enable_rls_on_tenant_critical_tables`
- [ ] Ajouter RLS si manquant : `attendance`, `homework`, `medical_records`, `messages`
- [ ] Documenter dans `docs/adr/0008-multi-tenancy.md` le périmètre V2

### Jour 2 — Brancher `withTenantRls` sur routes critiques
Routes **obligatoires** (minimum 15 appels) :

| Route | Raison |
|-------|--------|
| `students`, `students/[id]` | Données élèves |
| `grades`, `grades/[id]`, `grades/batch` | Notes |
| `payments`, `payments/[id]` | Finance |
| `attendance`, `attendance/bulk` | Assiduité |
| `medical-records/*` | Données sensibles |
| `parents/dashboard` | Agrégat famille |
| `analytics/students` | BI élève |

### Tests
- [ ] `tests/lib/tenant-rls.test.ts` — étendre
- [ ] `tests/api/tenant-rls-isolation.test.ts` — nouveau : requête sans `set_config` → 0 ligne / 403

### Done quand
- [ ] ≥ 15 routes utilisent `withTenantRls`
- [ ] Test d’isolation RLS vert
- [ ] `docs/SECURITY.md` à jour

---

## Lot 3 — UX des modules existants *(1,5 jour)*

### Objectif
Améliorer l’usage réel sans ajouter de fonctionnalité.

### Parcours à polir

| Parcours | Fichiers | Action |
|----------|----------|--------|
| **Onboarding école** | `onboarding/page.tsx`, `auth/first-login` | Vérifier blocages, messages d’erreur clairs |
| **Portail parents** | `parents/dashboard`, notifications | États vide/erreur/chargement cohérents |
| **Saisie présence** | `attendance/page.tsx`, `attendance/bulk` | Feedback succès, retry offline |
| **Alertes assiduité** | `attendance/alerts`, `alerts/risks` | Confirmer déclenchement si données saisies |
| **Finance impayés** | `finance/page.tsx`, `risks/debts` | Liens drill-down vers élève/paiement |
| **Import élèves** | `import/page.tsx`, `students/bulk-import` | Rapport d’erreurs ligne par ligne lisible |
| **Mode offline** | `offline/page.tsx`, `sw.ts` | Tester consultation + message si action impossible |

### Done quand
- [ ] Chaque parcours gère : loading, empty, error, success (règle Ultra Dev Forge)
- [ ] Aucun bouton actif qui mène à une 404 ou un écran vide sans explication
- [ ] Checklist manuelle 30 min validée (directeur + parent + enseignant)

---

## Lot 4 — Finaliser les intégrations existantes *(2 jours)*

### Objectif
Compléter ce qui est **déjà codé** mais dépend de configuration externe.

> Pas de nouvelle intégration — seulement rendre l’existant fiable et honnête.

### SMS *(0,5 j)*
- [ ] `notifications/sms` : si provider absent → bannière config + désactivation envoi
- [ ] Si provider présent (env) : test d’envoi mocké + log structuré
- [ ] Tests : `tests/api/notifications-sms.test.ts`

### WhatsApp *(0,5 j)*
- [ ] `integrations/whatsapp` : documenter variables requises dans UI
- [ ] Webhook entrant : handler stub documenté + validation verify token
- [ ] Métriques : rester `null` si non branché (pas de fake data)
- [ ] Tests : `tests/api/integrations-whatsapp.test.ts`

### MoMo *(0,5 j)*
- [ ] `payments/initiate` : chemin MoMo si `MOMO_*` configuré
- [ ] Wallet : boutons désactivés avec tooltip si non configuré
- [ ] Tests webhook existants : compléter cas edge (duplicate, wrong signature)

### IA *(0,5 j)*
- [ ] `ai/v2/governance` : vérifier opt-in école + rate limit
- [ ] Pages `ai-assistant`, `risks/*` : message si provider IA absent
- [ ] Tests gouvernance : pas d’appel LLM sans consentement

### Done quand
- [ ] Chaque intégration affiche un état **configuré / non configuré** explicite
- [ ] Tests API pour les 4 intégrations
- [ ] `.env.example` aligné avec `docs/PRODUCTION_CHECKLIST.md`

---

## Lot 5 — Performance & accessibilité *(2 jours)*

### Objectif
Atteindre les seuils `QUALITY_GATE_9_10.md` : Lighthouse perf & a11y ≥ 0,90.

### Jour 1 — Performance
Pages cibles :
- `/` (landing)
- `/login`
- `/ecoles`
- `/dashboard` (après auth seed)

Actions :
- [ ] Vérifier lazy-load sections landing (déjà en place — mesurer)
- [ ] Auditer bundle dashboard : imports lourds en `dynamic()`
- [ ] Valider `WebVitalsReporter` + endpoint `/api/analytics/web-vitals`
- [ ] Lancer `lhci autorun` localement ou via CI

Seuils `.lighthouserc.js` (déjà en place) :
```js
"categories:performance": ["error", { minScore: 0.9 }],
"categories:accessibility": ["error", { minScore: 0.9 }],
```

### Jour 2 — Accessibilité
- [ ] Exécuter `e2e/a11y.spec.ts` — corriger violations
- [ ] Parcours parents : contraste, labels formulaires, navigation clavier
- [ ] Parcours paiement : focus trap modales, annonces aria-live
- [ ] Cookie banner : déjà corrigé — revérifier

### Done quand
- [ ] Lighthouse ≥ 0,90 perf + a11y sur les 4 URLs publiques
- [ ] `e2e/a11y.spec.ts` vert
- [ ] Aucune régression perf introduite (comparer baseline Lot 0)

---

## Lot 6 — E2E bout-en-bout & documentation *(1,5 jour)*

### Objectif
Valider les parcours utilisateur complets et synchroniser la doc.

### Specs E2E à exécuter (11 fichiers)

| Spec | Parcours |
|------|----------|
| `auth-flow.spec.ts` | Login, MFA, first-login |
| `finance-flow.spec.ts` | Création frais → paiement |
| `grades-flow.spec.ts` | Saisie note → bulletin |
| `attendance-flow.spec.ts` | Pointage → alerte |
| `parent-flow.spec.ts` | Portail parent, lien enfant |
| `security-tenant.spec.ts` | Isolation cross-école |
| `security-rbac.spec.ts` | Permissions par rôle |
| `security-anonymous.spec.ts` | Routes protégées |
| `dashboard.spec.ts` | Navigation principale |
| `public-routes.spec.ts` | Landing, écoles |
| `a11y.spec.ts` | Audit accessibilité |

### Documentation à mettre à jour
- [ ] `TECH_DEBT.md` — fermer TD-005/006 ou reporter avec date
- [ ] `CHANGELOG.md` — section `1.2.x` consolidation
- [ ] `docs/TESTING.md` — chiffres tests + couverture
- [ ] `docs/PRODUCTION_CHECKLIST.md` — variables intégrations
- [ ] `RAPPORT_ETAT_*.md` — nouveau snapshot post-consolidation

### Done quand
- [ ] `npm run test:e2e` → 11/11 verts
- [ ] Documentation alignée avec le code
- [ ] Aucun écart doc/code sur les modules partiels (WhatsApp, GPS, RLS)

---

## Lot 7 — Staging, smoke test, release *(1,5 jour)*

### Objectif
Prouver que l’app tourne en conditions réelles.

### Checklist déploiement staging

```bash
# Pré-vol
npm run lint && npm run type-check && npm run test && npm run build

# Migrations
npx prisma migrate deploy

# Seed pilote (école test)
npm run db:seed

# Smoke manuel (15 min)
curl -f https://staging.<domaine>/api/health
# → status ok, database connected, cache connected

# Parcours smoke
1. Login directeur → dashboard
2. Créer élève test
3. Saisir une note
4. Pointer une absence
5. Consulter portail parent
6. Initier paiement (sandbox FedaPay)
```

### Release
- [ ] Tag `v1.2.0` (ou `v1.2.1` si patches)
- [ ] Notes de release dans `CHANGELOG.md`
- [ ] Variables prod documentées dans `docs/PRODUCTION_CHECKLIST.md`
- [ ] `ALLOW_BACKUP_API_IN_PRODUCTION=false` confirmé
- [ ] Redis obligatoire en prod confirmé

### Done quand
- [ ] Staging accessible et stable 24 h
- [ ] Smoke test passé par 2 personnes (tech + métier)
- [ ] Tag git poussé

---

## Lot 8 — Lancement pilote école *(1 jour)*

### Objectif
Première école réelle — validation terrain, pas de développement.

### Pré-requis
- [ ] Lots 0–7 terminés
- [ ] École pilote identifiée (200–500 élèves idéal)
- [ ] Contact référent (directeur ou admin)
- [ ] Compte FedaPay sandbox ou prod selon accord
- [ ] Formation 2 h prévue (directeur + 2 enseignants + comptable)

### Périmètre pilote (modules activés)
| Module | Activé |
|--------|--------|
| Élèves & classes | ✅ |
| Notes & bulletins | ✅ |
| Assiduité | ✅ |
| Finance + MoMo/FedaPay | ✅ si credentials |
| Portail parents | ✅ |
| SMS / WhatsApp | ⚠️ si configuré |
| IA | ⚠️ opt-in explicite |
| Transport GPS | ❌ hors scope |

### Métriques de succès pilote (30 jours)

| KPI | Cible |
|-----|-------|
| Élèves importés | 100 % effectif |
| Notes saisies (trimestre en cours) | ≥ 80 % |
| Parents avec compte actif | ≥ 60 % |
| Paiements via Mobile Money | ≥ 30 % des encaissements |
| Incidents bloquants | 0 critique non résolu < 48 h |
| Satisfaction référent (échelle 1–10) | ≥ 7 |

### Done quand
- [ ] École opérationnelle 5 jours ouvrés sans intervention quotidienne
- [ ] Retour référent documenté (ce qui marche / ce qui bloque)
- [ ] Décision go/no-go scale commercial

---

## Matrice de sortie — Grille 9/10

| Dimension | Avant | Cible | Lot responsable |
|-----------|-------|-------|-----------------|
| Tests | 7,5 | **9** | Lot 1, 6 |
| E2E | 7,5 | **9** | Lot 6 |
| Performance | 7,5 | **9** | Lot 5 |
| Accessibilité | 7,5 | **9** | Lot 5 |
| Sécurité | 8,5 | **9** | Lot 2 |
| Scalabilité | 8 | **9** | Lot 2, 7 |
| Prod Ready | 7,5 | **9** | Lot 7 |
| Maintenabilité | 8 | **8,5** | Lot 1 (extraction progressive) |
| Documentation | 8 | **9** | Lot 6 |
| Observabilité | 8 | **9** | Lot 5, 7 |
| **Global** | **8,3** | **≥ 9** | Tous |

---

## Risques & mitigations

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Couverture API n’atteint pas 40 % en 3 j | Moyenne | Prioriser grades + payments uniquement, reporter students au lot 6 |
| RLS casse des requêtes existantes | Moyenne | Feature flag `ENABLE_TENANT_RLS=true`, rollback migration |
| Lighthouse instable en CI | Haute | 3 runs, prendre médiane ; perf prod via Web Vitals |
| Credentials MoMo/WhatsApp indisponibles | Haute | Pilote sans ces canaux — SMS email suffisant |
| École pilote peu réactive | Moyenne | Prévoir école backup, jeu de données seed réaliste |

---

## Journal d’avancement

| Date | Lot | Statut | Notes |
|------|-----|--------|-------|
| 2026-08-28 | — | Plan rédigé | Baseline : 2666 tests, 8,3/10 global |
| 2026-08-28 | 0 | ✅ | Branche `release/1.2-consolidation` créée |
| 2026-08-28 | 1 | 🟡 En cours | Jour 1 : `grades-route`, `grades-id` (+15). Jour 2 : paiements déjà couverts. Jour 3 : `classes-route`, `classes-id`, `fees-route` (+22) + fix Zod sur `/api/fees` → **2 703 tests**, seuil API **40/30/40** |
| | 2 | [ ] | |
| | 3 | [ ] | |
| | 4 | [ ] | |
| | 5 | [ ] | |
| | 6 | [ ] | |
| | 7 | [ ] | |
| | 8 | [ ] | |

---

## Prochaine action immédiate

```bash
# Lot 2 — RLS Postgres : brancher withTenantRls sur students, grades, payments
npm test -- --run tests/lib/tenant-rls.test.ts
# Puis étendre src/app/api/students/route.ts comme modèle
```
