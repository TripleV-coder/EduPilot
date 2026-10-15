# Audit de sécurité — 2026-10-14

Analyse défensive, uniquement sur des environnements locaux : serveur de production local (`next start`,
port 3100) branché sur la base **jetable** `edupilot_audit`, sous le rôle applicatif `edupilot_app` soumis
à la RLS. Aucun test contre un service tiers ni contre la production. Aucun secret reproduit ici.

Niveaux de preuve : **[E]** exécution, **[S]** inspection statique, **[C]** indice à investiguer.

## 1. Authentification

| Contrôle | Résultat | Preuve |
|---|---|---|
| Échecs répétés sur UN compte depuis une IP → blocage | 429 à partir du 11ᵉ échec | [E] `evidence/23`, `24` (H4) |
| Échecs sur des comptes DIFFÉRENTS depuis une IP d'école → pas de blocage collectif | 12 × 302, aucun 429 | [E] `evidence/23` (G3) |
| Usurpation de `X-Forwarded-For` pour contourner le compteur | **refusée** : 12 IP usurpées différentes → 10 × 302 puis 2 × 429 | [E] `evidence/25` (sonde discriminante) |
| Comptage fondé sur l'adresse réelle de la socket (`TRUSTED_PROXY_HOPS=0`) | conforme | [S] `src/lib/security/client-ip.ts`, `scripts/server/client-ip-preload.cjs` |
| Mots de passe : bcrypt natif coût 12, file d'attente bornée du pool libuv | conforme | [S] `src/lib/auth/password.ts` |
| Inscription libre | désactivée (410) | [S] `src/app/api/auth/register/route.ts` |
| Installation initiale (`/setup`) | refusée dès qu'un utilisateur existe (transaction sérialisable) | [S] `src/app/api/auth/initial-setup/route.ts` |
| Consentement aux conditions avant accès | imposé après connexion | [E] parcours navigateur |

Risque résiduel (P4, [S]) : sur un déploiement **neuf**, le premier visiteur de `/setup` devient
SUPER_ADMIN ; aucun jeton d'installation. À traiter par procédure (installer avant l'exposition publique)
ou par un `SETUP_TOKEN`.

## 2. Autorisation et isolation des établissements

| Contrôle | Résultat | Preuve |
|---|---|---|
| Lecture d'une ressource d'une autre école (IDOR) | 404 | [E] H5 GET |
| Modification d'une ressource d'une autre école | 404, rien persisté | [E] H5 PATCH |
| Suppression d'une ressource d'une autre école | 404, rien supprimé | [E] H5 DELETE |
| `?schoolId=` d'une autre école | 403 | [E] TENANT |
| Appel API anonyme d'une route protégée | 401 `Non authentifié` | [E] `evidence/26` |
| Un enseignant modifie les règles de calcul de l'école | 403 | [E] `evidence/37` (S9b) |
| Formule d'une école sans effet sur une autre | vérifié | [E] `evidence/37` (S9) |
| Routes protégées par `createApiHandler` | 310 / 313 ; les 3 autres justifiées | [S] |
| RLS forcée sur 16 tables | présente dans les migrations | [S] |

Observation [E] : l'espace élève appelait `/api/students?limit=1` à chaque affichage de « Mes notes » et
recevait 403 (DEF-006, corrigé). Ce n'était pas une faille — le serveur refusait correctement.

## 3. Entrées, injections, moteur de formules

- Formules modifiables par les utilisateurs : **analyseur dédié**, aucun `eval`/`Function`
  dans `src/lib/academic/formula.ts` [S] ; 8 tentatives d'injection (`process.exit`, `require('fs')`,
  `constructor.constructor(...)`, `__proto__`, `fetch`, gabarits, opérateurs logiques, `globalThis`) toutes
  refusées [E] `tests/precision/formula-engine.audit.test.ts` ; longueur ≤ 300, imbrication ≤ 20,
  très grands nombres exacts (BigInt), analyse de la plus longue formule acceptée × 200 < 2 s [E].
- Corps JSON vide ou cassé sur `POST /api/classes` → 400 [E] (M3).
- Requêtes SQL brutes : `Prisma.sql` paramétré (ex. `src/lib/services/grade-statistics.ts`) [S]. Pas de
  test d'injection SQL dynamique dédié.

## 4. En-têtes HTTP et CORS — [E] `evidence/26-http-headers.log`

CSP `default-src 'self'; script-src 'self' 'nonce-…' 'strict-dynamic'`, HSTS 2 ans `includeSubDomains;
preload`, `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy:
strict-origin-when-cross-origin`, `Permissions-Policy` restrictive. Pré-requête CORS depuis une origine
étrangère : aucun en-tête `Access-Control-Allow-*` renvoyé. Pas de `x-powered-by`.

Note : `upgrade-insecure-requests` (CSP, `src/proxy.ts:57`) empêche l'enregistrement du service worker sur
`http://localhost` (erreur console observée) — artefact du test en HTTP local, pas un défaut en HTTPS.

## 5. Webhooks et crons — [S]

| Route | Protection | Secret absent |
|---|---|---|
| `payments/webhook` (Flutterwave/Paystack) | HMAC + `timingSafeEqual`, en-tête de signature obligatoire | refus (401) |
| `payments/momo/webhook` | HMAC `x-momo-signature` | refus |
| `payments/fedapay/webhook` | SDK `verifyFedaPayEvent` | refus (401) |
| `system/retention` | `CRON_SECRET` | 401 [E] |
| `system/automation` | `CRON_SECRET` | **500 « Configuration Error »** [E] (DEF-010, P4 : fermé, mais code d'erreur incohérent) |

[C] Le contrat « verif-hash » de Flutterwave est implémenté comme un HMAC-SHA256 du corps. À confronter à
la documentation du fournisseur avant toute activation (risque : webhooks légitimes refusés, pas
d'acceptation indue, puisque toute erreur conduit à un refus).

## 6. Dépendances — [E] `evidence/09`, `evidence/55`

| Paquet | Avant | Avis | Après correction |
|---|---|---|---|
| `next` | 16.3.5 | **critique** RCE `next/og ImageResponse` (≥16.2.0 <16.3.6) — module utilisé par `src/app/opengraph-image.tsx` ; élevé SSRF optimisation d'images ; modérés empoisonnement de cache | **16.3.8** — avis levés |
| `axios` (via `fedapay`) | 1.19.0 | 12 avis dont 7 élevés (pollution de prototype, SSRF par redirection, ReDoS) | **1.20.0** (override) |
| `dompurify` | 3.4.13 | faible (mode `IN_PLACE`, non utilisé) | **3.4.17** |
| `brace-expansion` 5.x | 5.0.9 | élevé (DoS) | **5.0.12** (override ciblé `brace-expansion@^5`) |
| `sharp` (via `next`) | 0.35.4 | élevé (librsvg) | **ouvert** : `npm view sharp@^0.35.5` ne renvoie aucune version au moment de l'audit |
| `source-map-js` | 1.2.1 | élevé (DoS, cartes de sources) | **ouvert** : aucune version ≥ 1.2.2 trouvée par `npm view` |

Exploitabilité : pour `next`, la vulnérabilité concernait un module **réellement utilisé** (image Open
Graph), alimenté par du contenu statique ; l'exploitation n'a **pas** été tentée. Les avis restants
concernent le traitement d'images SVG et de cartes de sources : aucune entrée utilisateur identifiée vers
ces chemins [S] ; non démontré exploitable.

## 7. Données personnelles, secrets, IA

- Charge envoyée au LLM externe pseudonymisée (`src/lib/ai/pii.ts`, `src/lib/ai/external-client.ts`) [S].
  Comportement réel non testé (aucune clé LLM).
- Secrets : recherche de motifs (`sk_live_`, `AKIA…`, clés privées PEM) dans les fichiers suivis par Git
  [E] : seules des valeurs de test factices (`tests/lib/payments-live-mode.test.ts`) et des
  `.env.example`. Ce n'est **pas** un scan complet ; gitleaks est configuré dans
  `.github/workflows/pr-validation.yml` mais n'a pas été lancé pendant l'audit.
- Les preuves de l'audit ont été expurgées des identifiants de connexion (filtre dans `evidence/run.sh`).

## 8. Non réalisé

Scan DAST complet (ZAP), test d'injection SQL automatisé, fuzzing des formulaires, tests CSRF dédiés
(NextAuth gère un jeton CSRF, observé lors des connexions), revue individuelle des 313 routes.
