# Analyse statique — audit du 2026-10-14

Commit de départ `75b2377`. Toutes les valeurs proviennent d'une commande consignée dans
`evidence/commands.tsv` ou d'une lecture de fichier citée.

## 1. Contrôles outillés (baseline)

| Contrôle | Commande | Résultat | Durée | Preuve |
|---|---|---|---|---|
| Schéma Prisma | `npx prisma validate` | valide | 3,2 s | `evidence/02` |
| Types (app + scripts) | `npm run type-check` | 0 erreur | 22,1 s | `evidence/03` |
| Lint | `npm run lint` (ESLint sur `src/`) | 0 erreur, 0 avertissement affiché | 87,8 s | `evidence/04` |
| Build production | `npm run build` | réussi | 85,0 s | `evidence/07` |

## 2. Indicateurs de code (`src/`, 964 fichiers, 180 167 lignes) — `evidence/40-static-metrics.log`

| Indicateur | Valeur |
|---|---|
| `any` explicites (`: any`, `as any`, `<any>`) | 2 |
| Directives `eslint-disable` | 12 |
| `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck` | 0 |
| `TODO`/`FIXME`/`XXX`/`HACK` | 5 |
| `console.log` | 2 |
| `catch {}` vides | 0 |

Plus gros fichiers (complexité à surveiller, pas un défaut en soi) : `design-system/showcase.tsx` (2 244
lignes), `lib/ai/governance-service.ts` (1 431), `grades/entry/page.tsx` (1 261), `grades/bulletins/page.tsx` (1 182).

## 3. Code mort (knip 6.41.0, `npx knip`)

knip signale 30 fichiers « inutilisés », pour la plupart des scripts lancés à la main (`scripts/quality/*`,
seeds secondaires, `ecosystem.config.js`) : **faux positifs** pour ce type d'outil. Vérifiés :

- `src/app/sw.ts` et la dépendance `serwist` : **faux positif** — compilés par `withSerwist` (`next.config.js:225`)
  et servis par `src/app/serwist/[path]/route.ts` ; `GET /serwist/sw.js` répond 200 **[E]**.
- `src/components/layout/page-header.tsx` : réellement inutilisé (aucun import) — P4, sans risque.
- 161 exports inutilisés (constantes et utilitaires) : dette mineure, aucun impact fonctionnel démontré.

## 4. Architecture

- **Contrôle d'accès centralisé** : 310 des 313 routes API passent par `createApiHandler`
  (`src/lib/api/api-helpers.ts`). Les 3 autres : `auth/[...nextauth]` (le fournisseur d'authentification
  lui-même), `metrics` (jeton `METRICS_TOKEN`, comparaison en temps constant), `setup` (réexport de
  `auth/initial-setup`, qui utilise `createApiHandler`). **[S]**
- 20 routes déclarent `requireAuth: false`, toutes justifiées par leur nature (connexion, mot de passe oublié,
  webhooks signés, crons à secret, vitrine publique, santé, télémétrie web-vitals). **[S]**
- **Isolation des établissements** à deux niveaux : contrôles applicatifs (`canAccessSchool`,
  `ensureRequestedSchoolAccess`) et RLS PostgreSQL forcée sur 16 tables. **[S][E]**
- **Moteur de calcul unique** : `average-engine.ts` (fractions BigInt) → `class-averages.ts` → routes
  (bulletins, PDF, conseils, statistiques, espaces famille). Pas de calcul parallèle divergent repéré. **[S]**

## 5. Défauts établis par inspection (détails dans `defects-register.md`)

| ID | Constat | Fichier | Statut |
|---|---|---|---|
| DEF-002 | Moyenne annuelle non bornée à [0 ; 20] contrairement à la moyenne de matière | `src/lib/academic/average-engine.ts` (fermeture `fullMean` de `computeAnnualAverages`) | confirmé par exécution, corrigé |
| DEF-003 | Calcul séquentiel et redondant des moyennes pour la vue d'un seul élève | `src/lib/academic/class-averages.ts` (`studentAveragesSummary`) | confirmé par mesure, corrigé |
| DEF-006 | Appel `/api/students` toujours refusé (403) pour un élève | `src/components/grades/family-grades.tsx:54` | confirmé par exécution, corrigé |
| DEF-007 | `vitest` 4.1.11 et `@vitest/coverage-v8` 4.1.6 désalignés | `package.json` | confirmé, corrigé |
| DEF-008 | Validation d'une formule par cas types seulement (pas de preuve de bornes) | `src/lib/academic/formula.ts` `validateFormula` | confirmé, atténué (garde-fous à l'exécution) |
| DEF-009 | Virgule décimale ambiguë dans une liste de constantes | `src/lib/academic/formula.ts` `tokenize` | confirmé, ouvert (P4) |
| DEF-010 | Cron `automation` répond 500 sans `CRON_SECRET` (`retention` répond 401) | `src/app/api/system/automation/route.ts:34-42` | confirmé, ouvert (P4) |

## 6. Dépendances

Voir `security-audit.md` §6 : `npm audit --omit=dev` avant correction : 6 avis (1 critique, 4 élevés,
1 faible) ; après : 2 élevés sans version corrigée publiée (`sharp`, `source-map-js`).

## 7. Limites

Pas d'analyse de dépendances circulaires (aucun outil installé : madge/dependency-cruiser), pas de mesure
de complexité cyclomatique outillée, pas de tests de mutation.
