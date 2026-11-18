# Audit global de clôture — EduPilot (2026-10-25)

> Rapport factuel. Chaque constat indique son niveau de preuve : **code** (lu), **tests auto** (exécutés dans cette session), **navigateur** (Playwright contre un serveur de production isolé), **service externe**, **production**. Les anciens rapports n'ont servi que de pistes.

## A. Synthèse exécutive

**Réponse courte : non, EduPilot ne peut pas encore être considéré comme prêt pour la production.** Le cœur métier testé est cohérent et l'isolation financière des écoles tient (code + tests + navigateur), mais quatre points bloquent :

1. **Dépendances vulnérables** : `npm audit` signale 2 vulnérabilités critiques en production, dont Next.js 16.3.8 (exécution de code à distance via l'optimiseur d'images avec des SVG, corrigée en 16.4.3) et `@sentry/nextjs`. Exploitabilité non vérifiée, montée de version requise.
2. **Image Docker non constructible** : `docker build` échoue à `npm ci`. Cause établie après l'audit : le Dockerfile ne copiait pas `.npmrc` (`legacy-peer-deps=true`), donc npm 11 exigeait des peer dependencies absentes du lockfile. Le lockfile lui-même est accepté par npm 11.19.1 quand `.npmrc` est présent. Correctif appliqué au Dockerfile (non commité), construction de l'image **à revérifier**.
3. **TD-025 ouvert** : aucune procédure pour libérer ou rapprocher à la main un paiement en ligne resté incertain (montant réservé indéfiniment).
4. **Chaîne de paiement réelle jamais prouvée** : aucune recette FedaPay sandbox (pas d'identifiants), donc redirection, webhook signé réel et refus réel non validés contre le prestataire.

**Validé dans cette session** : souveraineté financière (aucun nouveau paiement possible sans compte marchand propre à l'école, webhook d'un autre compte refusé), parcours parent (périmètre enfant, paiement indisponible sans compte, retour forgé sans effet), vie scolaire (appel + incidents), cumul de rôles borné au rôle principal (serveur, menus, et désormais gardes de page), 128 pages × 9 profils sans erreur JS ni HTTP, sauvegarde chiffrée + restauration réelle vérifiée table par table.

**Défauts UX/UI majeurs** : texte sous 12 px très répandu (713 occurrences), onglets du calendrier coupés à 375 px, messages d'erreur génériques là où un refus explicite serait attendu, tableau BI du super-admin qui affiche une erreur au lieu de demander une école.

**Limites** : pas de compte NETWORK_ADMIN, d'utilisateur multi-écoles ni d'élève hors école principale dans le seed (ces cas reposent sur les tests d'intégration, pas sur le navigateur) ; pas d'accès au registre GHCR ; pas de test de charge ; pas de lecteur d'écran réel.

**Verdict : NON PRÊT** (section K).

## B. État Git et périmètre

| | |
|---|---|
| Branche | `feat/enseignant-multi-ecoles` |
| HEAD au début de l'audit | `abb62a5` (7 commits locaux créés juste avant, à la demande : `2c97d4d`, `079cdc0`, `dbdc609`, `cbdb997`, `a856c65`, `767cdec`, `abb62a5`) |
| Non suivi au début | `.claude/` (préservé, non lu, non modifié) |
| Modifié pendant l'audit (non commité) | `src/lib/hooks/use-rbac.ts` (correction AUD-06), `tests/lib/hooks/use-rbac.test.ts` (nouveau), ce rapport |
| Sondes temporaires | `e2e/zz-audit/` (déplacées hors du dépôt en fin d'audit) |
| Commits / push / déploiement pendant l'audit | **aucun** |
| Données | uniquement une base PostgreSQL jetable (cluster embarqué, port 5437, marquée jetable), seed de démonstration du projet ; aucun paiement, aucun appel à un prestataire (proxy sortant coupé) |

## C. Skills utilisés

| Skill | Présent ? | Invoqué ? | Domaine utilisé | Apport vérifiable |
|---|---|---|---|---|
| UI UX Pro Max (`~/.claude/skills/ui-ux-pro-max`) | Oui | **Oui** | UX/UI | Grille de priorités (accessibilité, zones tactiles, responsive, formulaires, navigation) appliquée ; recherche `--domain ux` (tableaux en mobile, z-index, validation, types de champs, autocomplete) traduite en mesures statiques (§F) et en critères de la sonde navigateur (débordement, éléments < 24 px, axe) |
| Skills frontend/design (`impeccable`, `taste-skill`, `redesign-skill`…) | Oui (répertoire) | Non | — | Non utilisés : la grille UI UX Pro Max suffisait pour un audit (pas de refonte) |
| Skills accessibilité dédiés | Non trouvés | Non | — | Contrôle via axe-core (`@axe-core/playwright` du projet) |
| Skills sécurité (ECC) | Agents ECC disponibles | Non | — | Revue de sécurité conduite à la main (§G) ; aucun agent lancé |
| Skills tests/QA (ECC e2e) | Disponibles | Non | — | Playwright piloté directement (sondes + suite E2E du projet) |
| `web-perf` | Oui | Non | — | Mesures de temps de chargement issues du balayage seulement |

## D. Cartographie

- **Volume** : 183 pages, 319 routes API (316 via `createApiHandler` ; les 3 autres sont deux réexports et le routeur NextAuth), 132 modèles Prisma, 9 rôles (`UserRole`) + `roles[]` secondaires.
- **Autorisation** : `createApiHandler` (rôles via `roleSatisfies` sur le **rôle principal**, permissions de la matrice, périmètre d'école `schoolIdsByRole`), RLS PostgreSQL forcée sur les tables sensibles avec rôle applicatif `edupilot_app`, gardes client `PageGuard`/`useRBAC`/`RoleActionGuard`, menus `role-nav.ts`.
- **Routes publiques** (`requireAuth: false`) : authentification (inscription libre **désactivée**, `REGISTER_DISABLED`), installation initiale (refusée dès qu'un utilisateur existe), webhooks (signés), tâches système (`CRON_SECRET`), santé, vitrine/explorateur (écoles publiées seulement pour l'anonyme).
- **Finance** : frais → échéancier → paiements (guichet, en ligne) ; `online-payments.ts` (réservation, verrou par élève+frais, confirmation unique, liaison prestataire + compte marchand) ; comptes marchands par école (`school-accounts.ts`, secrets chiffrés `secret-box`) ; anciens adaptateurs à identifiants globaux (MoMo, Flutterwave, Paystack, FedaPay global) **conservés uniquement pour les paiements historiques** (vérification, anciens webhooks).
- **Non couvert dans cette session** : LMS, bibliothèque, transport, cantine, RH/paie, signatures, alumni, contrôle d'accès QR (présents ; seulement leurs pages de menu ont été chargées quand un rôle y avait accès).

## E. Matrice des parcours

| Profil / parcours | Attendu | Observé | Niveau de preuve |
|---|---|---|---|
| SUPER_ADMIN : pages globales | ouvertes | 8 pages de menu OK (bureau + 375) | navigateur |
| SUPER_ADMIN : analyses sans école | demande de choisir une école | carte d'erreur « Établissement requis » (API 400 voulue) | navigateur + code → AUD-11 |
| SUPER_ADMIN : changement d'école | cache vidé | `mutateAll(() => true)` + `router.refresh()` | code + test composant ; **pas navigateur** |
| NETWORK_ADMIN | écoles du réseau seulement | — | tests unitaires (`api-handler-role-stacking`) + intégration (`organization-*`) ; **aucun compte dans le seed, pas navigateur** |
| SCHOOL_ADMIN / DIRECTOR | tableau de bord, élèves, notes, appel, finance, paramètres | 8 pages chacun OK, 375 OK | navigateur |
| TEACHER : saisie de notes | ouverte, ses classes | page ouverte, `?mine=1` = ses classes | navigateur ; refus classe non enseignée : intégration (`teacher-grade-access`) — le seed ne permet pas de le montrer (l'enseignant de démo a les 28 classes) |
| ACCOUNTANT : encaissement | 3 clics, 2xx | 3 clics, 2xx (passe du 2026-10-24) ; création d'un admin refusée 403 | navigateur |
| STAFF : appel + incident | enregistrement réussi | appel 200, incident ouvert, bureau + mobile | navigateur + intégration |
| STAFF + TEACHER (secondaire) | droits du rôle principal seulement | menu STAFF ; saisie de notes **ouverte avant correction**, « Accès refusé » après | navigateur (avant/après) + test unitaire |
| PARENT : enfants, finance | ses enfants ; paiement indisponible sans compte marchand | 1 enfant ; autre élève 404 ; « Paiement en ligne indisponible… économat » ; initiation 503 `ONLINE_PAYMENT_UNAVAILABLE` sans lien de paiement | navigateur + intégration (35 tests parcours parent) |
| PARENT : fiche d'un élève non lié | refus explicite | aucune donnée, mais « Une erreur est survenue / Réessayer » | navigateur → AUD-12 |
| PARENT : retour de paiement forgé (`?status=success`) | aucun effet | pas de « Paiement confirmé » (statut lu en base par référence) | navigateur + code + intégration (`payment-status-return`) |
| STUDENT | son dossier seulement | finance : soi seul ; autre élève 404 ; incidents d'un autre : liste vide | navigateur |
| Paiement en ligne → webhook | confirmation unique, montant/devise/compte vérifiés | conforme | intégration (`online-payment-*`, `payment-fedapay-flow`, `school-payment-accounts`) ; **jamais contre FedaPay** |
| Paiement espèces → reçu | reçu après validation | reçu refusé tant que non VERIFIED/RECONCILED | intégration (`cash-payment-validation`, `payments-invoice`) |
| Sauvegarde → restauration | restauration fidèle | 133 tables, 240 218 lignes, aucun écart | **exécution réelle** sur base jetable ; redémarrage de l'app sur la base restaurée **non testé** |

Frictions mesurées : encaissement 3 clics (élève unique sélectionné d'office) ; paiement parent depuis l'accueil 1 clic jusqu'à la vue de l'enfant ; temps de chargement des pages (serveur local, données de démo) médiane 1,6 s, p90 2,1 s.

## F. Audit UX/UI (grille UI UX Pro Max)

| Catégorie | Constat | Où | Impact | Correction / critère |
|---|---|---|---|---|
| Typographie (priorité 6) | 713 occurrences de texte < 12 px (`fontSize: 9-11`, `text-[9-11px]`) | `src/**/*.tsx` | lisibilité mobile, utilisateurs âgés | plancher 12 px (libellés) / 14-16 px (corps) ; critère : 0 occurrence < 12 px hors badges décoratifs |
| Responsive (5) | onglets Mois/Évènements/Vacances/Fériés dépassent de 12 px, « Fériés » coupé, sans défilement | `/dashboard/calendar` à 375 px | onglet difficilement atteignable | `flex-wrap` ou `overflow-x-auto` ; critère : aucun élément de `main` au-delà de 375 px |
| Responsive (5) | 15 fichiers avec `<table>` sans enveloppe `overflow-x` | pages tableaux | risque de débordement (aucun observé sur les 128 pages visitées) | envelopper ; critère : sonde 375 px verte sur ces pages |
| Accessibilité (1) | `scrollable-region-focusable` (axe, sérieux) | `/dashboard/orientation/me` (élève) | zone défilante inaccessible au clavier | `tabIndex={0}` + nom accessible |
| Accessibilité (1) | axe sur 64 pages bureau : 1 seule violation sérieuse/critique | `main` de chaque page de menu | bon niveau sur les contrôles automatisés | **ne vaut pas conformité WCAG 2.2** (pas de lecteur d'écran, pas de parcours clavier complet) |
| Style (4) | emoji « 🔒 » comme icône de la page « Accès refusé » ; ~10 emoji dans les composants | `PageGuard` | rendu dépendant de la police | icône SVG du système |
| Couleurs (6) | 101 couleurs hexadécimales en dur dans les `.tsx` | composants | thème sombre/contrastes non garantis | jetons `--eduflow-*` |
| États / messages (8) | élément non autorisé → « Une erreur est survenue, Réessayer » | fiche élève non liée (parent) | l'utilisateur réessaie en vain | message « Vous n'avez pas accès à cette fiche » |
| États (8) | tableau BI sans école → carte d'erreur | `/dashboard/analytics` (super-admin) | impression de panne | ne pas appeler l'API ; inviter à choisir l'établissement |
| Interaction (2) | ≈ 1 élément cliquable < 24 px par page (moyenne) | toutes pages | cible tactile faible | ≥ 44 px sur mobile pour les actions principales |
| Formulaires (8) | 5 `autoComplete="off"` | formulaires | autofill bloqué | ne garder que pour codes à usage unique |
| Navigation (9) | menus : rôle principal seulement, cohérents avec le serveur (vérifié pour STAFF, STAFF+TEACHER) | barre latérale, mobile, palette | — | validé |

## G. Registre des risques

| ID | Domaine | Constat | Prio | État | Preuve | Prochaine action |
|---|---|---|---|---|---|---|
| AUD-01 | Sécurité | `npm audit --omit=dev` : 2 critiques (`next` 16.3.8 RCE optimiseur d'images SVG → 16.4.3 ; `@sentry/nextjs` contournement via route tunnel), 4 hautes (`follow-redirects`, `sharp`/librsvg, `source-map-js`, `zod`), 1 modérée (`nodemailer`). L'optimiseur d'images est actif et `remotePatterns` autorise `*.amazonaws.com` | P0 | OUVERT | commande exécutée ; `/_next/image` répond ; exploitabilité **non vérifiée** | monter `next` ≥ 16.4.3 et les autres ; restreindre `*.amazonaws.com` au compartiment de l'école ; rejouer tests + build |
| AUD-02 | Déploiement | image Docker non constructible : `npm ci` refusait le lockfile (manque `webpack@5.112.2`…) car l'étape `deps` ne copiait pas `.npmrc` (`legacy-peer-deps=true`). Avec `.npmrc`, npm 11.19.1 accepte le lockfile (`docker run … node:24-alpine npm ci --dry-run`, exécuté par le responsable) | P1 | CORRIGÉ, À REVALIDER (Dockerfile non commité) | `docker build` exit 1 avant ; cause confirmée par lecture du Dockerfile, de `.npmrc` et de `.dockerignore` | `docker build`, démarrer l'image contre une base jetable, vérifier l'absence de `.env` et de secrets |
| AUD-03 | Finance | TD-025 : paiement en ligne sans issue définitive → aucune libération/rapprochement manuel | P1 | OUVERT (décision) | `TECH_DEBT.md` §TD-025 | décider qui libère, avec quelle preuve, journal d'audit |
| AUD-04 | Finance | chaîne FedaPay réelle jamais validée (redirection, webhook signé réel, refus) | P1 | NON VÉRIFIÉ | aucune clé sandbox ; procédure `docs/recette-fedapay-sandbox.md` | fournir 2 comptes sandbox + URL HTTPS publique, dérouler les 13 scénarios |
| AUD-05 | Rôles | rôles secondaires sans effet (garde = rôle principal) ; un cumul réel exige de migrer ~409 décisions de route | P2 | OUVERT (décision) | code + tests `api-handler-role-stacking` | décider : cumul abandonné (retirer `roles[]` de l'UI d'attribution) ou migration par module |
| AUD-06 | Rôles | `useRBAC` (gardes de page) lisait `roles[]` : STAFF+TEACHER ouvrait la saisie de notes que l'API refuse | P2 | CORRIGÉ, À REVALIDER (non commité) | navigateur avant/après ; `tests/lib/hooks/use-rbac.test.ts` 3/3 | relancer la suite complète, commiter |
| AUD-07 | Finance | souveraineté : initiation uniquement via le compte de l'école (`resolveCollectingAccount`) ; sans compte → 503 + économat ; webhook global ou d'un autre compte refusé (`accountBindingMismatch`) | P0 si cassé | VALIDÉ (code + intégration + navigateur) | tests `school-payment-accounts`, `online-payment-binding`, `payment-collection-guard` | — |
| AUD-08 | Finance | anciens adaptateurs à identifiants globaux toujours présents (vérification d'anciens paiements, anciens webhooks) | P3 | OUVERT | `finance/factory.ts`, `automation.service.ts` | plan de retrait une fois les paiements historiques soldés |
| AUD-09 | Sauvegardes | sauvegarde chiffrée (AES-256, sha256, 600/700, rétention 30 j / min 7) + restauration vérifiée par comptage | — | VALIDÉ (base jetable) | exécution réelle | tester redémarrage de l'app et droits `edupilot_app` après restauration |
| AUD-10 | Déploiement | visibilité du registre GHCR | P2 | NON VÉRIFIÉ | pas d'accès registre | vérifier avec un compte du dépôt |
| AUD-11 | UX | BI super-admin sans école : erreur au lieu d'invitation | P3 | OUVERT | navigateur | cf. §F |
| AUD-12 | UX | refus d'accès affiché comme erreur générique (fiche élève non liée) | P3 | OUVERT | navigateur | cf. §F |
| AUD-13 | Responsive | calendrier 375 px, onglet coupé | P2 | OUVERT | navigateur | cf. §F |
| AUD-14 | Lisibilité | 713 textes < 12 px | P2 | OUVERT | mesure statique | cf. §F |
| AUD-15 | Performance | 81 routes avec `findMany` sans limite visible (beaucoup naturellement bornées) | P3 | NON VÉRIFIÉ (risque déduit) | grep | revue route par route + test de charge autorisé |
| AUD-16 | Sécurité | 316/319 routes via `createApiHandler` ; routes publiques justifiées ; session JWT 24 h, rôle relu en base à chaque requête, révocation testée | — | VALIDÉ (code + intégration) | `session-*-revocation` | attributs de cookie à confirmer en HTTPS réel |
| AUD-17 | Couverture | NETWORK_ADMIN, multi-écoles, élève d'une autre école : pas de données de seed → aucune preuve navigateur | P2 | NON VÉRIFIÉ (navigateur) | seed | enrichir le seed de recette |
| AUD-19 | Tests | suite E2E du projet non rejouée dans les conditions CI ; échec `class-lists` « Nouvelle évaluation » à qualifier (défaut ou donnée du seed) | P2 | NON VÉRIFIÉ | journal Playwright partiel | relancer avec `RATE_LIMIT_RELAXED=true`, hors `recette/` sur base ensemencée, `recette/` sur base vierge |
| AUD-18 | Dette | `navGroupsForAssignedRoles` / `navForAssignedRoles` inutilisés (travaux du 2026-10-23) | P3 | OUVERT | grep | supprimer si le cumul est abandonné |

## H. Résultats des tests (exécutés dans cette session)

| Commande | Résultat | Environnement |
|---|---|---|
| `npx tsc --noEmit -p .` | 0 erreur (sur chacun des 7 commits, en worktree, et après correction `use-rbac`) | local |
| `npm run -s lint` | 0 erreur / 0 avertissement (HEAD `abb62a5`) | local |
| `npm run -s test` | 397 fichiers, **4359 réussis, 11 ignorés**, 0 échec (HEAD `abb62a5`, avant correction `use-rbac`) | vitest |
| `npx vitest run tests/lib/hooks/use-rbac.test.ts tests/components` | 3/3 (nouveau) ; composants 91/91 | vitest |
| `npm run -s test:integration` | 90 fichiers, **780/780** (HEAD `abb62a5`) | PostgreSQL jetable |
| `npx vitest run tests/lib/openapi.test.ts` | 6/6 sur chacun des 7 commits | worktrees |
| `npm run -s build` | vert ; `.env` retiré du standalone ; « aucun secret » (9 valeurs recherchées) | local |
| `docker build -t edupilot-audit:local .` | **échec** (`npm ci`, lockfile) | Docker local, pas de push |
| `npm audit --omit=dev` | 7 vulnérabilités (2 critiques, 4 hautes, 1 modérée) | registre npm |
| Sauvegarde + restauration (`scripts/backup/*.sh`) | réussies, 0 écart | conteneur `postgres:16`, base jetable |
| Sonde navigateur « balayage » | 18 sessions, 128 pages, 0 erreur JS, 0 erreur HTTP de page, 1 violation axe sérieuse, 2 débordements (calendrier 375) | Playwright, serveur standalone isolé |
| Sonde navigateur « parcours » | 16 contrôles : 13 conformes, 2 défauts (AUD-06 corrigé puis revérifié, AUD-12), 1 erreur de sonde (POST `/api/grades` inexistant → 405, ne prouve rien) | idem |
| Suite E2E du projet (`E2E_NO_SERVER=1 E2E_BASE_URL=… npx playwright test`) | **non concluante, interrompue** : 204 tests listés, ~69 exécutés. Échecs dominés par `e2e/recette/*` (conçus pour une application vierge avec capteur de courriels, ici base ensemencée → échecs d'environnement) et par des délais de connexion probablement dus à l'absence de `RATE_LIMIT_RELAXED=true` que la CI fournit. Un échec à examiner dans la suite de base : `class-lists.spec.ts` « page Notes : la fiche Nouvelle évaluation… » (bouton introuvable en SCHOOL_ADMIN). Relance avec la configuration CI impossible : l'outil d'exécution est devenu indisponible en fin de session | serveur isolé, base jetable |

**Non exécutés** : suite unitaire complète après la correction `use-rbac` (à relancer), suite E2E du projet dans les conditions de la CI (à relancer), test de charge, lecteur d'écran, recette sandbox, redémarrage de l'app sur base restaurée, image Docker (bloquée par AUD-02).

**Déduction corrigée** : la CI exécute `npm ci` sous Node 24, mais sur le dépôt complet, `.npmrc` compris. Elle ne devrait donc pas être touchée par AUD-02. Branche non poussée, donc non observé.

## I. Décisions métier requises

1. **TD-025** : qui peut libérer/rapprocher un paiement incertain, sur quelle preuve (relevé prestataire), avec quel journal.
2. **Cumul de rôles** : abandon (un seul rôle par compte, UI d'attribution à simplifier) ou migration progressive des décisions de route.
3. **Remboursements** en ligne : rester hors application (FedaPay) ou être tracés dans EduPilot.
4. **Anciens prestataires** (MoMo, Flutterwave, Paystack globaux) : date de retrait une fois les paiements historiques soldés.
5. **Seuil de lisibilité** : taille minimale de texte imposée au système de design.

## J. Plan de correction priorisé

| Lot | Objectif | Résout | Tests de validation | Clôture |
|---|---|---|---|---|
| 1 | Dépendances | AUD-01 | `npm audit` 0 critique/haute en prod ; unit + intégration + build + E2E | aucune critique ouverte |
| 2 | Image Docker | AUD-02, AUD-10 | `docker build` vert ; image sans `.env` ni secret ; démarrage contre base jetable | image démarrée et testée |
| 3 | Paiements incertains | AUD-03 (après décision) | tests d'intégration libération/rapprochement + droits | procédure en place et journalisée |
| 4 | Recette sandbox | AUD-04 | 13 scénarios × 2 écoles | tous conformes |
| 5 | Rôles | AUD-05, AUD-06, AUD-18 | tests d'escalade par module | décision appliquée partout |
| 6 | UX/UI | AUD-11..14, §F | sonde 375 px + axe sur toutes les pages, pas seulement les menus | 0 débordement, 0 axe sérieux |
| 7 | Couverture | AUD-15, AUD-17 | seed de recette enrichi, test de charge autorisé | parcours NETWORK_ADMIN/multi-écoles prouvés en navigateur |

Aucun lot UX ne doit contourner une permission ou une règle financière.

## Addendum — stabilisation sécurité et déploiement (même jour, après l'audit)

Modifications **non commitées** ; chaque point a été exécuté, pas déduit.

| Constat | Ce qui a été fait | Preuve |
|---|---|---|
| AUD-01 dépendances | `next` et `eslint-config-next` 16.3.8 → **16.4.3** ; `zod` → **4.6.7** (même majeure) ; `npm audit fix` sans `--force` | `npm audit --omit=dev` : **0 vulnérabilité** |
| Régression introduite par Next 16.4.3 | `statfs(process.cwd())` dans `src/lib/system/host-status.ts` faisait tracer tout le dépôt (route `/api/root/monitoring` : 6 314 fichiers ; `tests/`, `docs/`, `coverage/` copiés dans `.next/standalone`). Le contrôle des secrets de l'artefact l'a **refusé** (clé privée factice d'un test). Correctif : `/* turbopackIgnore: true */` sur les 3 accès disque | build local vert, 362 fichiers tracés, aucune route ne trace `tests/`/`e2e/`/`docs/`/`coverage/` ; tests `host-status` 20/20 |
| `zod` 4.6 | dates-heures ISO désormais **secondes obligatoires** ; les 5 formulaires `datetime-local` convertissent par `toISOString()`, donc conformes ; OpenAPI régénérée (formats d'e-mail et de date décrits autrement) | test OpenAPI 6/6 |
| AUD-02 image Docker | 4 défauts successifs : (1) `.npmrc` non copié ; (2) `prisma/schema.prisma` absent au `postinstall` ; (3) `docs/openapi.json` et `scripts/build/` exclus par `.dockerignore` ; (4) **à l'exécution**, CLI Prisma incomplète (`Cannot find module 'effect'`) : le conteneur s'arrêtait avant de servir. CLI désormais installée avec ses dépendances dans `/opt/prisma-cli` | `docker build` exit 0 (Next 16.4.3) ; image 231 Mo, utilisateur `nextjs`, aucun `.env*` sous `/app`, ni `src/` ni `tests/` ni `docs/` |
| AUD-09 redémarrage sur base restaurée | image démarrée contre la base restaurée : migrations « No pending », mais **500 sur toute requête** (`relation does not exist`) : la restauration recrée le schéma `public` et le rôle `edupilot_app` perd son droit d'usage. Après `setup-app-role.mjs` : tout répond. Étape ajoutée à `docs/EXPLOITATION.md` §4.3 et rappel en fin de `postgres-restore.sh` | `/api/health`, `/login`, `/api/public/plans`, `/api/public/schools` : 200 ; `/dashboard` : 307 |
| AUD-06 `use-rbac` | suite unitaire complète relancée | 398 fichiers, **4362 réussis**, 11 ignorés |
| Validation après montée de version | typage, lint, unitaires, intégration | tsc 0, lint 0, unitaires 4360/4362 au premier passage (OpenAPI à régénérer ; test de délai Redis faussé par la charge, 3/3 en isolé), **intégration 780/780** |
| AUD-19 E2E | suite de base du projet, conditions CI (`RATE_LIMIT_RELAXED=true`), hors `recette/` (base vierge requise), `tour/`, `fresh-install/` | **ERRATUM** : annoncé « 88 réussis, 0 échec », c'était faux : `class-lists` échouait aussi (ligne « 1 failed » manquée par un filtrage de texte ; code de sortie non vérifié). Cause démontrée : depuis `7261d3c` (2026-10-14) seul l'enseignant crée une évaluation, le test utilisait le compte administrateur. Test corrigé (compte enseignant, même vérification N25). Rejoué : **89 réussis, code de sortie 0**. Balayage `UI_SWEEP=1` : **12/12** |

Reste ouvert : TD-025, recette FedaPay sandbox, `e2e/recette/` sur base vierge, défauts UX (§F), décisions (§I).

## K. Verdict final

**NON PRÊT.** Un risque P0 (dépendances critiques) et trois P1 (image Docker, TD-025, chaîne de paiement réelle non validée) restent ouverts. Les contrôles d'isolation, de rôles et de paiement effectués sont positifs dans leur périmètre, mais ils ne valent pas preuve d'absence de défaut, et plusieurs domaines (prestataire réel, registre, charge, accessibilité au lecteur d'écran) n'ont pas été vérifiés.
