# Livrable 7 — Audit multi-écoles, changement d'école et cache

> Audit du 2026-10-15, branche `feat/enseignant-multi-ecoles` (commit `0d57d9c`), en lecture seule.
> Seul ajout au dépôt : le test de régression `tests/integration-db/multi-school-teacher.test.ts`, non commité.
> Les constats sont classés selon les catégories du §22 de la mission : anomalie confirmée, risque plausible, absence de test, décision métier, limitation connue.

## 1. Cartographie de l'architecture actuelle

| Notion | Représentation réelle | Référence |
|---|---|---|
| Identité | `User` (email **unique**, `password`, `isActive`, 2FA) | `prisma/schema.prisma` modèle `User` |
| Rôle | `User.role` : **un seul rôle global**, enum `UserRole` (9 valeurs). `User.roles[]` existe mais n'est lu que par le client (`src/lib/hooks/use-rbac.ts:28,62`) | `src/lib/auth/config.ts:285,304` |
| Permissions | Calculées depuis le rôle (`getRolePermissions`) ; le serveur appelle `hasPermission(session.user.role, …)` | `src/lib/rbac/permissions.ts:484-535`, `src/lib/api/api-helpers.ts:435-450` |
| École principale | `User.schoolId` (et `TeacherProfile.schoolId`, `StudentProfile.schoolId`) | schéma |
| Rattachements supplémentaires | Enseignant : `TeacherSchoolAssignment` (ACTIVE/INACTIVE/ARCHIVED). Réseau : `OrganizationMembership`. Parent : écoles **déduites** des enfants (`ParentStudent`). Direction d'une école principale : annexes (`School.parentSchoolId`). | `src/lib/auth/school-access.ts:33-117` |
| Affectations | `ClassSubject.teacherId`, `Class.mainTeacherId` | schéma |
| École active | `session.user.schoolId` (jeton JWT), choisie parmi `accessibleSchoolIds` | `src/lib/api/tenant-isolation.ts:272-278` |
| Contexte base | Par requête : SUPER_ADMIN → contexte système ; **TEACHER → école active seule** ; autres rôles → école active + écoles accessibles. Appliqué par la RLS PostgreSQL sur **16 tables** | `src/lib/db/session-db-context.ts:12-20`, migrations `*FORCE ROW LEVEL SECURITY*` |
| Gardes partagés | `createApiHandler` (authentification, 2FA, garde central `?schoolId`, module activé, rôles, permissions, contexte RLS), `ensureSchoolAccess`, `canAccessSchool`, `ensureRequestedSchoolAccess`, `assertModelAccess` | `src/lib/api/api-helpers.ts:368-461`, `src/lib/api/tenant-isolation.ts` |

**Rôles globaux ou par établissement ?** Ils sont globaux à l'utilisateur. Une personne a un seul rôle, valable dans toutes ses écoles accessibles. Un enseignant de l'école A ne peut pas être parent dans l'école B avec le même compte : l'email est unique et il n'y a qu'un rôle côté serveur. Voir la question métier Q-ROLE-01 (livrable 11).

## 2. Parcours d'authentification et de changement d'école

```
Connexion (POST /api/auth/callback/credentials)
  └─ authorize() config.ts:150-320
       • utilisateur actif ? verrou de compte ? bcrypt ; échec → compteur + journal
       • école suspendue → refus (après mot de passe correct)
       • 2FA : code fourni → vérifié ; sinon session « pré-2FA » (isTwoFactorAuthenticated=false)
       • accessibleSchoolIds = getAccessibleSchoolIdsForUser()   ← calcul EN BASE
       • école active = resolveActiveSchoolId(école principale)
  └─ jwt() : jeton signé, durée 24 h (config.ts:134)

Chaque requête
  └─ jwt() sans trigger : getCachedUserStatus() (cache mémoire 30 s PAR PROCESSUS, config.ts:75-118)
       • compte désactivé / école suspendue / mot de passe changé → jeton invalidé
       • rôle changé → token.role mis à jour (permissions et liste d'écoles NON recalculées)
       • accessibleSchoolIds : JAMAIS recalculé ici
  └─ createApiHandler : 2FA, ?schoolId ∈ accessibleSchoolIds, module, rôle, permissions,
       contexte RLS (dbContextForSession)

Changement d'école (school-provider.tsx:188-209)
  └─ update({ schoolId }) → jwt(trigger="update") config.ts:403-447
       • liste des écoles RECALCULÉE en base ; école demandée acceptée seulement si elle y figure
  └─ client : purge de TOUTES les clés SWR + revalidation, router.refresh()
```

## 3. Tests exécutés (parcours A→G de la mission)

Fichier `tests/integration-db/multi-school-teacher.test.ts`. Il tourne sur un PostgreSQL éphémère, avec le rôle applicatif soumis à la RLS (`tests/integration-db/global-setup.ts:74-90`). Il prépare trois écoles aux valeurs reconnaissables : A « ALPHA » (note 11), B « BRAVO » (note 17), C « CHARLIE » (note 3). Une seconde classe de A n'est pas tenue par l'enseignant (note 8). Les tests vérifient le **contenu** des réponses et **l'état réel en base**.

**Résultat : 21 tests, 18 réussis, 3 échecs attendus (`it.fails`) qui documentent des anomalies confirmées.**

| Étape | Test | Résultat |
|---|---|---|
| A/B | École A active : classes = A seulement ; notes de sa classe A = [11] | ✔ |
| B | Notes de sa classe B demandées depuis A → aucune note de B (une école à la fois, RLS) | ✔ |
| C/D | École B active, **même URL** que pour A : classes = B seulement (la clé de cache contient l'école) ; notes B = [17] | ✔ |
| D | Modifier une note de A depuis le contexte B → 403/404, note **inchangée** en base ; contrôle positif depuis A → 200, note modifiée | ✔ |
| E | `?schoolId=C` → 403 sans aucune donnée de C ; classe de C par identifiant → refusée ; notes/élèves de C → rien ; PATCH d'une note de C → refusé, note inchangée | ✔ |
| C | Changement d'école via le **vrai** callback `jwt(trigger:update)` : vers B accepté, vers C ignoré | ✔ |
| — | Garde central `?schoolId` (route `/api/analytics/bi`) → 403 + contrôle positif de C | ✔ |
| F | Retrait de B (`detachTeacherFromSchool`) : rattachement inactif, cours retirés | ✔ |
| F | Nouveau changement d'école : B disparaît de la liste | ✔ |
| G | **Sans changement d'école, le jeton garde B** | ✘ attendu → anomalie MS-01 |
| G | **Avec ce jeton, la liste des classes de B reste lisible** | ✘ attendu → anomalie MS-01 |
| G | Avec ce jeton, les élèves de B ne sont plus lisibles (cours retirés) | ✔ |
| — | **Un enseignant lit les notes d'une classe qu'il n'enseigne pas (même école)** | ✘ attendu → anomalie MS-02 |

Commande : `npx vitest run --config vitest.integration.config.ts tests/integration-db/multi-school-teacher.test.ts`.

> **Correction d'un constat intermédiaire.** La lecture du fichier `src/app/api/analytics/bi/route.ts:32` laissait croire que `?schoolId` n'était pas contrôlé. Le test a montré que `createApiHandler` refuse **centralement** tout `?schoolId` hors périmètre (`api-helpers.ts:374-389`). Ce n'est donc **pas** une anomalie. Le test est conservé comme test de non-régression du garde central.

## 4. Anomalies confirmées

### MS-01 — La révocation d'un rattachement n'atteint pas les sessions ouvertes (jusqu'à 24 h)

- **Preuve.**
  - `jwt()` ne recalcule `accessibleSchoolIds` et l'école active que lors d'un changement d'école demandé (`src/lib/auth/config.ts:403-447`).
  - La vérification par requête (`:451-480`) ne regarde que `isActive`, la suspension d'école, `passwordChangedAt` et `roleChangedAt`.
  - Le jeton vit 24 h (`:134`).
  - `roleChangedAt` n'est **écrit nulle part** dans `src/` : `grep roleChangedAt` ne trouve que des lectures. La branche d'invalidation sur changement de rôle (`:470-473`) est donc inopérante. Le rôle est remplacé silencieusement (`:476-478`), mais pas la liste d'écoles.
  - Tests `it.fails` « sans changement d'école, le jeton garde B » et « la liste des classes de B reste lisible ».
- **Impact.** Un enseignant retiré d'une école garde, jusqu'à l'expiration de sa session, l'accès en lecture aux données de cette école **non liées à ses cours** : liste des classes, référentiels et toute route qui filtre seulement sur l'école active. Les élèves et notes sont protégés en pratique, parce que le retrait supprime ses cours (test vert). Le même mécanisme vaut probablement pour tout changement de `User.schoolId` ou de réseau fait par l'administration. Ce cas n'est pas testé (risque R-MS-06).
- **Confinement recommandé.**
  1. À chaque retrait, ou changement d'école ou de rôle, renseigner `roleChangedAt` (le mécanisme d'invalidation existe déjà, `config.ts:470`).
  2. Ou recalculer `accessibleSchoolIds` dans le contrôle par requête, avec le même cache de 30 s que l'état du compte.
- **Test de régression** : les deux `it.fails` passeront une fois le correctif en place.

### MS-02 — Un enseignant lit les notes de toutes les classes de son école active

- **Preuve.**
  - `GET /api/grades?classId=` (`src/app/api/grades/route.ts:25-80`, permission `GRADE_READ`) ne restreint pas l'enseignant à ses classes.
  - À l'inverse, `GET /api/students` restreint l'enseignant aux classes qu'il enseigne (`src/app/api/students/route.ts:110-122`, `taughtClassIds`).
  - Test `it.fails` « lit les notes d'une classe qu'il n'enseigne pas » : la note 8 est renvoyée.
- **Impact.** Accès horizontal aux notes de tous les élèves de l'école. C'est incohérent avec la règle appliquée aux listes d'élèves. Même famille non testée : `POST /api/grades/report-cards` (`:322-382`) n'exige que l'appartenance à l'école (`ensureSchoolAccess`) pour un enseignant.
- **Décision métier requise (Q-ROLE-03)** : le professeur principal ou le conseil de classe doit-il tout voir ? Si non, appliquer `taughtClassIds` comme pour les élèves.

### MS-03 — Le service worker met en cache les réponses API et les pages authentifiées pendant 24 h

- **Preuve (configuration, non reproduite dans un navigateur).**
  - `src/app/sw.ts:40-46` utilise `runtimeCaching: defaultCache` de `@serwist/turbopack`.
  - La règle « apis » de cette bibliothèque (`node_modules/@serwist/turbopack/dist/index.worker.mjs`) met en cache **tout GET `/api/*` de même origine** : NetworkFirst, repli sur le cache si le réseau échoue ou dépasse 10 s, 16 entrées, 24 h.
  - Les règles « pages-rsc », « pages » et « others » font de même pour les pages.
  - La clé est **l'URL seule** (ni utilisateur, ni école).
  - Le service worker est enregistré en production (`src/app/layout.tsx:102`, `src/components/pwa/ServiceWorkerRegister.tsx`).
  - Aucun `caches.delete` à la déconnexion (`grep` : aucune occurrence).
- **Impact.** Sur un appareil partagé (poste de secrétariat, téléphone familial), ou après un changement d'école, un réseau coupé ou lent peut servir la réponse JSON d'un **autre compte ou d'une autre école** : notes, paiements, élèves. L'en-tête `Cache-Control: private` posé par `withCache` ne protège pas du cache du service worker.
- **Confinement recommandé.** Règle `NetworkOnly` pour `/api/` et pour les pages du tableau de bord avant `defaultCache`, et purge `caches` à la déconnexion. Le mode hors-ligne garderait seulement la coquille et `/offline`.
- **Test à écrire** : E2E en production locale avec réseau simulé hors-ligne. Il demande un navigateur Playwright, non autorisé à ce stade.

### MS-04 — Brouillon d'inscription : données personnelles stockées en clair, clé globale, jamais effacé

- **Preuve.** `src/app/(dashboard)/dashboard/students/inscription/page.tsx:187,197` utilise la clé fixe `edupilot.inscription.draft`. Elle contient nom, date de naissance, adresse, téléphone et nom du parent (`src/components/students/inscription/types.ts:48-66`). Aucun `removeItem` nulle part, ni après inscription ni à la déconnexion.
- **Impact.** Persistance de données d'un mineur sur l'appareil. Le formulaire est pré-rempli pour le compte suivant ou pour une autre école, d'où un risque d'inscription erronée.
- **Correctif ciblé** : clé incluant l'utilisateur et l'école, suppression après succès et à la déconnexion.

### MS-05 — `PATCH /api/root/users` : écriture libre de tout champ utilisateur, sans validation ni journal

- **Preuve.**
  - `src/app/api/root/users/route.ts:101-130` fait `const { id, ...data } = body`, puis `prisma.user.update({ data: { ...data } })`.
  - Il n'y a ni liste des champs autorisés, ni validation Zod, ni journal d'audit (drapeau A absent, annexe A1), ni `roleChangedAt`.
  - La route est réservée au SUPER_ADMIN, et aux seules adresses de `ROOT_USER_EMAILS` si cette liste est définie (`src/lib/security/require-root.ts:5-11`). L'email racine lui-même ne peut pas être modifié.
- **Impact.** Ce n'est pas une élévation de privilège : seuls les comptes les plus privilégiés y accèdent. En revanche :
  - un champ sensible (`password` en clair, `twoFactorSecret`, `email`, `role`, `schoolId`, `roles`) peut être écrasé sans contrôle ni trace ;
  - les sessions de la personne modifiée restent valides (MS-01).
- **Correctif ciblé** : schéma Zod limité aux champs prévus, journal d'audit, `roleChangedAt` si le rôle ou l'école change.

## 5. Protections vérifiées (preuves positives)

| Protection | Preuve |
|---|---|
| Garde central `?schoolId` sur toutes les routes authentifiées | `api-helpers.ts:374-389` + test « garde central » |
| `body.schoolId` accepté seulement pour SUPER_ADMIN | Revue des 14 fichiers concernés : `users`, `users/invite`, `import/*`, `teachers`, `events`, `announcements`, `subjects`, `class-levels`, `evaluation-types`, `academic-years`, `finance/fees`, `fees`, `payments/reconcile`, `analytics/recalculate` (avec `canAccessSchool`) |
| `?schoolId` re-contrôlé localement | 35 lectures recensées, toutes suivies de `ensureRequestedSchoolAccess`, `canAccessSchool` ou `ensureSchoolAccess` (liste en livrable 12) |
| Changement d'école validé côté serveur | `config.ts:403-447` + 2 tests |
| Enseignant : base limitée à l'école active | `session-db-context.ts:18` + test « notes B depuis A » |
| RLS forcée sur 16 tables | migrations ; `tests/integration-db/rls-effective.test.ts` (14 tests) |
| Accès par identifiant `[id]` d'une autre école | `tests/integration-db/tenant-isolation-sweep.test.ts` : 70 routes, avec un administrateur étranger. Il ne couvre pas un enseignant multi-écoles, désormais couvert partiellement par le nouveau test |
| Module désactivé = API fermée | `api-helpers.ts:412-432` |
| Purge du cache client au changement d'école | `school-provider.tsx:200-205` |

## 6. Cartographie des caches

### 6.1 Cache HTTP serveur (`withCache`, `src/lib/api/cache-helpers.ts`)

Implémentation à trois niveaux (`src/lib/cache/redis.ts:299-309`) :
1. Redis TCP si `REDIS_URL` est défini.
2. Sinon Upstash REST si les deux variables `UPSTASH_*` sont définies.
3. Sinon cache mémoire du processus : 5 000 entrées, 64 Mo, éviction LRU.

Redis lent ou en panne : un coupe-circuit bascule sur le cache mémoire du processus.

| Route | Clé | Durée | Invalidation |
|---|---|---|---|
| `/api/teachers` | `api:<path>:<params>:user:<userId>:<écoleActive>` | 120 s | `invalidateByPath(CACHE_PATHS.teachers)` (3 appels) |
| `/api/classes` | idem | 120 s | `CACHE_PATHS.classes` (2 appels) |
| `/api/subjects` | idem | 300 s | `/api/subjects` (1 appel) |
| `/api/canteen/menu`, `/api/gamification/*` | idem | 120 s | aucune trouvée → périmé ≤ 120 s |
| `/api/messages` | idem | 30 s | `CACHE_PATHS.messages` (6) |
| `/api/payments` | idem | 60 s | `/api/payments` (6) + `CACHE_PATHS.payments` (9) |
| `/api/announcements` | idem | 60 s | `CACHE_PATHS.announcements` (3) |
| `/api/attendance/stats`, `/api/incidents/statistics`, `/api/analytics/students` | idem | 60 s | `/api/attendance/stats` (2), `/api/analytics` (8) |
| `/api/finance/stats` | idem | 120 s | `/api/finance/stats` (8) |
| `/api/grades/statistics` | `…:<userId>:<écoleActive>` | 60 s | `/api/grades/statistics` (4) |
| `/api/analytics` | idem | 120 s | `/api/analytics` (8) |
| `/api/analytics/dashboard` | `…:<userId>:<écoleActive>,<écoles accessibles triées>` | 60 s | `/api/analytics` (8) |

**Les durées documentées « 1 semaine / 1 jour / 1 heure / sans cache » ne sont pas confirmées dans le code.** Les durées réelles vont de 30 à 300 s. La valeur par défaut de 3 600 s (`redis.ts:117,196,247`) n'est jamais utilisée par `withCache`, qui passe toujours une durée. `src/lib/cache/warm.ts` n'est appelé nulle part : il ne place que des marqueurs factices.

**Périmètre de partage** : aucune entrée n'est partagée entre deux comptes, puisque chaque clé contient `userId`. Le changement d'école est couvert par la clé (`cacheScope`, `cache-helpers.ts:39`) et testé.

### 6.2 Mémoïsation en mémoire (`memoizeAsync`, `src/lib/cache/memo.ts`)

| Calcul | Clé | Durée | Invalidation |
|---|---|---|---|
| Moyennes de classe (`computeClassPeriod/Annual`) | arguments + **portée RLS** (`dbScopeKey`) | 15 s | `onModelWrite` sur 10 modèles (`class-averages.ts`) |
| Tableaux de bord (`analytics-dashboard/index.ts:30-63`) | école/année/filtres (+ `userId` pour les vues personnelles) | 60 s / 30 s | aucune (expiration) |
| Finance (`finance/dashboard/route.ts:34`), vue d'ensemble (`analytics/school/overview/route.ts:62`) | école/année/période | 60 s | aucune |

Désactivée sous Vitest (`NODE_ENV=test`), donc **non couverte par les tests d'intégration** (R-CA-04).

### 6.3 Caches client

| Mécanisme | Portée | Risque |
|---|---|---|
| SWR (115 fichiers) | Mémoire de l'onglet, clé = URL. Purge totale au changement d'école | Les états `useState` alimentés par `useEffect` ne sont pas purgés : `router.refresh()` ne réinitialise pas l'état client (R-CA-05, non testé) |
| Service worker Serwist | Cache Storage du navigateur, 24 h, clé = URL | **MS-03** |
| localStorage | 12 fichiers. Brouillon d'inscription (**MS-04**), brouillon de saisie de notes (clé `classe:matière`, effacé à l'enregistrement), historique de rapports, préférences | Brouillon de notes conservé sur l'appareil si la saisie est abandonnée (faible) |
| Cache Next.js | `force-dynamic` sur le layout ; `revalidate = 0` sur `explorer/*`. Aucun `unstable_cache` ni `"use cache"` | — |

### 6.4 Repli mémoire : analyse

- **Instance unique** (déploiement documenté : `docs/EXPLOITATION.md`, un serveur) : le repli est adapté. Le cache est borné et l'invalidation locale est complète.
- **Plusieurs processus ou instances sans Redis** : chaque processus a son cache. Une invalidation n'atteint que le processus qui a traité l'écriture. Les autres servent l'ancienne valeur jusqu'à la fin de la durée (≤ 300 s). Ce n'est pas une fuite entre comptes (clé par utilisateur), mais l'affichage reste périmé.
- **Panne Redis puis retour** :
  - pendant la panne, `clear()` n'efface que la mémoire locale (`redis.ts:208-215`, `273-289`, repli `() => undefined`) ;
  - au retour, Redis resert les entrées écrites **avant** la panne, que l'invalidation a manquées, jusqu'à la fin de leur durée ;
  - Upstash `clear()` utilise `KEYS` (`redis.ts:212`), bloquant sur une grosse base (la variante TCP utilise `SCAN`).
- **Invalidation après écriture** : appelée après la transaction, échec ignoré (`.catch(() => {})`, par exemple `payments/webhook/route.ts`). Aucun cas d'invalidation **avant** validation n'a été trouvé dans les routes de notes revues.

## 7. Risques non confirmés et tests manquants

| ID | Risque | Test nécessaire pour conclure |
|---|---|---|
| R-MS-05 | Énumération de comptes par le temps de réponse : `authorize` sort sans bcrypt si l'email est inconnu (`config.ts:181`) | Mesurer la distribution des temps de réponse, compte existant contre inexistant |
| R-MS-06 | MS-01 étendu au personnel dont `User.schoolId` ou le rôle change (`PATCH /api/root/users`, `PATCH /api/teachers/[id]`) | Même scénario que MS-01 avec un SCHOOL_ADMIN déplacé |
| R-MS-07 | Jetons de réinitialisation de mot de passe stockés en clair (`forgot-password/route.ts:58-64`) | Revue ; risque seulement en cas de lecture de la base |
| R-MS-08 | Désactivation de compte effective au bout de 30 s **par processus** (`config.ts:77`) | Test multi-processus |
| R-CA-04 | Valeurs mémoïsées partagées entre contextes RLS différents pour une même clé école (tableaux de bord) : sûr aujourd'hui, car l'appelant a l'école dans son contexte, mais non protégé structurellement | Test avec mémoïsation activée (`enabled: true`) et deux contextes |
| R-CA-05 | Requêtes en vol et états React hors SWR pendant un changement d'école | Test composant ou E2E |
| R-CA-06 | Flux SSE `/api/notifications/stream` : une connexion Redis par onglet ou une requête en base toutes les 5 s par client. Aucun écran ne le consomme aujourd'hui | Test de charge si réactivé |
| T-MS-01 | Aucun test d'un SCHOOL_ADMIN/NETWORK_ADMIN multi-écoles sur les routes de collection | Étendre le balayage d'isolation |

## 8. Limites du modèle `User.role`

1. **Un rôle par compte**, et un compte par email (`User.email @unique`). Une personne enseignante et parente doit avoir deux comptes avec deux emails. Le code ne prévoit pas d'autre combinaison.
2. **Le rôle est global** : un enseignant multi-écoles est enseignant partout. Impossible d'être directeur dans A et enseignant dans B.
3. **`User.roles[]` est trompeur** : il élargit l'interface (`use-rbac.ts`) sans aucun effet serveur. Toute divergence produit des boutons visibles mais refusés.
4. **Rattachements hétérogènes** : enseignant (`TeacherSchoolAssignment`), réseau (`OrganizationMembership`), parent (déduit des enfants), direction (annexes). Quatre règles différentes calculées dans `school-access.ts`, sans modèle « rattachement » commun.
5. **Recalcul des droits seulement à la connexion ou au changement d'école** (MS-01).

## 9. Options architecturales (comparaison, sans implémentation)

| Option | Sécurité | Complexité | Maintenabilité | Performance | Migration | Impact existant |
|---|---|---|---|---|---|---|
| 1. Un compte par école | Isolation simple | Faible côté code, élevée pour l'utilisateur (N mots de passe) | Doublons d'identité, RGPD plus difficile | Neutre | Scission de comptes existants | Contraire à la décision validée (compte unique + invitation) |
| 2. Compte unique + rattachements (actuel) | Bonne si les droits suivent les rattachements (MS-01 à corriger) | Moyenne | Quatre règles de rattachement à unifier | Bonne | Aucune | — |
| 3. Compte unique + rôle **par rattachement** + contexte explicite | La meilleure finesse (rôle A ≠ rôle B) | Élevée : toutes les vérifications `session.user.role` deviennent `roleIn(activeSchool)` | Bonne à terme | Un rattachement chargé par requête (cache) | Table `Membership(userId, schoolId, role)`, migration de `User.role` | Touche 499 gestionnaires (rôles autorisés) et la RLS |
| 4. Base partagée, isolation applicative seule | Un filtre oublié suffit à fuir | Faible | Fragile | Bonne | — | Régression par rapport à aujourd'hui |
| 5. Base partagée + RLS PostgreSQL (actuel, 16 tables) | Défense en profondeur réelle (tests verts) | Moyenne (pièges documentés : promesses paresseuses, `_count`) | Bonne | Coût RLS mesuré faible ; non mesuré à grande échelle | Étendre la RLS table par table | — |
| 6. Bases séparées | Isolation maximale | Très élevée (migrations ×N, réseau inter-écoles) | Difficile | Bonne par école, mauvaise pour le réseau | Lourde | Contredit la vue réseau et les enseignants multi-écoles |

**Recommandation argumentée.**
- **Conserver 2 + 5** et corriger MS-01 à MS-04 de façon ciblée : aucune refonte n'est nécessaire.
- Étendre la RLS aux tables encore protégées par l'application seule, en priorité `enrollments`, `classes`, `payment_plans`, `student_analytics`, `users`. Liste complète en annexe A3, colonne RLS vide.
- L'option 3 ne se justifie **que si** le métier confirme qu'une même personne doit avoir des fonctions différentes selon l'école (Q-ROLE-01). Elle se ferait alors progressivement : table de rattachements unifiée, d'abord en lecture seule pour calculer `accessibleSchoolIds`, puis rôle par rattachement.

## 10. Plan de correction priorisé

| Priorité | Constat | Mesure | Test |
|---|---|---|---|
| **Bloquant avant ouverture publique** | MS-03 service worker | `NetworkOnly` pour `/api/` et les pages du tableau de bord, purge à la déconnexion | E2E hors-ligne |
| **Bloquant** | MS-01 révocation | Écrire `roleChangedAt` (ou un compteur de version d'accès) à chaque retrait, changement d'école ou de rôle ; ou recalcul à 30 s | 2 `it.fails` → verts |
| Important | MS-04 brouillon | Clé par utilisateur et école, effacement après succès et déconnexion | Test composant |
| Important | MS-02 lecture des notes | Selon la décision Q-ROLE-03 | `it.fails` → vert |
| Important | MS-05 `root/users` | Liste blanche Zod + journal + `roleChangedAt` | Test API |
| Important | `roleChangedAt` jamais écrit | Le renseigner dans les routes qui changent le rôle | Test d'intégration |
| Amélioration | Redis `KEYS`, invalidations locales, `warm.ts` mort | `SCAN` côté Upstash, suppression de `warm.ts` | Unitaire |
| Amélioration | RLS étendue | Table par table | `rls-effective` |
