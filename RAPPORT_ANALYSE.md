# Rapport d'analyse — EduPilot

> Audit technique complet du dépôt, réalisé le **2026-08-03**.
> Méthode : inspection du code + exécution réelle des vérifications (`tsc`, `eslint`, `vitest`).

---

## 1. Ce que fait l'app

**EduPilot** est un SaaS multi-tenant de gestion scolaire (marché francophone/Bénin) : Next.js 16 App Router, TypeScript strict, Prisma/PostgreSQL, Redis (Upstash), NextAuth v5, Tailwind + Radix UI, Vitest + Playwright, Docker/PM2, Sentry, PWA (Serwist).

**Scale mesuré :**

| Indicateur | Valeur |
|---|---|
| Fichiers TS/TSX | 873 (≈170 000 lignes) |
| Routes API | 283 |
| Pages | 175 |
| Modèles Prisma | 121 |
| Migrations | 33 |
| Tests unitaires | 1 129 (115 fichiers) |
| Specs E2E Playwright | 13 |

### Modules implémentés

| Domaine | Contenu |
|---|---|
| **RBAC multi-rôles** | SUPER_ADMIN, NETWORK_ADMIN (avec héritage), SCHOOL_ADMIN, DIRECTOR, TEACHER, STUDENT, PARENT — matrice de permissions, gardes par route (`roleSatisfies`) |
| **Scolarité** | Élèves, classes, niveaux, inscriptions, bulletins PDF (jspdf) avec signatures électroniques, cartes QR, passage de classe, alumni |
| **Pédagogie** | LMS (cours, leçons, devoirs), examens en ligne avec timer, cahier de notes, compétences BEPC, conseils de classe |
| **Finance** | Frais, plans de versement, paiements FedaPay / MoMo / cash, webhooks, rapprochement, comptabilité OHADA (journaux, tiers), paie, bourses, wallet, cagnottes |
| **Vie scolaire** | Assiduité, discipline/sanctions, cantine, transport, bibliothèque, événements, clubs |
| **RH** | Présences, congés, paie (StaffAttendance, LeaveRequest, PayrollEntry) |
| **Santé** | Dossiers médicaux, allergies, vaccinations |
| **RGPD** | Export one-click, droit à l'oubli (anonymisation), politiques de rétention, audit logs |
| **IA** | Chatbot via LLM externes (OpenAI / Anthropic / Groq / Google), prédiction échec/abandon, orientation BEPC, n8n (chat + analyse) |
| **Super-admin SaaS** | MRR, onboarding écoles, plans, monitoring, mode maintenance |
| **Extras** | Access control (badges QR + scans), campagnes vocales, benchmark, bien-être (psy), analytics BI + prédictif, vitrine publique + annuaire |

---

## 2. Limites actuelles (vérifiées par exécution)

### 2.1 Build cassé — 7 erreurs TypeScript

`tsc --noEmit` remonte **7 erreurs** dans `src/app/api/medical-records/[id]/` :

- `allergies/route.ts` (2 erreurs)
- `emergency-contacts/route.ts` (3 erreurs)
- `vaccinations/route.ts` (2 erreurs)

Cause : les handlers retournent `undefined` dans certains chemins, incompatibles avec le type `RouteHandler` de `createApiHandler` qui exige `Promise<Response | NextResponse>`.

Conséquence : `next.config.js` a `ignoreBuildErrors: false` → **`next build` échoue**.

### 2.2 16 tests rouges (1113/1129 verts)

4 fichiers de test échouent :

| Fichier | Tests échoués | Cause |
|---|---|---|
| `tests/api/upload.test.ts` | 9 | 500 au lieu de 401/400/201 |
| `tests/api/fedapay-webhook.test.ts` | 5 | 500 au lieu de 503/401/200 |
| `tests/api/auth.test.ts` | 1 | 500 au lieu de 410 |
| `tests/api/grades.test.ts` | 1 | 500 au lieu de 403 |

**Cause racine unique** : `createApiHandler` lit `request.nextUrl.pathname` sans garde (src/lib/api/api-helpers.ts:281) alors que les tests passent des objets `Request` simples (sans `nextUrl`) → exception → 500.

⚠️ Contredit le CHANGELOG qui annonce « 1 129 tests verts ».

### 2.3 Working tree instable

**2 684 fichiers modifiés non commités** (~1M lignes supprimées vs HEAD) — grosse refactorisation en cours sur la branche `cursor/changelog-unreleased-roadmap`. L'état analysé est un état de travail, pas une release.

### 2.4 Dette technique déclarée (TECH_DEBT.md, audit 2026-07-30)

| ID | Dette | Priorité |
|---|---|---|
| TD-004 | 208/283 routes (73 %) hors `createApiHandler` | 1,5 |
| TD-005 | 12 % des routes API couvertes par des tests (34/283) | 1,2 |
| TD-006 | Seuils de couverture sous les cibles long terme | 1,0 |
| TD-007 | 204 occurrences de `any` | 1,3 |
| TD-008 | Logique OTP dupliquée entre `/mfa-setup` et le composant partagé | 4,0 |

- **Couverture** : 46,87 % lignes / 37,01 % branches — périmètre limité à `src/lib/**`, `src/components/edu/**`, `src/components/messaging/**`. **Les 283 routes et 175 pages sont hors périmètre.**
- **Latence** : ~4-5 s par requête authentifiée signalée (rate limiting dans `proxy.ts`).

### 2.5 Documentation obsolète

- README annonce « IA Buddy (Ollama / Local) » → **0 référence à Ollama dans le code** (IA = LLM externes + n8n).
- Métriques de performance annoncées (TTFB < 200 ms, LCP < 2,5 s) → jamais mesurées.
- Mention Three.js / React Three Fiber non vérifiée dans le code.

### 2.6 Points forts à créditer

- `eslint src` : **0 erreur, 0 warning**
- 0 TODO / FIXME / HACK réel, 0 `@ts-ignore` (2 `@ts-expect-error` justifiés)
- Fix sécurité récent de qualité : 2FA réellement imposé au middleware (TD-001), rate limit TOTP (TD-002), verrouillage compte sur 2FA (TD-003) — avec tests de non-régression vérifiés rouges avant fix
- Isolation multi-tenant saine (vérifiée sur les routes qui lisent `?schoolId`)
- CSP à nonce strict, chiffrement AES-256-GCM des secrets TOTP, bcrypt coût 12
- Aucun secret committé (`.env` non tracké)

---

## 3. Note actuelle

Évaluation sur les 12 dimensions du référentiel Ultra Dev Forge :

| Dimension | Note | Dimension | Note |
|---|---|---|---|
| Architecture | 8/10 | Sécurité | 7,5/10 |
| Fonctionnalités | 9/10 | Performance | 5/10 |
| Qualité code | 7/10 | Documentation | 6/10 |
| Tests | 6/10 | UX/UI | 7/10 |
| Production | 4/10 | DevEx | 7/10 |

**Note globale : 6,5/10**

Potentiel : **8/10+** — la richesse fonctionnelle est exceptionnelle (9/10), mais au jour de l'audit le repo ne compile pas, 16 tests échouent et le build est bloqué.

## 4. Actions de remédiation (ordre de priorité)

1. **Corriger `createApiHandler`** : garde sur `request.nextUrl?.pathname` (ou fallback) → corrige les 16 tests d'un coup (api-helpers.ts:281).
2. **Aligner les 3 routes medical-records** sur le type `RouteHandler` (retourner `NextResponse` sur tous les chemins) → corrige les 7 erreurs TS et débloque `next build`.
3. Relancer la CI complète (types + lint + tests + build) et committer l'état de travail en cours.
4. Planifier TD-004 (migration des 208 routes vers `createApiHandler`) avec tests écrits avant migration.
5. Étendre `coverage.include` à `src/app/api/**` (TD-005/TD-006).
6. Mettre à jour le README (IA, métriques, stack) pour refléter la réalité.
