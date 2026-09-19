# Remise à niveau production — rapport final

> Branche `fix/production-readiness`, 156 commits depuis `main` (`4953cdd`).
> Source de vérité initiale : [`docs/AUDIT.md`](AUDIT.md) du 2026-09-11, **5,8/10**.
> Journal détaillé, lot par lot : [`docs/REMEDIATION_PROGRESS.md`](REMEDIATION_PROGRESS.md).
>
> Toutes les mesures de ce rapport ont été **exécutées**, dans les conditions de
> l'audit : build de production, base jetable seedée (3 écoles, 2 706 comptes,
> 995 élèves, **131 208 notes**, 8 293 présences, 3 328 paiements), serveur
> standalone sur le rôle applicatif `edupilot_app` soumis à la RLS, Upstash
> désactivé, client local. Machine : i7-1355U, 15,6 Go, Node 22.22.3.

---

## 1. Résumé

**Note de réévaluation : 8,2 / 10** (détail et calcul au § 4).

**Le code est prêt pour la production — sous conditions.** Les conditions ne
portent pas sur le code : ce sont les six points du § 7, qui relèvent de toi et
qu'aucun commit ne peut couvrir (machine, HTTPS, sauvegardes hors site,
documents d'information, démarches de conformité, décision sur les paiements
réels).

Ce qui est acquis, prouvé à l'exécution :

- les **3 défauts critiques** et les **6 défauts élevés** sont corrigés, chacun
  couvert par un test de régression ;
- les **10 défauts moyens** sont corrigés ;
- une installation part d'une **base vide**, depuis l'interface seule : vérifié
  de bout en bout sur un **clone neuf** (§ 3) ;
- la sécurité est rejouée à chaque lot : **11/11** contrôles au vert, aux
  limites de production ;
- le parcours des **sept rôles** ne produit **aucune** réponse en erreur, ni au
  delà de 500 ms, ni au delà de 500 Ko.

Ce qui reste, dit franchement : **92 routes d'API sur 288 n'ont aucun test
unitaire** (§ 6), et la page d'accueil publique reste lente sur mobile (§ 3).

---

## 2. Défauts de l'audit

Statuts : **Corrigé** (avec preuve d'exécution) · **Accepté** (décision du
propriétaire) · **Reporté**.

### Critiques

| ID | Statut | Commit | Test de preuve | Mesure avant → après |
|---|---|---|---|---|
| **C1** Migrations hors dépôt | Corrigé | `f4c709e` | Job CI `integration-tests` (`prisma migrate diff --exit-code`) ; clone neuf → `migrate deploy` | `P2021 « table public.users does not exist »` → **34 migrations appliquées**, application démarrée, **sans seed** |
| **C2** CVE critique Next.js | Corrigé | `0fd0302` | `npm audit --omit=dev --audit-level=high` | 4 vulnérabilités (1 critique) → **0** |
| **C3** Endpoints non bornés | Corrigé | `0356461` `20d56d1` `9ae0515` `6965078` `083f228` `7364584` `e6e7725` `8ed0a34` `93f633f` `b62db28` | `tests/integration-db/list-cursor-*.test.ts` (38 cas, PostgreSQL réel) ; `smoke.mjs ALL` | `/api/evaluations` **13,9 s / 99,5 Mo** → **49 ms / 11 Ko** ; `/api/grades/statistics` **timeout 20 s** → **374 ms** (16 ms en cache) |

### Élevés

| ID | Statut | Commit | Test de preuve | Mesure avant → après |
|---|---|---|---|---|
| **H1** `/api/health` inaccessible | Corrigé | `c749ec8` | `security.mjs health` ; `tests/lib/proxy-public-routes.test.ts` | **401** anonyme → **200** ; `/api/health/*` reste protégé |
| **H2** Crons bloqués par le middleware | Corrigé | `c749ec8` | `security.mjs cron` ; `cron-auth.test.ts` | 401 même avec le bon secret → **401 / 202 et 401 / 200** ; comparaison en temps constant |
| **H3** Rate-limit contournable par `X-Forwarded-For` | Corrigé | `3192078` | `client-ip*.test.ts` (14) ; `security.mjs xff` | 130 requêtes à en-tête tournant → **130×200, 0×429** puis **76×200, 54×429** |
| **H4** Connexion sans limite par IP | Corrigé — échecs seulement | `e2b1751` | `auth-login-rate-limit.test.ts` (6) ; `security.mjs bruteforce` | 12 échecs → **12×302, 0×429** puis **10×302, 2×429** ; 30 connexions réussies depuis une même IP : 0 refus |
| **H5** IDOR sur `subjects/categories/[id]` | Corrigé | `563ccb6` | `subject-categories-isolation.test.ts` ; `security.mjs idor` | GET/PATCH/DELETE **200, écriture persistée** → **404 ×3**, rien persisté, rien désactivé |
| **H6** Redis sans délai d'abandon | Corrigé | `1fe4a19` | `tests/lib/redis/outage.test.ts` ; `redis-outage.mjs` | `/api/auth/csrf` **p50 4 319 ms** → **p50 14 / p95 22 ms** |

### Moyens

| ID | Statut | Commit | Test de preuve | Mesure avant → après |
|---|---|---|---|---|
| **M1** `mustChangePassword` décoratif | Corrigé | `6fbd7e2` `89080bd` | E2E premier login forcé ; `must-change-password-gate.test.ts` | Contournable → imposé au middleware ; mot de passe provisoire **unique** par compte |
| **M2** RLS inerte | Corrigé — option (a) | `aa074b9` `005be2d` | `tests/integration-db/rls-effective.test.ts` | Politiques sans effet → **11 tables en `FORCE ROW LEVEL SECURITY`**, rôle applicatif non propriétaire |
| **M3** JSON invalide → 500 | Corrigé | `6cd4595` | `api-body-validation.test.ts` ; `security.mjs json` | **500 ×2** → **400 ×2** (`INVALID_JSON`, `VALIDATION_ERROR` détaillé) + 413 au delà de 1 Mo |
| **M4** Fuite mémoire | Corrigé | `0356461` `2a24ac2` | RSS relevé à chaque batterie | **8 746 Mo** → **391 Mo** après le parcours des 7 rôles |
| **M5** 163 `findMany` sans plafond | Corrigé | `618933d` `0d3a609` `82baca8` `d926558` `9eb7657` `8d2c446` `b62db28` `6911d97` | `list-limit-cap.test.ts` (PostgreSQL réel) | Plafond par défaut dans les helpers ; N+1 remplacés par des requêtes groupées |
| **M6** `.env.example` désaligné | Corrigé | `2851521` `871e686` | `env-documentation.test.ts` (compare le fichier au code) | 18 variables non documentées → **le fichier décrit exactement les variables lues** |
| **M7** Dépendances obsolètes | Corrigé | `0fd0302` | `npm audit` | 15 vulnérabilités tous environnements → 0 en production |
| **M8** 3 E2E en échec | Corrigé | `90930dd` | `npm run test:e2e` | 78/81 → **89/89** |
| **M9** Documentation d'API périmée | Corrigé | `a578eea` `7e69abf` | `tests/lib/openapi.test.ts` (reconstruit et compare) | 4 chemins écrits à la main → **287 chemins, 463 opérations, 45 schémas générés depuis le code et Zod** |
| **M10** Panne DB confondue avec un mauvais mot de passe | Corrigé | `fc28606` | `login-db-outage.test.ts` (vraies erreurs Prisma) | « Email ou mot de passe incorrect » → `service_unavailable`, message juste |

### Faibles

| ID | Statut | Commit | Mesure / décision |
|---|---|---|---|
| **L1** CSP `style-src 'unsafe-inline'` | **Accepté** | `22cefef` | `script-src` est en nonce + `strict-dynamic` ; seul `style-src-elem/attr` garde `'unsafe-inline'`, imposé par les styles en ligne de React et du design system. Retiré, l'interface casse. Risque résiduel au § 6. |
| **L2** `X-XSS-Protection` obsolète | Corrigé | `22cefef` | En-tête retiré (vérifié sur le serveur de production) |
| **L3** Code mort et modules dupliqués | Corrigé | `795c596` `7f506e4` `f6c867e` `dafda24` `0aa07c0` | 3 modules de rate-limit → **1** ; 3 modules d'environnement → **1** ; 10 modules morts et 55 fichiers morts supprimés |
| **L4** `SIGNATURE_SALT` à valeur de repli | Corrigé | `2851521` | Obligatoire en production, démarrage refusé sans lui |
| **L5** `/api/system/backup` expose chemin et `stdout` | Corrigé | `22cefef` | Réponse sans chemin ni sortie de commande |
| **L6** Fichiers de plus de 1 000 lignes | **Reporté** | — | Inventorié dans [`docs/design/INVENTAIRE_UI.md`](design/INVENTAIRE_UI.md) ; relève de la refonte |
| **L7** Cache servi pendant une panne de base, sans indicateur | **Accepté** | — | `/api/health` signale `degraded` / `database: disconnected` ; l'indicateur par réponse reste à faire |
| **L8** `/api/setup` expose `setupNeeded` | **Accepté** | — | Nécessaire au démarrage à vide : la page d'installation doit savoir si elle a lieu d'être. Ne révèle rien d'autre qu'un booléen |
| **L9** Artefacts à la racine | Corrigé | `dafda24` | 55 fichiers supprimés, liste validée point par point |

### Défauts découverts pendant le travail

**70 défauts** (N1 à N70) ont été trouvés en exécutant, en mesurant ou en
écrivant les tests. Le registre complet est dans
[`docs/REMEDIATION_PROGRESS.md`](REMEDIATION_PROGRESS.md). Les plus graves :

| ID | Sév. | Constat | Statut |
|---|---|---|---|
| **N64** | Critique | `instrumentation.js` **absent de la sortie standalone** : en production, aucune validation d'environnement, aucune garde RLS, aucune fermeture propre de Prisma et Redis | Corrigé (`96c3986`) |
| **N1** | Critique | Épuisement mémoire par tout compte authentifié (réponses non bornées construites même après abandon du client) | Corrigé (`0356461`) |
| **N65** | Élevée | `docker build` **échouait** ; l'image n'avait pas été construite depuis des mois | Corrigé (`5808189`) |
| **N66** | Élevée | `docker-compose` publiait PostgreSQL, Redis et n8n sur **toutes les interfaces** : base accessible depuis le Wi-Fi de l'établissement | Corrigé (`877ec17`) |
| **N41** | Élevée | Activation des comptes bloquée dès le 4e derrière une même adresse | Corrigé (`c188894`) |
| **N55** | Élevée | Import d'élèves non confiné à l'école de l'appelant | Corrigé (`4f08d91`) |
| **N15** | Moyenne | Page d'analyse de la console root en **500** depuis le Lot 3 | Corrigé (`67fad66`) |

---

## 3. Performances, avant → après

Mêmes métriques et mêmes conditions que l'audit § 10.1.

### Serveur

| Métrique | Audit (2026-09-11) | Après | Verdict |
|---|---|---|---|
| Démarrage à froid → 1re réponse | 8,8 s | **2,65 s** | ✅ |
| RAM au repos | 236 Mo | 353 Mo | ✅ |
| RAM après la série de tests | **876 Mo** (pic 8 746 Mo au Lot 0) | **391 Mo** | ✅ |
| `/api/students?limit=20` | p50 33 / p95 39 ms | p50 38 / p95 43 ms | ✅ |
| `/api/classes` | p50 16 / p95 19 ms | p50 19 / p95 25 ms | ✅ |
| `/api/grades?classId=` | p50 61 / p95 74 ms, 97 Ko | p50 76 / p95 128 ms, 92 Ko | ✅ |
| `/api/analytics/dashboard` | **p50 845 / p95 904 ms** | **p50 19 / p95 27 ms** (268 ms à froid) | ✅ |
| `/api/evaluations` | **12,2 s, 95,8 Mo** | **49 ms, 11 Ko** | ✅ |
| `/api/grades/statistics` | **> 15 s (timeout)** | **p50 16 / p95 19 ms** (374 ms à froid) | ✅ |
| `/api/scholarships` | 10,5 s | < 500 ms (aucune violation au smoke) | ✅ |
| Smoke, 170 GET | p50 31 / **p95 852 ms**, admin seul | **7 rôles × 167 routes**, p50 21–29 / p95 60–211 ms | ✅ |
| Réponses > 1 s ou > 1 Mo | 35 violations | **0** | ✅ |
| 5xx au smoke | 2 | **0** | ✅ |

### Front

| Métrique | Audit | Après | Verdict |
|---|---|---|---|
| JS client total | 8,25 Mo, 242 fragments | 8,56 Mo, 269 fragments | 🟡 (le total croît, mais ce qui est **chargé par page** baisse) |
| **Préchargement du service worker** | 8,5 Mo à la première visite | **205 Ko** | ✅ |
| JS chargé — tableau de bord | — | 1 046 → **920 Ko** | ✅ |
| JS chargé — page Notes | — | 1 737 → **1 199 Ko** | ✅ |
| Lighthouse `/dashboard` mobile | **0,54** · LCP 4,7 s · **TBT 1 737 ms** | **0,90–0,92** · LCP 2,34 s · TBT 298–338 ms | ✅ |
| Lighthouse `/dashboard` desktop | 0,96 · LCP 977 ms · TBT 145 ms | **1,00** · LCP 756 ms · TBT 11 ms | ✅ |
| Lighthouse `/dashboard/grades` desktop | 0,68 · TBT 1 412 ms · **96 453 Ko** | **1,00** · TBT 6 ms · **403 Ko** | ✅ |
| Lighthouse `/dashboard/students` mobile | — | 0,92 · LCP 2,61 s · TBT 250 ms | ✅ |
| Lighthouse `/dashboard/analytics` mobile | — | 0,88 · LCP 2,44 s · TBT 406 ms | ✅ |
| Accessibilité (toutes pages mesurées) | 0,96–1,00 | **1,00** | ✅ |
| CLS | 0,005 | **0,000** | ✅ |
| Lighthouse accueil publique mobile | **0,63** · LCP 5,1 s · TBT 683 ms | **0,61** · LCP 5,4 s · TBT 686 ms | 🔴 **inchangé** |
| Lighthouse `/login` mobile | 0,75 · LCP 3,9 s | 0,66–0,78 · LCP 4,1–4,6 s | 🟠 |

**La page d'accueil publique n'a pas progressé.** Elle charge 913 Ko de
JavaScript, dont 116 Ko de bibliothèque d'animation, et ses animations sont
déclenchées au défilement — les convertir en CSS demande un observateur
d'intersection et une vérification visuelle au défilement, que je n'ai pas
faite. C'est la page vitrine, pas l'outil de travail quotidien ; le coût et le
risque n'étaient pas justifiés dans ce lot. Inscrit dans `TECH_DEBT.md`.

### Ce qui a produit les gains

| Levier | Effet mesuré |
|---|---|
| Pagination par curseur et agrégation en base (C3) | `/api/evaluations` 13,9 s → 49 ms |
| Cache court sur les deux agrégats les plus lourds | tableau de bord 356 → 18 ms, statistiques 400 → 16 ms |
| Requêtes du tableau de bord mises en parallèle | 356 → 268 ms **à froid** |
| Service worker : préchargement limité à la coquille | 8 736 → 205 Ko à la première visite |
| Graphiques chargés à la demande | page Notes −413 Ko, Finance −399 Ko |
| framer-motion retiré du tableau de bord | **−120 Ko sur chaque page**, écran de connexion compris |
| Code mort retiré du socle | `GlassCard`, `PageTransition`, squelettes animés, palette de commandes |

---

## 4. Grille d'évaluation

Mêmes axes, même barème et mêmes pondérations que l'audit § 11.

| Axe | Audit | Après | Poids | Justification de la note |
|---|---|---|---|---|
| Fonctionnalités (complétude) | 7 | **9** | ×2 | La fonction cœur « notes » tient à l'échelle (131 208 notes, statistiques en 374 ms à froid). Santé et crons fonctionnent. E2E **89/89**, plus un parcours d'installation complet depuis une base vide. Reste : quelques modules périphériques peu éprouvés. |
| Fiabilité et robustesse | 5 | **8** | ×2 | JSON invalide → 400, plafond de corps, coupe-circuit Redis (4,3 s → 22 ms), arrêt propre sur SIGTERM, mémoire stable (391 Mo), panne de base distinguée d'un mauvais mot de passe, écritures transactionnelles et idempotentes. Reste : pas d'indicateur « donnée en cache » pendant une panne (L7). |
| Architecture et maintenabilité | 6 | **8** | ×1 | Migrations versionnées, un seul module de rate-limit, un seul d'environnement, un seul format de pagination, RLS effective, code mort retiré. Reste : deux familles de primitives d'interface et deux jeux de jetons (assumés, design gelé), fichiers de plus de 1 000 lignes. |
| Qualité du code | 7 | **8** | ×1 | 0 erreur `tsc` strict, 0 erreur ESLint, 0 `any` en production, contrats d'erreur stables, OpenAPI générée depuis le code. Reste : handlers longs. |
| Tests | 7 | **8** | ×1 | 2 982 tests unitaires **et 323 tests d'intégration sur un vrai PostgreSQL** — c'est ce qui manquait à l'audit. E2E bloquant en CI, balayage IDOR des 70 routes `[id]`, tests de taille de réponse. Reste : **92 routes sur 288 sans aucun test unitaire**. |
| Sécurité | 5 | **9** | ×2 | 0 vulnérabilité en production, rate-limit incontournable, force brute limitée, IDOR corrigé et balayé, RLS effective, 2FA imposée jusqu'aux API, mot de passe provisoire unique, secrets obligatoires, journaux expurgés. Reste : `style-src 'unsafe-inline'` (L1). |
| Performance | 5 | **8** | ×1 | Voir § 3 : plus aucune réponse > 500 ms ni > 500 Ko sur 7 rôles, mémoire divisée par 22, tableau de bord mobile 0,54 → 0,90. Reste : accueil publique à 0,61. |
| Expérience utilisateur et accessibilité | 7 | **8** | ×1 | Accessibilité **1,00** partout, 2 violations axe corrigées, CLS 0,000, 27 pages distinguent désormais une panne d'une absence de données, consentement et états vides traités. Reste : design gelé, donc rien de plus. |
| Documentation et expérience développeur | 5 | **8** | ×1 | Installation exacte et vérifiée sur clone neuf, OpenAPI générée (287 chemins), `docs/EXPLOITATION.md`, `docs/MIGRATIONS.md`, `.env.example` vérifié par un test, `TECH_DEBT.md` remesuré, inventaire d'interface. |
| Préparation à la production | 4 | **8** | ×1 | Image Docker qui se construit et migre au démarrage, sauvegarde chiffrée avec restauration prouvée par recomptage, crons sans Vercel, journaux JSON avec identifiant de requête, écran d'exploitation, paiements en bac à sable avec garde-fou. Reste : l'image n'a **pas** pu être construite ni lancée ici (démon Docker inactif). |

**Calcul** : (9×2 + 8×2 + 8 + 8 + 8 + 9×2 + 8 + 8 + 8 + 8) / 13
= (18 + 16 + 8 + 8 + 8 + 18 + 8 + 8 + 8 + 8) / 13 = **106 / 13 = 8,15 → 8,2 / 10**

---

## 5. Registre technique des données personnelles

Ce que l'application stocke, où, et qui peut le lire. Les tables marquées 🔒
sont fermées par la **RLS PostgreSQL** (`FORCE ROW LEVEL SECURITY`) : une
requête qui échapperait au filtre applicatif ne voit rien.

| Donnée | Modèle Prisma (table) | Module | Rôles qui y accèdent |
|---|---|---|---|
| Identité, contact, rôle | `User` (`users`) | socle | l'intéressé ; SCHOOL_ADMIN, DIRECTOR de son école ; SUPER_ADMIN |
| Dossier élève, matricule, adresse, date de naissance | `StudentProfile` 🔒 | `students` | l'élève ; ses représentants ; personnel de l'école |
| Lien de filiation | `ParentStudent`, `StudentLinkCode` | socle | le parent ; administration de l'école |
| Notes, appréciations | `Grade` 🔒, `Evaluation` 🔒 | `grades` | l'élève et ses parents (les siennes) ; enseignants de la classe ; direction |
| Présences, absences, justificatifs | `Attendance` 🔒 | `attendance` | idem notes |
| **Santé : dossier médical, allergies, vaccinations, contacts d'urgence** | `MedicalRecord` 🔒, `Allergy` 🔒, `Vaccination` 🔒, `EmergencyContact` 🔒 | `health` — **désactivé par défaut** | personnel de santé et direction, si le module est activé |
| Incidents, sanctions | `BehaviorIncident` 🔒, `Sanction` 🔒 | `discipline` — **désactivé par défaut** | direction, vie scolaire |
| Paiements, frais, bourses | `Payment` 🔒, `Fee`, `Scholarship` | `finance` | le payeur ; comptabilité ; direction |
| Messages | `Message`, `Conversation` | `messaging` | les participants seulement |
| Consentements (horodatés, versionnés) | `DataConsent` | socle | l'intéressé ; administration pour le suivi |
| Journal d'audit (qui a lu ou modifié quoi) | `AuditLog` | socle | SCHOOL_ADMIN de l'école ; SUPER_ADMIN |
| Ressources humaines : paie, congés | `StaffPayroll`, `StaffLeave` | `hr` — **désactivé par défaut** | direction, comptabilité |
| Passages de badge | `ScanLog`, `Badge` | `access-control` — **désactivé par défaut** | vie scolaire |

Mécanismes en place :

- **Minimisation par module** : navigation masquée **et** API bloquée
  (403 `MODULE_DISABLED`). Les modules sensibles — santé, discipline, RH,
  contrôle d'accès, IA — sont **désactivés par défaut** ; une école ne les
  active qu'en connaissance de cause.
- **Consentement** : conditions et politique acceptées à la première connexion,
  horodatées et versionnées ; un parent répond aussi pour chacun de ses enfants
  mineurs rattachés.
- **Droits des personnes** : export, rectification, suppression ou
  anonymisation — exerçables et testés.
- **Conservation** : durées réglables par établissement, purge avec aperçu
  avant écriture, et script de sortie d'établissement (export puis effacement)
  qui produit un rapport du nombre de lignes restantes par table.
- **Traçabilité** : consultations et modifications de notes, santé, paiements
  et rôles écrites dans `AuditLog`.
- **Journaux** : aucun nom, adresse, note, donnée de santé ni contenu de
  message en clair — vérifié par test.

---

## 6. Risques résiduels acceptés

| # | Risque | Pourquoi il est accepté | Ce qui le limite |
|---|---|---|---|
| 1 | **92 routes d'API sur 288 sans test unitaire** | Les écrire toutes dépassait ce travail ; c'est la dette la plus sérieuse qui reste (TD-014). | Les 323 tests d'intégration couvrent transversalement l'isolation, les listes, les tailles et les écritures sensibles ; 286 routes sur 288 héritent des garanties de `createApiHandler`. |
| 2 | **`style-src 'unsafe-inline'`** (L1) | React et le design system posent des styles en ligne ; le retirer casse l'interface. | `script-src` est en nonce + `strict-dynamic` : l'injection de **script** reste bloquée, et c'est elle qui permet le vol de session. |
| 3 | **Image Docker non construite ni lancée** | Démon Docker inactif sur cette machine, `sudo` avec mot de passe. | La chaîne exacte du conteneur a été rejouée hors conteneur : migrations appliquées, serveur standalone démarré, `/api/health` 200, arrêt propre. Procédure à rejouer : `docs/EXPLOITATION.md` § 10. |
| 4 | **Accueil publique lente sur mobile** (0,61) | Animations déclenchées au défilement : conversion plus risquée, page vitrine et non outil de travail. | N'affecte ni la connexion ni le tableau de bord. |
| 5 | **Fenêtre de cache d'une minute** sur le tableau de bord et les statistiques | Ce sont des agrégats, pas du temps réel. | Les écritures de notes purgent immédiatement le cache ; l'en-tête `X-Cache` rend l'état observable. |
| 6 | **Limite H4 sur les échecs, pas sur les tentatives** | `authLimiter` aurait bloqué une école entière derrière une seule adresse publique dès la 6e connexion légitime. | 10 échecs / 15 min / adresse ; la tentative est comptée **avant** vérification puis rendue en cas de succès, donc aucune rafale ne passe. |
| 7 | **Deux systèmes de notification (toasts)** | Les unifier changerait l'apparence : design gelé. | Aucun impact fonctionnel ; inscrit dans `TECH_DEBT.md`. |
| 8 | **Repli mémoire du rate-limit et du cache** | Le déploiement retenu est mono-processus. | Exact tant qu'il n'y a qu'une instance ; le journal le rappelle au démarrage. **Ne pas lancer deux instances sans Redis partagé.** |

---

## 7. Hors périmètre — à traiter avant la mise en service

Ces points ne relèvent pas du code et n'ont pas été faits :

1. **Installation et sécurisation de la machine** : compte non privilégié,
   pare-feu, mises à jour, chiffrement du disque.
2. **HTTPS** : certificat et reverse proxy. Penser à `TRUSTED_PROXY_HOPS=1` et à
   n'exposer le port de l'application qu'au proxy (`docs/EXPLOITATION.md`).
3. **Copie des sauvegardes hors de la machine** : les scripts produisent une
   sauvegarde chiffrée avec rotation, mais **sur le même disque**. Une
   sauvegarde qui brûle avec le serveur ne sert à rien.
4. **Documents d'information et de consentement** : le code horodate et
   versionne l'acceptation ; les textes présentés relèvent de toi.
5. **Démarches de conformité** : registre des traitements, information des
   familles, désignation éventuelle d'un délégué.
6. **Décision sur les paiements réels** : le parcours est prouvé en bac à
   sable ; `PAYMENTS_LIVE_ENABLED` refuse en 503 toute configuration de
   production tant que tu ne l'actives pas (règle 11).

---

## 8. Procédure de fusion vers `main`

```bash
# 1. Repartir d'un arbre propre, sur la branche de travail
git checkout fix/production-readiness
git status            # doit être vide

# 2. Rejouer la batterie complète (aucune étape facultative)
npm ci
npm run type-check                     # 0 erreur
npm run lint                           # 0 erreur
npm test                               # 2 982 tests
npm run test:integration               # 323 tests, PostgreSQL réel jetable
SKIP_ENV_VALIDATION=true npm run build # build de production
npm audit --omit=dev --audit-level=high # 0 vulnérabilité

# 3. E2E sur un build de production et une base jetable
#    (voir scripts/quality/README.md pour le montage exact)
npx playwright test                                  # 89/89
E2E_BASE_URL=… npx playwright test -c playwright.fresh.config.ts  # 2/2

# 4. Fusion sans écraser l'historique : chaque correctif reste annulable seul
git checkout main
git merge --no-ff fix/production-readiness -m "merge: remise à niveau production (voir docs/REMEDIATION.md)"

# 5. Étiqueter la version
git tag -a v1.3.0 -m "Remise à niveau production"
git push origin main --tags
```

**Avant la première mise en service**, dans cet ordre :

1. Créer le fichier `.env` de production à partir de `.env.example` — toutes les
   variables marquées comme requises, secrets générés (`openssl rand -base64 32`).
2. `npx prisma migrate deploy` sur la base de production **vide**.
   Pour une base déjà créée par `db push`, suivre `docs/MIGRATIONS.md`.
3. Créer le rôle applicatif : `node scripts/db/setup-app-role.mjs`, puis pointer
   `DATABASE_URL` sur `edupilot_app` — sans quoi la RLS ne protège rien.
4. Démarrer par `npm run start` ou l'image Docker : les deux chargent les
   préchargements obligatoires (adresse client, arrêt propre).
5. Ouvrir `/setup` et créer le premier super-administrateur. **Ne jamais lancer
   `npm run db:seed`** : il refuse d'ailleurs de s'exécuter sur une base non
   marquée comme jetable.
6. Planifier les tâches (`scripts/cron/run-task.sh`) et la sauvegarde.

**Ne pas fusionner** sans avoir lu le § 7 : le code est prêt, la mise en service
ne l'est pas tant que ces six points ne sont pas traités.
