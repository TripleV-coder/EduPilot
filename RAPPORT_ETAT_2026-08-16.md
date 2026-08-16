# 📊 Rapport d'état détaillé — EduPilot

*Rapport établi le 16 août 2026, sur la base d'exécutions réelles (tsc, eslint, vitest, next build) et d'analyse du dépôt git.*

---

## 1. Identité du projet

| | |
|---|---|
| **Produit** | SaaS multi-tenant de gestion scolaire (marché francophone / Bénin) |
| **Stack** | Next.js 16 (App Router, middleware Edge), TypeScript strict, Prisma/PostgreSQL, Redis Upstash, NextAuth v5, Tailwind + Radix UI, Zod |
| **Observabilité** | Sentry, PWA (Serwist), logs structurés |
| **Tests** | Vitest (unitaire) + Playwright (E2E) |
| **Déploiement** | Docker / PM2 / Vercel / Railway |
| **Échelle du code** | 873 fichiers TS/TSX (~170 000 lignes), 56 deps + 26 devDeps |

---

## 2. État vérifié par exécution (aujourd'hui)

| Vérification | Résultat | Détail |
|---|---|---|
| `tsc --noEmit` (strict) | ✅ **0 erreur** | — |
| `eslint src` | ✅ **0 erreur** | 1 warning résiduel |
| `vitest run` | ✅ **1 169 tests verts** | 126 fichiers, 32,8 s — +40 tests vs le CHANGELOG (1 129) |
| `next build` | ✅ **OK** | Compilé en 28,3 s, 191 pages statiques générées |
| `next.config.js` | `ignoreBuildErrors: false` | Le build passe donc réellement |

**Conclusion : le « blocage » identifié par l'audit du 03/08 (RAPPORT_ANALYSE.md : note 6,5/10, build cassé, 16 tests rouges) est désormais résolu.** Les remédiations annoncées au CHANGELOG 2026-08-03 sont effectives dans le code.

---

## 3. Couverture des tests

| Métrique | Valeur |
|---|---|
| Couverture globale (rapport 14/08) | ~25 % lignes / 21 % branches / 31 % fonctions |
| Périmètre couvert | `src/lib/**`, `src/components/edu/**`, `src/components/messaging/**`, **+ `src/app/api/**`** (nouveau) |
| Seuils API en vigueur (vitest.config.ts) | 10/8/8 (lignes/branches/fonctions) |
| Specs E2E Playwright | 13 fichiers : auth, RBAC, tenant, finance, grades, présence, parent, a11y, anonyme, routes publiques, tour |

---

## 4. Périmètre fonctionnel livré

**175 pages, 283 routes API, 121 modèles Prisma, 34 migrations.** Modules implémentés :

- **RBAC** : 7 rôles dont `NETWORK_ADMIN` (hérite de SCHOOL_ADMIN via `roleSatisfies`), matrice de permissions, périmètre réseau (site MAIN + annexes), gardes de pages et de routes.
- **Scolarité** : élèves, classes, inscriptions, **bulletins PDF avec signatures électroniques**, cartes scolaires QR, passage de classe, alumni.
- **Pédagogie** : LMS (cours/leçons/devoirs), examens en ligne minutés, cahier de notes, préparation BEPC.
- **Finance** : frais, échéanciers, **FedaPay + MoMo Collection**, cash, webhooks, rapprochement, **comptabilité OHADA** (journaux, tiers), paie, bourses, wallet, cagnottes.
- **RH** : présences, congés, paie (StaffAttendance, LeaveRequest, PayrollEntry).
- **Vie scolaire** : assiduité, discipline, cantine, transport, bibliothèque, clubs, bien-être (psy).
- **Santé** : dossiers médicaux, allergies, vaccinations.
- **IA** : chatbot multi-providers (GROQ/OpenAI → n8n en cascade), **prédiction de décrochage et d'échec**, orientation BEPC, alerte précoce.
- **Super-admin SaaS** : MRR, onboarding écoles, plans, **mode maintenance réel**, audit logs.
- **RGPD** : export one-click, droit à l'oubli (anonymisation), rétention, chiffrement AES-256-GCM.
- **Sécurité** : **2FA TOTP réellement imposé au middleware** (fix TD-001, 283 routes + 174 pages), rate-limit TOTP (5 essais/10 min), verrouillage de compte, CSP à nonce, 0 `any` explicite (ESLint en `error`).
- **Vitrine** : site public + annuaire d'établissements.

---

## 5. Dette technique (TECH_DEBT.md, registre chiffré)

| ID | Dette | Statut |
|---|---|---|
| TD-001 à TD-003 | Faille 2FA (non imposé, brute-force TOTP, verrouillage contourné) | ✅ Corrigé 30/07 |
| TD-004 | 208 routes hors `createApiHandler` | ✅ Corrigé 03/08 (279/283, ~98 %) |
| TD-007 | `any` résiduels | ✅ Corrigé 04/08 (0 explicite) |
| TD-008/009/010/011 | OTP dupliqué, latence proxy, fake data, SMS non persistés | ✅ Corrigés |
| **TD-005** | **Couverture des routes API encore faible** | 🟡 **Ouvert** (seuils 10/8/8, cible 40/30/40) |
| **TD-006** | **Seuils de couverture sous les cibles long terme** | 🟡 **Ouvert** (cible 60/50/60 lib) |

**9/11 dettes corrigées.** Les 2 restantes sont des objectifs de couverture, pas des bugs.

---

## 6. ⚠️ Points d'attention — l'état du dépôt git

**La branche actuelle (`cursor/changelog-unreleased-roadmap`) n'est pas une release :**

1. **2 856 fichiers modifiés vs HEAD** — mais en détail :
   - **2 477 suppressions = `.tools/`, `.agent/`, `.claude/`, `.windsurf/`** : fichiers de configuration d'outils IA (skills, datasets CSV) qui avaient été commités par erreur et sont en cours de retrait. **Ne pas committer ces suppressions avec du code applicatif** (ou le faire dans un commit dédié).
   - **362 fichiers modifiés = code réel** : `src/`, `prisma/`, `tests/`, configs — c'est la remédiation du 03/08 et le travail en cours (api-helpers, medical-records, vitest.config, communication, tenant-rls, etc.).
2. **22 fichiers non suivis** : nouveaux modules (`src/app/api/communication/`, `src/lib/communication/default-templates.ts`, `src/lib/db/tenant-rls.ts`), tests API, scripts, PDF de dossiers, `docs/livrables/`.
3. **Dernier commit : 31/07/2026** (changelog roadmap). Toute la remédiation « production-ready » d'août est **non commitée**.

---

## 7. Historique récent (juin–juillet 2026)

~40 commits feature : RBAC NETWORK_ADMIN (tranche A complète), RH + OHADA, signatures électroniques, QR badges, vitrine publique, socle IA + prédictions, FedaPay/MoMo, alumni, access-control (badges/scans), lien parent-enfant par code, UX (auto-save, optimistic), fix CodeQL (ReDoS), refactors p3 (découpe fichiers >1 200 lignes, FormPageTemplate, resolvers zod typés).

---

## 8. Synthèse

| Dimension | Appréciation |
|---|---|
| Build & CI | ✅ **Verte** (types, lint, tests, build) |
| Fonctionnalités | ⭐ Exceptionnel (9/10 — audit du 03/08) |
| Sécurité | Forte (2FA réel, RBAC, CSP, 0 `any`) |
| Tests | 1 169 verts, mais couverture globale ~25 % (cible à remonter) |
| Dette technique | 9/11 corrigée, 2 objectifs de couverture ouverts |
| **Production** | 🔴 **Rien n'est déployé ni tagué** ; l'état « production-ready » du CHANGELOG existe uniquement dans le working tree |

**Priorités recommandées** : ① committer proprement l'état de remédiation (séparer suppressions `.tools/` du code applicatif), ② taguer une release 1.2.0, ③ attaquer TD-005/TD-006 (couverture API), ④ relancer les 13 specs E2E pour valider le parcours utilisateur complet.