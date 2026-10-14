# Analyse de performance et de capacité — EduPilot

**Date :** 2026-10-01 · **Branche :** `feat/refonte-coloree-et-securite` (arbre de travail non commité compris) · **Build :** production (`next build`, 56 s)

> Tout chiffre marqué **[MESURÉ]** provient d'une mesure faite le 2026-10-01 sur le serveur de production branché
> sur une base jetable. Les chiffres marqués **[ESTIMÉ]** sont des projections calculées à partir de ces mesures,
> avec les hypothèses écrites à côté. Rien n'est inventé ; ce qui n'a pas été mesuré est dit.

---

## ★ Mise à jour du 2026-10-01 (soir) — après corrections, re-mesuré

Mêmes base, données et machine, build de production lancé comme en production (`node cluster.cjs server.js`).
Les sections 0 à 11 plus bas décrivent l'état **avant** corrections.

### Ce qui a été corrigé

| Goulot | Correction | Fichiers |
|---|---|---|
| G2 connexion | bcrypt **natif** (pool libuv, hors thread des requêtes), même format d'empreinte, sans migration ; **2 threads du pool toujours laissés libres** (sinon `crypto.subtle`, qui déchiffre chaque session, attendait 5,7 s derrière 40 bcrypt) | `src/lib/auth/password.ts` (+ 15 appelants) |
| G3 verrou d'IP | échecs comptés **par compte + IP** (10 / 15 min) et **par IP** large (200 / 15 min, `LOGIN_IP_FAILURES_PER_15MIN`) ; activation `first-login` idem | `src/lib/rate-limit.ts`, `api/auth/[...nextauth]`, `api/auth/first-login` |
| G4 accueils | calcul mémoïsé **par établissement** (60 s) / par personne (30 s), **un seul calcul pour N demandes simultanées** ; idem `school/overview` et `finance/dashboard` | `src/lib/cache/memo.ts`, `services/analytics-dashboard/index.ts`, 2 routes |
| G1 un seul cœur | lanceur **multi-processus** `WEB_CONCURRENCY` (Docker) / PM2 cluster ; **refus sans `REDIS_URL`** ; cache partagé via `REDIS_URL` | `scripts/server/cluster.cjs`, `ecosystem.config.js`, `lib/cache/redis.ts` |
| piège découvert en mesurant | 4 processus × pool Prisma par défaut (25) = 100 connexions → **« Too many database connections », pages en erreur** ; pool borné par processus (`DATABASE_POOL_SIZE`, défaut 10) | `src/lib/prisma.ts` |
| proxy | un compte connecté n'est limité que par **son** seau (le seau par IP refusait ensemble les centaines de comptes derrière le NAT d'un opérateur mobile) ; limiteur strict sur les **écritures** seulement | `src/proxy.ts` |
| exploitation | **Node 24** (Docker, CI) ; volume `uploads_data` (les téléversements disparaissaient à chaque recréation du conteneur) ; `stop_grace_period: 30s` (Docker coupait l'arrêt propre à 10 s) ; PM2 `max_memory_restart` 1,5 Go | `Dockerfile`, `docker-compose.yml`, `.github/workflows/*`, `ecosystem.config.js` |
| connexion | adresses accentuées acceptées (34 % des comptes du seed ne pouvaient pas se connecter) | `src/lib/auth/config.ts` |

Vérifications : `type-check` ✅, `lint` ✅, **3 935 tests unitaires** ✅, **344 tests d'intégration sur PostgreSQL réel** ✅,
`security.mjs` sur 2 processus + Redis : H4, G3, H5, TENANT, H1, M3 ✅ ; H3 et H2 en échec **indépendamment de ces
corrections** (seuil du script 130 < quota anonyme de 1 000/min ; `/api/system/automation` → 500 sans `CRON_SECRET`).

### Avant / après — [MESURÉ]

| Mesure | Avant | Après (1 processus) | Après (4 processus + Redis) |
|---|---|---|---|
| Mélange réaliste, 10 connexions | 52–62 req/s, p50 139–169 ms | **136 req/s, p50 68 ms** | **168 req/s, p50 47 ms** |
| Mélange réaliste, 50 connexions | 59–97 req/s, p50 0,5–0,8 s | 132 req/s, p50 372 ms | **199 req/s, p50 245 ms** |
| Mélange réaliste, 400 connexions | 101 req/s, p50 3,4 s | — | 213 req/s, p50 1,8 s, **0 erreur** |
| Accueil direction `/dashboard` | 2–3 req/s, p50 6,4 s, 440 ms de thread | **27 req/s**, 34 ms de thread | — |
| Accueil enseignant | 7 req/s | **40 req/s** | — |
| `/api/analytics/dashboard` en rafale | 1 req/s, p50 9,7 s | **97 req/s** | — |
| `finance/dashboard` / `school/overview` | 3 / 3 req/s | — | 18 / 15 req/s (avant mémoïsation) |
| 30 élèves se connectent ensemble, même IP | **10 entrent, 20 refusés**, serveur à 2,4 s | **30/30**, serveur à **15 ms** (p50 `/api/health`) | — |
| 100 connexions simultanées, même IP | — | **100/100**, serveur à **13 ms** pendant la rafale | — |
| 38 sessions de test ouvertes | 28/38 en 25 s | **38/38** en 10 s | 38/38 en 12 s |

**Limite de la machine de test, dite franchement.** Le gain de 4 processus n'est que ×1,5 ici : ce portable a 2 cœurs
rapides et 8 cœurs « économes » ~2× plus lents, et PostgreSQL, Redis, le générateur de charge et d'autres programmes
(indexation de fichiers, 87 % ; un `python3`, 116 %) tournaient sur la même machine. Un processus seul sur un cœur
rapide : 136 req/s ; chacun des 4 : ~50 req/s. Sur un serveur aux cœurs homogènes, sans la base sur la même machine,
le gain du niveau applicatif est attendu proche de ×(nombre de processus) — **non mesuré ici**.

### Capacité après corrections — [ESTIMÉ à partir des mesures ci-dessus]

Coûts unitaires retenus (mélange réaliste) :
- **Application :** ~136 req/s par cœur rapide, soit ~90 par vCPU cloud (÷1,5). Avec ~0,25 req/s par utilisateur actif,
  cela fait **≈ 200 à 300 utilisateurs actifs par vCPU** à 60–70 % de charge.
- **PostgreSQL :** ~113 % de CPU à ~200 req/s, soit ~5,7 ms de CPU base par requête. Un cœur PostgreSQL à 70 % tient
  donc ≈ 120 req/s, soit **≈ 500 utilisateurs actifs par cœur PostgreSQL**.
- **Connexions :** ~0,58 s de bcrypt (coût 12) par connexion et par cœur, soit **≈ 1,7 connexion/s par cœur
  disponible**. Le reste de l'application ne se fige plus pendant ce temps.

| Comptes inscrits | Actifs simultanés en pointe (3–8 %) | Serveurs d'application | PostgreSQL |
|---|---|---|---|
| 10 000 (≈ 4 écoles) | 300–800 | 2–4 vCPU, 1 machine | 2 cœurs (même machine possible) |
| 50 000 (≈ 20 écoles) | 1 500–4 000 | 8–16 vCPU | 4–8 cœurs, serveur dédié |
| **100 000** (≈ 40 écoles) | 3 000–8 000 | 16–32 vCPU (2–4 serveurs) | **8–16 cœurs** dédiés + PgBouncer |
| **300 000** (≈ 120 écoles) | 9 000–24 000 | 40–100 vCPU | **18–48 cœurs** : au-delà d'un seul PostgreSQL confortable |

**Conclusion honnête.**
- **La version corrigée peut servir des centaines de milliers de comptes inscrits** : le niveau applicatif s'étend
  maintenant horizontalement, en ajoutant des processus et des serveurs, sans plafond dans le code.
- **Ce n'est pas un réglage de code, c'est de l'infrastructure.** Il faut Redis, des serveurs d'application
  proportionnés et un PostgreSQL dédié et dimensionné.
- **Jusqu'à ~100 000 comptes,** un PostgreSQL de 8–16 cœurs suffit.
- **Vers 300 000 comptes,** la base devient la limite, et trois chantiers restent à faire avant d'y aller :
  - un réplica en lecture pour l'analytique et le BI ;
  - le contexte RLS posé une fois par requête plutôt qu'une transaction par requête SQL (G5, ~×2 sur le coût client
    de chaque requête) ;
  - la liste des élèves : son coût croît avec la taille de l'école (≈ 7 900 lignes lues pour en afficher 20).

Les pics de connexion ne gèlent plus l'application, mais leur débit reste fixé par le coût bcrypt de 12. Si 30 % de
300 000 comptes se connectent dans l'heure qui suit une publication de bulletins, cela fait 25 connexions/s, soit
~15 cœurs consacrés au seul hachage. Réduire le coût à 11 diviserait ce besoin par deux. C'est une **décision de
sécurité** qui revient au propriétaire et que je n'ai pas prise.

---

## 0. Réponse courte

| Question | Réponse |
|---|---|
| Combien d'utilisateurs **simultanément actifs** l'application tient-elle aujourd'hui ? | **≈ 100 à 150 par serveur** (vCPU cloud) avec des temps de réponse corrects ; ≈ 150 à 250 sur la machine de test. Au-delà, tout ralentit pour tout le monde (pas de plantage : les requêtes attendent). |
| Combien de **comptes inscrits** cela représente-t-il ? | **≈ 2 000 à 4 000 comptes** (ratio usuel de 3 à 8 % de comptes actifs en même temps à l'heure de pointe), soit **1 à 3 établissements de ~1 000 élèves** quand élèves et parents ont un compte. |
| Qu'est-ce qui limite ? | **Un seul processus Node.js** (décision du 2026-09-12) : un seul cœur CPU travaille, saturé à 100 % pendant que PostgreSQL reste à ~1 cœur sur 12. Puis trois poids lourds sur ce cœur : **la connexion (bcrypt pur JS, 0,66 s de CPU bloquant)**, **l'accueil direction rendu sans cache (0,36–0,44 s de CPU)**, **l'enveloppe RLS qui double le coût de chaque requête SQL**. |
| Quel est le pire scénario réel ? | **Une classe qui se connecte en même temps depuis le routeur de l'école** : 30 connexions simultanées → **10 entrent, 20 reçoivent « Trop de tentatives »** et pendant 7 s le serveur entier répond en ~2,4 s **[MESURÉ]**. Et **10 mots de passe faux en 15 min depuis la même IP bloquent toute l'école 15 min** **[MESURÉ]**. |
| Jusqu'où peut-on monter après corrections ? | **[ESTIMÉ]** ≈ 450–600 actifs (10–15 écoles) sur 4 vCPU ; ≈ 1 000–1 200 actifs (25–40 écoles) sur 8 vCPU + PostgreSQL séparé ; ≈ 3 000 actifs (60–100 écoles) avant que PostgreSQL ne devienne la limite. Au-delà, il faut changer d'architecture (§9). |

---

## 1. Banc de mesure

| Élément | Valeur |
|---|---|
| Machine | Intel i7-1355U (portable, 12 threads, 2 cœurs « performance » à turbo élevé), 15 Go RAM, Linux |
| Runtime | Node.js 22.22.3 (le Dockerfile de production utilise **Node 20**) |
| Serveur | `next start` du build de production, port 3100, **un seul processus** comme en production (`ecosystem.config.js`, `instances: 1`) |
| Base | PostgreSQL 16 jetable (`scripts/quality/disposable-pg.mjs`), **rôle applicatif `edupilot_app` soumis à la RLS** (comme en production), pool Prisma par défaut (2 × CPU + 1 = 25) |
| Données | Seed d'audit : 3 écoles, **1 école peuplée** (Collège Saint-Michel : 995 élèves, 29 classes, **131 208 notes**, 3 697 évaluations, 8 293 présences, 3 328 paiements), 2 706 comptes, base 111 Mo |
| Mots de passe | bcrypt **coût 12** (comme les comptes créés par `/api/users`, `/first-login`, `/reset-password`) |
| Redis | absent (configuration documentée par défaut : cache et limites en mémoire) |
| Outils | `scripts/quality/{smoke,latency}.mjs`, `pg-seq-scans.mjs`, autocannon, profileur V8 en processus, `/proc` pour CPU/RSS, scripts de mesure dans `.quality-tmp/perf-*` |

**Facteur de correction.** Un cœur de ce portable est plus rapide qu'un vCPU cloud typique (Xeon/EPYC à 2,5–3,5 GHz).
Les projections « serveur » ci-dessous divisent les débits mesurés par **1,5** (hypothèse prudente).

**Ce qui n'a pas été mesuré :** latence réseau réelle (base sur une autre machine, clients en 3G/4G), Sentry activé
(10 % de traces), n8n/LLM, envoi de SMS/courriels en masse, base de plusieurs écoles de taille réelle.

---

## 2. Latences unitaires (une requête à la fois) — [MESURÉ]

### 2.1 Balayage de toutes les routes GET (173 routes, `smoke.mjs`)

| Rôle | Routes 200 | p50 | p95 | > 500 ms | 5xx |
|---|---|---|---|---|---|
| SCHOOL_ADMIN | 119 | 19 ms | 172 ms | aucune | `/api/system/automation` (500) |
| TEACHER | 88 | 19 ms | 217 ms | aucune | idem |
| PARENT | 85 | 18 ms | 52 ms | aucune | idem |
| STUDENT | 83 | 18 ms | 47 ms | aucune | idem |

Progrès net depuis l'audit du 2026-09-11 (p95 admin **852 → 172 ms**).

Routes les plus lentes (premier appel) : `analytics/dashboard` 403 ms, `grades/statistics` 341 ms,
`analytics/school/overview` 238 ms, `analytics/bi` 217–244 ms, `messages/recipients` 268 ms (**246 Ko**),
`analytics/students` 259 ms (103 Ko), `class-subjects` 118 ms (**430 Ko**).

### 2.2 Endpoints principaux, 20 appels séquentiels (`latency.mjs`)

| Endpoint | 1er appel (cache froid) | p50 suivants | Taille |
|---|---|---|---|
| `/api/students?limit=20` | 168 ms | 46 ms | 11 Ko |
| `/api/classes` | 59 ms | 22 ms | 8 Ko |
| `/api/grades?classId=` | 147 ms | 89 ms | 92 Ko |
| `/api/analytics/dashboard` | **573 ms** | 19 ms (cache) | 4 Ko |
| `/api/finance/stats` | 366 ms | 19 ms (cache) | — |
| `/api/grades/statistics` | 465 ms | 19 ms (cache) | 1 Ko |

⚠️ Les p50 de ~19 ms des routes analytiques **ne mesurent que le cache**. Le vrai coût est le premier appel,
et il revient toutes les 60 s par utilisateur (TTL `CACHE_TTL_SHORT`, clé par utilisateur).

---

## 3. Débit et coût CPU par requête (20 connexions, 12 s) — [MESURÉ]

`mainThreadMs` = temps du thread JavaScript unique, **la ressource qui limite**. `cpuMs` inclut en plus les threads
du moteur Prisma et libuv.

| Chemin | req/s max | p50 | CPU total / req | **Thread principal / req** |
|---|---|---|---|---|
| `GET /api/health` (anonyme) | 144 | 123 ms | 9 ms | **7 ms** (plancher : proxy + routage) |
| `/api/notifications?unread=true&limit=1` | 71 | 265 ms | 22 ms | 14 ms |
| `/api/classes` | 59 | 312 ms | 22 ms | 16 ms |
| `/api/students?limit=20` | 59 | 328 ms | 37 ms | 16 ms |
| `/api/analytics/dashboard` (cache froid, 20 en parallèle) | **1** | **9,7 s** | **1 776 ms** | **567 ms** |
| `/api/finance/dashboard` | 3 | 5,3 s | 380 ms | 105 ms |
| `/api/analytics/school/overview` | 3 | 2,9 s | 673 ms | 179 ms |
| Page `/login` (SSR) | 53 | 363 ms | 25 ms | 19 ms |
| Page `/dashboard/students` (SSR) | 38 | 523 ms | 39 ms | 26 ms |
| Page `/dashboard/grades/entry` (SSR) | 33 | 572 ms | 40 ms | 29 ms |
| **Page `/dashboard` — direction** | **2–3** | **6,4 s** | **1 210–1 530 ms** | **360–440 ms** |
| Page `/dashboard` — enseignant | 7 | 2,5 s | 506 ms | 141 ms |
| Page `/dashboard` — parent | 27 | 686 ms | 92 ms | 36 ms |
| Page `/dashboard` — élève | 33 | 568 ms | 63 ms | 30 ms |
| **Connexion (bcrypt coût 12)** | **≈ 1,5 /s** | — | — | **≈ 660 ms** |
| Connexion (bcrypt coût 10, élèves/enseignants créés par l'API) | ≈ 6 /s | — | — | ≈ 165 ms |

Pendant tous ces essais, le thread principal est à **91–99 %** : c'est lui qui plafonne, pas la base.

---

## 4. Montée en charge réaliste — [MESURÉ]

28 comptes réels connectés (2 direction, 12 enseignants, 12 élèves, 12 parents ; ASCII uniquement, cf. §8.6),
chaque connexion autocannon enchaîne les appels d'API des écrans les plus fréquentés de son rôle, **sans temps de
réflexion** (une connexion autocannon ≈ 30 à 50 utilisateurs réels, qui font une requête toutes les 5 à 10 s).

| Connexions | req/s | p50 | p90 | p99 | Erreurs | CPU Node | RSS max |
|---|---|---|---|---|---|---|---|
| 10 | 52–62 | 139–169 ms | 229–286 ms | 507–579 ms | 0 | 214–230 % | 623–656 Mo |
| 25 | 61–81 | 302–407 ms | 452–576 ms | 588–815 ms | 0 (429*) | ~200 % | 640–657 Mo |
| 50 | 59–97 | 486–801 ms | 738–1 145 ms | 1,3–1,9 s | 0 (429*) | ~220 % | 680–700 Mo |
| 100 | 71–87 | 1,1–1,4 s | 1,3–1,7 s | 2,0 s | 0 (429*) | ~210 % | 700–716 Mo |
| 200 | 75–121 | 1,7–2,5 s | 2,1–3,7 s | 3,3–4,5 s | 0 (429*) | ~220 % | 720–780 Mo |
| 400 | 101 | 3,4 s | 5,7 s | 6,7 s | 0 | 257 % | 829 Mo |

\* Les 429 viennent du limiteur « strict » (§8.4), pas d'une surcharge.

**Échantillonnage CPU pendant la charge (toutes les 2 s) :** thread principal Node **100–107 %**, Node total ~200 %,
PostgreSQL **60–112 %** (≈ 1 cœur sur 12 disponibles).

**Lecture :**
- Le débit plafonne à **≈ 60–120 req/s** d'API mélangées, quel que soit le nombre de connexions : au-delà, la latence
  grimpe linéairement (file d'attente sur le thread unique), sans erreur ni plantage.
- **Aucune erreur 5xx et aucun timeout jusqu'à 400 connexions** : la dégradation reste propre.
- La base ne travaille qu'à ~1 cœur : **PostgreSQL n'est pas le goulot aujourd'hui.**
- Avec un pool limité à 5 connexions (VPS 2 vCPU), on obtient le même plafond et aucun `P2024` (timeout du pool).
  Le pool ne limite donc pas, puisque le thread principal sature avant.

### 4.1 Profil CPU du thread principal en régime établi (profileur V8, 44 s, 69 000 échantillons)

| Poste | Temps propre | Temps inclusif |
|---|---|---|
| Cœur Node (hooks async, AsyncLocalStorage, crypto JWE, flux) | 24 % | 41 % |
| **Client Prisma (sérialisation/parsing des réponses du moteur)** | **18 %** | **21 %** |
| Code applicatif (routes, services) | 17 % | 43 % |
| Runtime Next (routage, rendu) | 11 % | 18 % |
| Ramasse-miettes | 6 % | — |
| Inactif | 8,5 % | — |

Fonctions les plus coûteuses : `parseEngineResponse` (Prisma, 3,8 %), `_propagate`/`promiseInitHook`
(AsyncLocalStorage, ~2,3 %), `Date` patché par Next (1,2 %). **Pas de point chaud unique** : le coût vient du nombre
de requêtes SQL par écran et du surcoût fixe par requête.

Pendant la phase de connexion du même essai, **bcryptjs représente 30,7 % de tout le temps CPU**.

### 4.2 Mémoire

- Au repos après démarrage : **207–225 Mo**. Sous charge : pics à **650–970 Mo**. Après 40 s de repos : **392 Mo** →
  **pas de fuite**, le ramasse-miettes est paresseux.
- ⚠️ PM2 redémarre le processus à **1 Go** (`max_memory_restart: '1G'`). Sous forte charge on passe à **30 Mo du seuil**.
  Un redémarrage efface en même temps le cache, les limites de débit et les compteurs d'échecs (tous en mémoire),
  et coupe les requêtes en cours.

---

## 5. Les goulots, classés par impact

### G1 — Un seul processus = un seul cœur (critique)
`ecosystem.config.js` : `instances: 1, exec_mode: 'fork'`. Choix volontaire (cohérence du rate-limit et du cache en
mémoire). Sur un serveur de 4 vCPU, **3 cœurs sur 4 restent inutilisés pour le code applicatif**. Le code sait déjà
partager ses limites via `REDIS_URL` (`src/lib/redis/tcp.ts`), et la file de tâches est sûre en multi-instance
(`FOR UPDATE SKIP LOCKED`). **Ce qui bloque encore :** les fichiers téléversés sur disque local
(`src/app/api/upload/route.ts` → `fs.writeFile`), le cache `userStatusCache` (30 s, en mémoire) et le cache
`MemoryCache`. Ces deux derniers acceptent l'incohérence sans dommage tant que la durée est courte.

### G2 — Connexion : bcryptjs pur JavaScript, coût 12, sur le thread principal (critique)
- **660 ms de CPU par connexion** sur ce portable, ≈ 1 s sur un vCPU cloud **[MESURÉ / ESTIMÉ]**. Pendant ce temps, rien
  d'autre ne s'exécute.
- Plafond : **≈ 1,5 connexion/s** sur ce portable (≈ 1/s sur un serveur) pendant que **tout le reste est gelé**.
- `bcryptjs` découpe son calcul en tranches asynchrones mais reste sur le thread principal. Le paquet natif `bcrypt`,
  ou `argon2`, s'exécute dans le pool libuv (hors thread principal) et va environ 3 fois plus vite.

### G3 — Verrou de connexion par IP inadapté aux écoles derrière un NAT (critique pour l'usage réel)
`src/app/api/auth/[...nextauth]/route.ts` + `LOGIN_FAILURE_RATE_LIMIT` (10 / 15 min / IP).
- La tentative est **comptée avant vérification** et rendue seulement en cas de succès : **au plus 10 connexions
  peuvent être en cours en même temps par IP**. **30 élèves en salle informatique → 20 refusés [MESURÉ]**, avec un
  `Retry-After` pouvant atteindre 15 min.
- **10 mots de passe faux en 15 min depuis le routeur de l'école bloquent tous les comptes de l'école pendant 15 min**
  **[MESURÉ deux fois pendant cette analyse : attente imposée de 729 s puis 838 s]**.
- Au Bénin, une école sort très souvent par **un seul routeur 4G**, et les parents par le NAT de l'opérateur mobile
  (des milliers d'abonnés derrière quelques IP).

### G4 — Accueil direction et analytique : calculs lourds sans cache partagé ni dédoublonnage (élevé)
- La page `/dashboard` (Server Component) appelle `getAdminDashboardData` **directement, sans cache** :
  **360–440 ms de thread principal et 1,2–1,5 s de CPU au total à chaque affichage**. C'est la première page que voit
  chaque membre de la direction après sa connexion.
- `/api/analytics/dashboard` a un cache de 60 s **par utilisateur**, mais **pas de « single-flight »**. Quand
  20 demandes identiques arrivent en même temps, 20 calculs complets s'exécutent : **1 req/s, p50 9,7 s [MESURÉ]**.
- `admin.ts` lance jusqu'à **13 requêtes en parallèle** (`Promise.all`, l. 474) : chaque affichage occupe jusqu'à 13
  connexions du pool. Sur un VPS 2 vCPU (pool = 5), c'est 2,6 fois le pool pour un seul utilisateur.
- `analytics/school/overview` : ~10 `await` **séquentiels**, ~50 000 lignes lues par appel. `finance/dashboard` :
  ~17 000 lignes lues par appel **[MESURÉ via pg_stat_database]**. Les deux croissent linéairement avec la taille de
  l'école.

### G5 — Enveloppe RLS : chaque requête SQL devient une transaction (élevé, structurel)
`src/lib/db/scoped-client.ts` : toute opération isolée devient `BEGIN; set_config(…); requête; COMMIT`.
Micro-banc **[MESURÉ]** (même requête, rôle applicatif) :

| | Latence | CPU côté Node | Débit (10 en parallèle) |
|---|---|---|---|
| Requête seule | 1,13 ms | 0,87 ms | 2 735 req/s |
| Requête enveloppée | **2,42 ms (×2,1)** | **1,78 ms (×2,0)** | **2 012 req/s (−26 %)** |

Sur un écran de 15 requêtes, cela fait ≈ 13 ms de CPU en plus. Avec une base sur une **autre machine** (1 ms de RTT),
chaque requête coûte en outre 3 allers-retours supplémentaires, soit +3 ms × (requêtes séquentielles) par écran.

### G6 — Surcoûts fixes par requête (moyen)
- `auth()` (déchiffrement du JWE) est appelé **deux fois** par appel d'API : une fois dans `src/proxy.ts`, une fois dans
  `createApiHandler`.
- Le plancher mesuré est de **7 ms de thread principal**, même pour `/api/health`.
- AsyncLocalStorage repose encore sur `async_hooks` en Node 20/22 (`promiseInitHook` visible dans le profil). En Node 24,
  `AsyncContextFrame` est activé par défaut et coûte moins cher.

### G7 — Rendu 100 % dynamique (moyen, choix de sécurité assumé)
La CSP à nonce impose `force-dynamic` sur le layout : **aucune page n'est servie depuis un cache statique**. Chaque
navigation déclenche un rendu serveur (19–29 ms pour une page simple, bien plus pour les accueils). Ce choix est
correct pour la sécurité ; il rend d'autant plus important le cache des données.

### G8 — Index manquant ou inefficace (faible aujourd'hui, croissant)
Pendant le balayage des 3 rôles **[MESURÉ, pg-seq-scans]** :

| Table | Parcours séquentiels | Lignes lues | Parcours d'index |
|---|---|---|---|
| `subject_performances` | 6 | **196 812** | **0** |
| `student_profiles` | 100 | 99 500 | 22 543 |
| `users` | 24 | 62 241 | 982 |
| `class_subjects` | 156 | 48 204 | 1 769 |

Pour `subject_performances`, `analyticsId IN (≈1 000 ids)` dans `summarizeSubjects*` (`queries.ts`) fait choisir un
parcours complet de la table. Les autres tables sont encore petites : PostgreSQL a raison de les lire séquentiellement.
À surveiller au-delà d'environ 50 000 lignes par table.

### G9 — Poids des pages pour les réseaux mobiles (moyen pour le public visé)

| Page | JS (brut) | JS gzip | CSS gzip | HTML gzip |
|---|---|---|---|---|
| `/login` | 1 055 Ko | **305 Ko** | 22 Ko | 6 Ko |
| `/dashboard` | 793 Ko | 247 Ko | 24 Ko | 7 Ko |
| `/dashboard/grades/entry` | 844 Ko | 263 Ko | 22 Ko | 6 Ko |
| `/dashboard/students` | 904 Ko | 285 Ko | 24 Ko | 5 Ko |

**La page de connexion est la plus lourde** (305 Ko gzip), alors qu'elle est la première vue sur un téléphone en 3G :
environ 6 s de téléchargement à 50 Ko/s **[ESTIMÉ]**. Les fichiers sont ensuite en cache `immutable` et le service
worker (Serwist) prend le relais pour les visites suivantes.

---

## 6. Modèle de capacité

### 6.1 Coût d'un utilisateur actif — [ESTIMÉ à partir des mesures §3]

| Action | Thread principal (portable) | Fréquence typique |
|---|---|---|
| Vue d'écran ordinaire = 1 rendu SSR (≈ 30 ms) + ~6 appels d'API (≈ 13 ms) | **≈ 110 ms** | 2 à 3 par minute en usage actif |
| Accueil direction (sans cache) | ≈ 440 ms + ses API | à chaque retour à l'accueil |
| Accueil enseignant | ≈ 140 ms + ses API | idem |
| Connexion | **≈ 660 ms** (coût 12) | 1 à 3 par jour et par personne, **concentrées** |

Un utilisateur actif consomme donc **≈ 4 à 6 ms de thread principal par seconde**.
Un cœur visé à 60–70 % d'occupation (pour garder des latences < 1 s) offre 600–700 ms/s, soit
**≈ 120 à 170 actifs simultanés sur ce portable**, et **≈ 80 à 120 sur un vCPU cloud**. Vérification par la charge
mesurée : 60–100 req/s au plafond ÷ ~0,2 req/s par utilisateur réel ≈ 300–500 utilisateurs **à saturation**
(latences > 1 s), soit environ 150–250 avec de la marge. Les deux méthodes concordent.

### 6.2 Des utilisateurs actifs aux établissements

Un établissement-type de **1 000 élèves** : ~70 personnels, ~1 000 comptes élèves, ~1 500 comptes parents,
soit **≈ 2 600 comptes**.

| Moment | Actifs simultanés pour 1 école [ESTIMÉ] | Tient sur 1 processus actuel ? |
|---|---|---|
| Journée ordinaire (appel, notes, consultations) | 30–80 | ✅ oui |
| 7 h 30–8 h : appel du matin (60 enseignants en 10 min) | 0,1 connexion/s + 60 actifs | ✅ oui (bcrypt ≈ 7–10 % du CPU) |
| Salle informatique : 30 élèves se connectent ensemble | rafale de 30 connexions | ❌ **20 refusés (G3)**, serveur gelé ~7 s |
| Publication des bulletins + SMS à 1 500 familles (25 % en 10 min) | 0,6 connexion/s + ~150 actifs | ⚠️ limite : ~40 % du CPU en bcrypt, latences > 1 s |
| 10 écoles d'un réseau publient leurs bulletins le même soir | ~6 connexions/s | ❌ **4× au-dessus du plafond** : file d'attente, délais de plusieurs dizaines de secondes |

**Capacité réelle aujourd'hui (1 processus) :** **1 à 3 établissements de ~1 000 élèves**. On peut en accueillir davantage
si seuls le personnel et les parents utilisent l'application, ou si les pics ne coïncident pas. **Ce sont les pics de
connexion qui fixent la limite, pas la moyenne.**

### 6.3 Volume de données (stockage) — [MESURÉ + ESTIMÉ]
- Mesuré : **111 Mo pour une école de 995 élèves et ~1 an de notes** (`grades` 51 Mo, `grade_history` 16 Mo,
  `subject_performances` 12 Mo).
- Le seed sous-représente les présences (8 300 lignes). Un appel quotidien réel donne ~180 000 lignes/an pour
  1 000 élèves (~70 Mo avec index) **[ESTIMÉ]**. Il faut aussi compter `audit_logs`, qui trace les lectures sensibles
  (dédoublonnées sur 5 min).
- **≈ 150–250 Mo par tranche de 1 000 élèves et par an [ESTIMÉ]**, soit ~20 Go/an pour 100 écoles. Ce volume n'est
  pas un sujet pour PostgreSQL ; les sauvegardes chiffrées doivent simplement suivre.

---

## 7. Dimensionnement serveur

### 7.1 Avec le code actuel (aucune correction)

| Serveur | Ce qu'il apporte | Capacité [ESTIMÉ] |
|---|---|---|
| VPS 2 vCPU / 4 Go | 1 cœur pour Node, 1 pour PostgreSQL + système | ≈ 80–120 actifs · 1–2 écoles |
| VPS 4 vCPU / 8 Go | **Aucun gain** : un seul processus Node | identique |
| VPS 8 vCPU / 16 Go | **Aucun gain** | identique |

➡️ **Tant que G1 n'est pas levé, augmenter la taille du serveur ne sert à rien.**

### 7.2 Après corrections P0–P1 (§10)

| Architecture | Capacité [ESTIMÉ] |
|---|---|
| 4 vCPU / 8 Go : 3 processus Node + Redis + PostgreSQL sur la même machine | ≈ 450–600 actifs · **10–15 écoles** |
| 8 vCPU / 16 Go pour l'app (6–7 processus) + PostgreSQL 4 vCPU séparé | ≈ 1 000–1 200 actifs · **25–40 écoles** |
| N serveurs d'app derrière un répartiteur + PgBouncer + PostgreSQL 8 vCPU | jusqu'à ≈ 3 000 actifs · **60–100 écoles** (limite PostgreSQL) |

Limite PostgreSQL : on a mesuré ~1 cœur de PostgreSQL pour 60–100 req/s, avec l'enveloppe RLS. Un PostgreSQL de
8 cœurs tient donc ≈ 600 req/s, soit ≈ 3 000 actifs à 0,2 req/s **[ESTIMÉ]**. Retirer la double transaction (G5)
repousse cette limite d'environ 25 à 50 %.

Mémoire à prévoir : **1,0–1,2 Go par processus Node** (pic mesuré 970 Mo) + PostgreSQL (shared_buffers ≈ 25 % de la RAM)
+ Redis (< 100 Mo).

---

## 8. Constats secondaires relevés pendant les mesures

1. **Node 20 dans le Dockerfile** : sa fin de vie était fixée au 30/04/2026. Passer à Node 24 LTS apporte des correctifs
   de sécurité et un AsyncLocalStorage moins coûteux (G6).
2. **`next start` avec `output: standalone`** : Next avertit que ce mode n'est pas fait pour cela. La production
   (PM2/Docker) lance bien `server.js` ; les scripts de mesure et le README de recette utilisent `npm run start`, sans
   conséquence sur les chiffres.
3. **Seuil PM2 `max_memory_restart: 1G`** trop proche du pic mesuré (970 Mo) : le porter à 1,5 Go, ou borner le tas avec
   `--max-old-space-size=1024`.
4. **Limiteur strict à 20 requêtes/min par utilisateur sur tout `/api/grades*` et `/api/payments*`**, lectures (GET)
   comprises (`STRICT_RATE_LIMIT_PREFIXES`). Un enseignant qui passe d'une classe à l'autre ou une comptable qui
   parcourt des listes peut recevoir des 429. Ces 429 sont apparus dans la montée en charge. Limiter plutôt les
   écritures.
5. **`/api/notifications/stream` (SSE)** : aucun écran ne l'utilise. S'il était branché tel quel, il ouvrirait **une
   connexion Redis par utilisateur** (avec `REDIS_URL`), ou ferait **une requête SQL toutes les 5 s par utilisateur**
   (sans Redis), soit 200 req/s pour 1 000 onglets ouverts. À réécrire (un abonné Redis partagé) avant toute activation.
6. **Défaut fonctionnel trouvé incidemment :** `loginSchema` (`src/lib/auth/config.ts`) utilise `z.string().email()`
   (zod 4), qui **refuse les adresses accentuées**. **920 comptes sur 2 706 du seed (34 %)** ne peuvent donc pas se
   connecter (`zoé.dossou8@…`). Les adresses générées par l'import sont normalisées (`credentials-export.ts`) ; le
   risque réel en production est faible, mais le seed fausse les essais. Il compte aussi comme 10 « échecs » qui ont
   déclenché le verrou d'IP (G3) pendant cette analyse.
7. **`/api/system/automation` répond 500** pour tous les rôles (balayage §2.1).
8. **Réponses volumineuses** : `class-subjects` 430 Ko, `messages/recipients` 246 Ko, `analytics/students` 103 Ko, à
   paginer ou à alléger (3G).
9. Les grosses listes de l'interface demandent `limit=1000` (ex. élèves de la classe dans la saisie des notes). Ce n'est
   pas un problème à 30 élèves par classe, mais à surveiller.

---

## 9. Au-delà de 100 écoles (échelle nationale)

Les corrections du §10 ne suffisent plus à partir de quelques milliers d'actifs simultanés. Il faudra alors :
- **une transaction par requête HTTP** (contexte RLS posé une fois) au lieu d'une par requête SQL, ou une RLS fondée sur
  le rôle de connexion, avec PgBouncer en mode transaction ;
- **des agrégats pré-calculés** (moyennes, taux de réussite, recouvrement) mis à jour par la file de tâches au lieu
  d'être recalculés à l'affichage, ainsi qu'un **réplica en lecture** pour l'analytique et le BI ;
- **le stockage objet** (S3/R2) pour les fichiers et **un CDN** pour `/_next/static` ;
- un **découpage par réseau ou par région** (une base par grand réseau) si un seul PostgreSQL ne suffit plus.

---

## 10. Plan d'optimisation priorisé

| # | Action | Fichiers | Gain attendu [ESTIMÉ] | Effort |
|---|---|---|---|---|
| **P0-1** | Remplacer `bcryptjs` par `bcrypt` (natif, pool libuv) ou `argon2`. Garder le coût 12 (sécurité), le calcul quitte le thread principal | `lib/auth/config.ts`, routes de mot de passe, `two-factor.ts` | Connexion : 660 ms → **~0 ms de thread principal** ; 3–4× plus de connexions/s ; plus de gel global | ½ j |
| **P0-2** | Verrou de connexion : compter les échecs **par compte + IP** (et non par IP seule), et **ne pas compter les tentatives en cours** (ou porter la limite à ~100 en parallèle) | `api/auth/[...nextauth]/route.ts`, `first-login/route.ts`, `rate-limit.ts` | Fin du « 20 élèves refusés » et du blocage d'école entière | ½ j |
| **P0-3** | Cache + single-flight (promesse partagée par clé) sur l'accueil direction/enseignant et les routes analytiques ; clé **par école + année + filtres**, pas par utilisateur | `dashboard/page.tsx`, `services/analytics-dashboard/*`, `lib/api/cache-helpers.ts` | Accueil direction 440 ms → ~20 ms (hit) ; fin des avalanches à 9,7 s | 1 j |
| **P1-1** | **Plusieurs processus** : PM2 `instances: max-1` + `REDIS_URL` obligatoire en multi-instance + téléversements en stockage partagé (volume commun ou S3/R2) | `ecosystem.config.js`, `api/upload/route.ts`, `.env.example`, `docs/DEPLOYMENT.md` | **×(vCPU − 1)** : 4 vCPU → ×3 | 1–2 j |
| **P1-2** | Node 24 LTS (Dockerfile, CI) + `max_memory_restart` 1,5 Go | `Dockerfile`, `ecosystem.config.js`, workflows CI | 5–15 % de CPU en moins (AsyncLocalStorage), sécurité | ½ j |
| **P1-3** | Paralléliser les `await` séquentiels de `analytics/school/overview` et `finance/dashboard`, et borner les `Promise.all` larges (≤ 4 en parallèle) pour ne pas vider le pool | routes citées, `admin.ts` | Latence ÷ 2–3, pool préservé | 1 j |
| **P1-4** | Limiteur strict sur les **écritures** seulement (POST/PUT/PATCH/DELETE) | `src/proxy.ts` | Supprime les 429 en navigation | 1 h |
| **P2-1** | Un seul `auth()` par requête API (transmettre la session du proxy au handler, ou mémoïser par requête) | `proxy.ts`, `api-helpers.ts` | −2 à 4 ms par appel | ½ j |
| **P2-2** | Index ou réécriture de `summarizeSubjects*` (jointure sur `student_analytics` filtrée par école/année au lieu d'un `IN` de milliers d'ids) | `services/analytics-dashboard/queries.ts`, `schema.prisma` | Fin du parcours complet de `subject_performances` | ½ j |
| **P2-3** | Alléger `/login` (sortir framer-motion et le code du tableau de bord du bundle de la page publique) | `app/(auth)/login`, composants | 305 Ko → ~100 Ko gzip, 3G ~4 s plus rapide | ½ j |
| **P2-4** | Réduire l'enveloppe RLS : une transaction par requête HTTP (contexte posé une fois) | `lib/db/scoped-client.ts`, `api-helpers.ts` | CPU Prisma −30 à 45 %, +25–50 % de marge PostgreSQL | 2–3 j + tests RLS |
| **P2-5** | Corriger `loginSchema` (accepter les adresses Unicode ou normaliser) et le seed (adresses ASCII) | `lib/auth/config.ts`, `prisma/seeds/seed-people.ts` | 34 % des comptes de test utilisables ; mesures fiables | 1 h |
| **P3** | Tests de charge en CI (autocannon sur 10/50 connexions, seuils p95) + suivi du thread principal (event-loop lag) dans `/api/health` | `scripts/quality/`, workflows | Non-régression | 1 j |

**Ordre recommandé :** P0-1 → P0-2 → P0-3. Ces trois corrections lèvent les blocages vécus par les utilisateurs
(connexions refusées, serveur gelé, accueil lent) sans rien changer à l'hébergement. Ensuite P1-1 multiplie la
capacité par le nombre de cœurs.

---

## 11. Reproduire les mesures

```bash
# Base jetable (port 5433) + migrations + rôle applicatif
QUALITY_PG_PORT=5433 node scripts/quality/disposable-pg.mjs edupilot_audit &
U="postgresql://edupilot:edupilot@127.0.0.1:5433/edupilot_audit?schema=public"
DATABASE_URL=$U npx prisma migrate deploy
ADMIN_DATABASE_URL=$U APP_DB_PASSWORD=audit-app-role-password node scripts/db/setup-app-role.mjs

# Build + serveur (limites générales levées pour mesurer le serveur, pas le limiteur)
npm run build
DATABASE_URL="postgresql://edupilot_app:audit-app-role-password@127.0.0.1:5433/edupilot_audit?schema=public" \
  AUTH_TRUST_HOST=true NEXTAUTH_URL=http://localhost:3100 UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN= \
  SKIP_ENV_VALIDATION=true RATE_LIMIT_USER_PER_MIN=1000000 RATE_LIMIT_IP_PER_MIN=1000000 \
  npm run start -- -p 3100 &

export QUALITY_DATABASE_URL=$U QUALITY_DISPOSABLE_DB=1 QUALITY_PASSWORD='Test123456!'
export QUALITY_SERVER_PID=$(ss -ltnp | grep ':3100' | grep -oP 'pid=\K[0-9]+' | head -1)
node scripts/quality/smoke.mjs SCHOOL_ADMIN TEACHER PARENT STUDENT    # §2.1
node scripts/quality/latency.mjs SCHOOL_ADMIN 20                      # §2.2
node .quality-tmp/perf-unit.mjs SCHOOL_ADMIN "/api/classes,/dashboard" # §3
node .quality-tmp/perf-ramp.mjs "10,25,50,100,200,400" 20              # §4
node .quality-tmp/perf-login-burst.mjs 30                              # §5 G3 (serveur SANS limites levées)
node .quality-tmp/perf-rls.cjs                                         # §5 G5
```

⚠️ Après 10 échecs de connexion depuis la machine de mesure, toutes les connexions sont refusées pendant 15 min
(G3). Redémarrer le serveur remet le compteur à zéro, puisque les limites sont en mémoire.

Les scripts `.quality-tmp/perf-*` sont jetables (dossier ignoré par git). Si ces mesures doivent devenir une
non-régression (P3), il faudra les déplacer dans `scripts/quality/`.
