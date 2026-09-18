# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [1.3.0] - 2026-09-18

Remise à niveau production, branche `fix/production-readiness` : 145 commits
répondant à l'audit du 2026-09-11 (`docs/AUDIT.md`, note 5,8/10). Le détail
défaut par défaut, avec les mesures avant/après, est dans
[`docs/REMEDIATION_PROGRESS.md`](docs/REMEDIATION_PROGRESS.md).

### 🔐 Sécurité

- **Limites de débit incontournables** : l'adresse du client est établie par le
  serveur ; `X-Forwarded-For` n'est lu que si un proxy de confiance est déclaré
  (`TRUSTED_PROXY_HOPS`). Avant, 130 requêtes à en-tête tournant passaient sans
  un seul refus [H3].
- **Connexion protégée de la force brute** : 10 échecs par adresse et par
  quart d'heure. Une connexion réussie rend l'unité consommée, pour qu'une
  école derrière une seule adresse publique ne se bloque pas elle-même [H4].
- **Isolation entre établissements** : balayage des 70 routes `[id]` depuis un
  administrateur d'une autre école, et correction de toutes celles qui
  répondaient. Une ressource d'un autre établissement répond 404, sans révéler
  son existence [H5].
- **RLS PostgreSQL effective** : rôle applicatif non propriétaire,
  `FORCE ROW LEVEL SECURITY` sur les tables sensibles [M2].
- **Second facteur** imposé jusque dans les routes d'API ; mot de passe
  provisoire **unique** par compte, à changer à la première connexion [M1].
- **Dépendances** : `npm audit --omit=dev --audit-level=high` renvoie **0**
  (Next.js, nodemailer, sharp) [C2][M7].
- En-têtes et fuites : `X-XSS-Protection` retiré, `/api/system/backup` n'expose
  plus de chemin ni de sortie de commande [L1][L2][L5].

### ⚡ Performance

- `/api/evaluations` : **13,9 s et 99 Mo** → sous la seconde, sans les notes,
  paginé. Plus aucune réponse au-dessus de 1 Mo ni de 1 s sur le parcours des
  sept rôles [C3].
- Empreinte mémoire du serveur : **8,7 Go** après la série de mesures →
  **395 Mo** [M4].
- Statistiques et analyses agrégées en base plutôt qu'en mémoire ; boucles N+1
  remplacées par des requêtes groupées ; index ajoutés seulement quand
  `EXPLAIN ANALYZE` les justifiait.
- Chargement à la demande de SheetJS, des onglets d'analyse et des graphiques.

### 🗄 Intégrité et exploitation

- **34 migrations versionnées** : un clone neuf passe `migrate deploy` et
  démarre, sans seed. Contrôle `prisma migrate diff --exit-code` en CI [C1].
- **Image de production** qui se construit, applique les migrations au
  démarrage et n'expose plus la base ni le cache sur le réseau de
  l'établissement.
- **Arrêt propre** sur SIGTERM : requêtes en cours menées à terme, Prisma et
  Redis fermés.
- **Sauvegarde chiffrée** avec rotation, et restauration prouvée par
  recomptage ligne à ligne.
- **Tâches planifiées** déclenchables et planifiables sans Vercel Cron.
- **Journaux JSON** portant un identifiant de requête, repris dans la réponse.
- Coupe-circuit Redis : avec un cache injoignable, la latence reste sous
  300 ms au lieu de 4,3 s [H6].
- `docs/EXPLOITATION.md` : variables, démarrage, migrations, sauvegarde,
  restauration, tâches, rotation des secrets, conduite à tenir en panne.

### 🧑‍🎓 Démarrage à vide et données réelles

- Parcours d'installation complet **depuis l'interface**, sur une base vide :
  premier super-administrateur, établissement, année, périodes, niveaux,
  classes, matières, comptes, première saisie de notes, consultation par un
  parent. Couvert par un E2E dédié.
- Import CSV/Excel **en tout ou rien**, avec rapport d'erreurs ligne à ligne,
  détection des doublons, encodages UTF-8 et Windows-1252, noms accentués.
- Scripts dangereux (seeds, réinitialisations) **refusant de s'exécuter** sur
  une base qui ne porte pas le marqueur `edupilot:disposable`. Les comptes de
  démonstration ne peuvent plus exister en production.

### 🛡 Données personnelles

- **Activation par module** : navigation masquée *et* API bloquée. Les modules
  sensibles, la santé en particulier, peuvent être désactivés.
- **Consentement** horodaté et versionné à la première connexion, avec le suivi
  du représentant légal pour les comptes d'élèves mineurs.
- **Droits des personnes** exerçables et testés : export, rectification,
  suppression ou anonymisation.
- **Fin de conservation** : script d'export puis d'effacement par
  établissement, avec rapport de vérification par table.
- **Traçabilité** : notes, santé, paiements et rôles écrits dans `AuditLog`.
- **Journaux expurgés** : aucun nom, e-mail, note, donnée de santé ni contenu
  de message en clair.

### 📐 Contrats et outillage

- **Un seul format de pagination** dans toute l'API :
  `{ data, pagination: { limit, nextCursor, hasNextPage, total? } }`.
  L'ancien `?page=` est retiré ; il est ignoré sans erreur.
- **Spécification OpenAPI générée depuis le code et les schémas Zod**
  (`npm run docs:openapi`) : 287 chemins, 463 opérations, 45 schémas, servie
  par `/api/docs`. Elle remplace un document écrit à la main qui en décrivait
  quatre [M9].
- **Suite d'intégration sur vrai PostgreSQL** (323 tests) en CI, aux côtés des
  2 959 tests unitaires et d'API. CI bloquante.
- Modules de limitation de débit et d'environnement **consolidés** : un seul de
  chacun, au lieu de trois [L3].
- `docs/design/INVENTAIRE_UI.md` : état de l'interface avant refonte (constat).

### 🐛 Corrections notables

- Une panne de chargement ne se déguise plus en absence de données : 27 pages
  distinguent l'erreur de l'état vide.
- Connexion : une panne technique n'est plus présentée comme un identifiant
  invalide [M10].
- JSON illisible et corps refusé par le schéma répondent 400 (et non 500), avec
  le détail par champ ; plafond de taille de corps [M3].
- La page d'analyse de la console root ne répond plus 500 [N15].
- L'instrumentation ne s'exécutait pas du tout en production : ni validation
  d'environnement, ni garde RLS, ni fermeture propre.

### ⚠️ Rupture de contrat

- `?page=` et `?pageSize=` ne sont plus lus. Les clients qui les envoient
  reçoivent la première page au format unique, sans erreur. `/api/teachers` et
  `/api/finance/payments` changent la forme de leur réponse en conséquence.
- `X-XSS-Protection` n'est plus émis (en-tête obsolète et nuisible).

---

## [1.2.0] - 2026-08-16

### 🚀 Nouveautés majeures (juin–juillet 2026)

- **RBAC réseau** : nouveau rôle `NETWORK_ADMIN` (héritage de `SCHOOL_ADMIN`,
  périmètre multi-sites MAIN + annexes, matrice de permissions, gardes de
  routes et de pages).
- **Signatures électroniques** : bulletins et autorisations signés.
- **RH** : gestion du personnel (présences, congés, paie) + comptabilité OHADA
  (journaux, écritures en partie double, pièces comptables).
- **IA** : socle autonome avec cascade de providers (GROQ/OpenAI → n8n),
  prédiction de décrochage, alerte précoce, analyse comportementale et
  orientation BEPC.
- **Paiements** : FedaPay et MoMo Collection branchés (initiation, webhooks,
  rapprochement).
- **Vitrine publique** : site de présentation + annuaire des établissements.
- **Élèves** : carte scolaire imprimable avec QR badge.
- **Alumni** : annuaire des anciens élèves.
- **Contrôle d'accès** : badges QR, points de scan et journal d'accès.
- **Parents** : vérification du lien parent-enfant par code de liaison.
- **UX** : auto-save, mises à jour optimistes, rétention des analytics,
  accessibilité.
- **Refactoring** : découpe des fichiers > 1 200 lignes, chrome commun des
  pages (PageShell/PageHeader/PageStates), resolvers Zod typés.

### 🔒 Production-ready — remédiation post-audit

#### Corrigé
- **Build** : 7 erreurs TS `medical-records/*` (handlers → `createApiHandler` +
  retours `NextResponse` explicites).
- **Tests** : garde `request.nextUrl?.pathname` dans `createApiHandler` → les 16
  tests API (upload / fedapay / auth / grades) repassent ; suite **1 129 verts**.
- **Latence API** : plus de CSP/nonce HTML sur les réponses `/api/*` authentifiées ;
  skip du double rate-limit Redis via `x-edupilot-edge-rl`.
- **Fake data** : métriques SMS inventées, barres WhatsApp inventées, carte GPS
  transport factice → empty states honnêtes.
- **Docs** : README IA (LLM cloud / n8n), métriques perf marquées comme cibles ;
  ARCHITECTURE sans Three.js ; TECH_DEBT TD-004/008/009/010/011 à jour.
- **Communication** : modèles SMS persistés (`CommunicationTemplate`) + seed auto
  + UI load/save/create ; seuils couverture API remontés (10/8/8) ; typage charts
  analytics ; **0 `any` explicite** + ESLint `no-explicit-any` en error.

### 📊 État de la CI
`tsc --noEmit` 0 erreur · `eslint src` 0 erreur · **1 141+ tests verts**.

### 🔒 Sécurité — le second facteur devient effectif

#### Corrigé
- **Critique — 2FA non imposé.** `authorize()` délivre volontairement une
  session « pré-2FA » (mot de passe validé, code TOTP pas encore fourni), mais
  rien ne confinait cet état : `src/proxy.ts` ne vérifiait que l'existence de la
  session, et seules les 75 routes passant par `createApiHandler` testaient
  `isTwoFactorAuthenticated`. Un attaquant disposant du mot de passe d'un compte
  protégé par 2FA accédait à 192 routes d'API et à toutes les pages. Le 2FA
  était **décoratif**.
  → Garde ajouté au middleware, seul point couvrant les 283 routes et les 174
  pages : `403 MFA_REQUIRED` sur l'API, redirection `/mfa-verify` sur les pages.
- **Force brute sur le TOTP.** La vérification du code (callback JWT) n'avait
  aucun plafond de tentatives sur 10⁶ combinaisons.
  → `MFA_VERIFY_RATE_LIMIT` : 5 essais / 10 min par utilisateur, remis à zéro au
  succès, dépassement audité.
- **Verrouillage de compte contourné par le 2FA.** Un code erroné dans
  `authorize()` levait une exception sans appeler `recordFailedLoginAttempt` :
  le verrouillage protégeait le mot de passe mais pas le second facteur.
  → Compteur incrémenté, audit `LOGIN_FAILED_2FA`.
- **Documentation trompeuse.** `docs/SECURITY.md` §2.3 affirmait qu'il n'y avait
  « pas de codes de secours en V1 » alors qu'ils sont implémentés (10 codes
  hachés, à usage unique).

#### Ajouté
- Page `/mfa-verify` : saisie TOTP, bascule vers un code de secours,
  déconnexion, retour à la destination initiale via `callbackUrl`.
- `src/components/auth/OtpInput.tsx` : saisie à 6 chiffres partagée (focus,
  collage, navigation clavier, `aria-describedby`).
- Journalisation `MFA_VERIFIED`, `MFA_VERIFIED_BACKUP_CODE`,
  `MFA_VERIFY_RATE_LIMITED`, `LOGIN_FAILED_2FA`.
- `tests/lib/auth/mfa-gate.test.ts` — 8 cas de non-régression, **vérifiés rouges
  sans le correctif**.
- `TECH_DEBT.md` : registre de dette technique chiffré sur le dépôt réel.

### 📊 État de la CI (2026-08-16)
`tsc --noEmit` 0 erreur · `eslint src` 0 erreur · **1 169 tests verts** (126
fichiers) · `next build` OK.

## [1.1.0] - 2025-03-23

### 🎉 Version de Finalisation & Optimisation

#### ✨ Ajouté
- **Tests unitaires et d'intégration** : 26 nouveaux tests (+240 tests au total)
  - Tests système d'import (validation, mapping, matricule)
  - Tests cache et rate limiting
  - Tests RBAC et isolation multi-tenant
- **Documentation développeur** : Guide complet `DEVELOPMENT.md`
  - Setup rapide et prérequis
  - Structure du projet
  - Configuration complète
  - Debugging et troubleshooting

#### 🐛 Corrigé
- **Bug critique import étudiants** : Mapping gender M/F → MALE/FEMALE manquant
  - Impact : 100% des imports avec genre échouaient
  - Fix : Transformation automatique dans `/app/src/app/api/import/students/route.ts`
- **Next.js config** : Suppression option deprecated `swcMinify`
- **Endpoint `/api/schools/[id]`** : Error handling et permissions améliorés

#### ⚡ Optimisé
- **Rate limiting adaptatif par environnement**
  - Dev : x5 limites (500 req/min API, 100 strict) → Navigation 5x plus rapide
  - Prod : Limites sécurisées maintenues (100/20 req/min)
- **Variables d'environnement** : Ajout optionnelles pour éliminer warnings
  - TOTP_ENCRYPTION_KEY, EMAIL_*, UPSTASH_*

#### 🗑️ Nettoyé
- Fichier doublon `/app/src/lib/redis-cache.ts` supprimé
- Test obsolète associé supprimé

#### ✅ Testé & Validé
- **Système d'import complet** : Tests E2E automatisés
  - Import étudiants ✅ 100% fonctionnel
  - Import professeurs ✅ 100% fonctionnel
  - Import parents ✅ 100% fonctionnel
- **Suite de tests** : 240 tests passent avec succès
- **Données de test** : 6 utilisateurs créés (2 étudiants, 2 profs, 2 parents)

---

## [1.0.0] - 2024-03-23

### 🎉 Version Initiale Complète

#### ✨ Ajouté

**Infrastructure & Configuration**
- Configuration production complète avec Next.js 16
- Middleware de sécurité global avec authentification et rate limiting
- Pipeline CI/CD GitHub Actions complet
- Configuration Docker optimisée multi-stage
- Configuration PM2 pour déploiement sans Docker
- Variables d'environnement de production documentées

**Performance & Optimisation**
- Système de cache Redis distribué avec fallback in-memory
- Monitoring de performance avec métriques détaillées (p50, p95, p99)
- Optimisation des images avec next/image
- Code splitting automatique par route
- Compression gzip/brotli configurée
- Headers de cache optimisés pour les assets statiques

**Sécurité**
- Middleware de sécurité avec headers CSP, HSTS, X-Frame-Options
- Rate limiting multi-niveaux (API, auth, upload, operations sensibles)
- Protection CSRF et XSS
- Audit logs complets
- Support 2FA (TOTP) avec chiffrement AES-256
- Conformité RGPD (export, oubli, portabilité des données)

**Tests**
- Tests unitaires pour le système de cache
- Tests de performance et monitoring
- Tests E2E Playwright pour authentification et dashboard
- Configuration Vitest avec coverage
- Tests de sécurité (RBAC, brute-force, RGPD)

**Documentation**
- Documentation API complète avec tous les endpoints
- Guide de déploiement détaillé (Docker, PM2, Cloud)
- Documentation d'architecture technique
- Guide de contribution pour les développeurs
- README enrichi avec toutes les informations essentielles

**Modules Fonctionnels**
- 👥 Gestion des utilisateurs (CRUD complet, 8 rôles différents)
- 🏫 Multi-tenant avec isolation par école
- 👨‍🎓 Gestion des élèves et inscriptions
- 👨‍🏫 Gestion des enseignants et affectations
- 📚 Notes et évaluations (types configurables, coefficients)
- 📊 Présences et absences
- 💰 Finance (paiements, échéanciers, bourses)
- 📝 Devoirs et soumissions
- 💬 Messagerie interne
- 🔔 Système de notifications
- 🎓 LMS (cours, modules, leçons)
- 🏥 Dossiers médicaux
- ⚖️ Discipline et sanctions
- 📈 Analytiques et statistiques avancées
- 📅 Calendrier scolaire
- 📖 Bibliothèque
- 🍽️ Cantine et tickets repas
- 🎮 Gamification (achievements, leaderboard)
- 📜 Certificats

**UI/UX**
- Design "Academic Luxe" (dark mode, glassmorphism)
- 85+ composants React réutilisables
- Composants UI Radix accessibles
- Animations Framer Motion
- Graphiques Recharts
- Interface responsive mobile-first
- 40+ pages dashboard par rôle

#### 🔧 Changé

- Migration vers Next.js 16 App Router
- Optimisation de la configuration Next.js pour la production
- Amélioration du schéma Prisma avec indexes stratégiques

#### 🐛 Corrigé

- Correction des problèmes de rate limiting en environnement multi-instance
- Fix de la validation des formulaires avec Zod
- Amélioration de la gestion des erreurs API

#### 🔒 Sécurité

- Implémentation CSP stricte
- Rate limiting distribué avec Redis
- Headers de sécurité complets
- Validation stricte des inputs avec Zod
- Protection contre les attaques par force brute

---

## [Unreleased]

### 🚀 Nouveautés majeures

#### ✨ Ajouté

- **Integration IA pour l'assistant d'étude** : l'assistant pourra répondre aux questions des étudiants, proposer des résumés de cours et aider à la préparation des examens.
   - Génération d'explications adaptées au niveau de chaque utilisateur
   - Citations et références vers les sources utilisées

- **Application mobile React Native** : une application mobile iOS et Android pour accéder aux fonctionnalités de l'assistant depuis un téléphone ou une tablette.
   - Consultation des cours et des ressources hors ligne
   - Synchronisation automatique entre les appareils

- **Internationalisation (i18n) multi-langues** : support de multiples langues pour l'interface utilisateur afin d'atteindre un public international.
   - Français, anglais et espagnol disponibles au lancement
   - Détection automatique de la langue du navigateur

- **Tableaux de bord personnalisables** : chaque utilisateur pourra configurer ses tableaux de bord pour afficher les statistiques et les informations qui lui importent le plus.
   - Choix des widgets et de leur disposition
   - Export des données au format CSV

- **API publique avec webhooks** : une API publique permettra aux développeurs d'intégrer l'assistant dans leurs propres applications.
   - Documentation complète avec exemples de code
   - Webhooks pour recevoir les événements en temps réel

- **Templates d'emails personnalisables** : personnalisation des templates d'emails pour les notifications, les rappels et les communications aux utilisateurs.
   - Éditeur visuel avec aperçu en direct
   - Variables dynamiques intégrées

- **Notifications push** : alertes en temps réel pour informer les utilisateurs des événements importants.
   - Notifications de rappel de devoirs et d'examens
   - Paramètres de notification par canal et par type

- **Intégration paiements Stripe/Paystack** : intégration des paiements en ligne pour les abonnements et les achats intégrés.
   - Abonnements mensuels et annuels
   - Gestion des factures et reçus

- **Génération de bulletins PDF améliorée** : génération de bulletins PDF avec des options de personnalisation supplémentaires.
   - Choix des modèles et du format
   - Ajout du logo de l'établissement

- **Thèmes personnalisables** : choix de thèmes pour modifier l'apparence de l'application.
   - Mode sombre et mode clair
   - Thèmes de couleurs personnalisés

À completer à la sortie de la version.

---

## Notes de version

### Comment lire ce changelog

- **Ajouté** : Nouvelles fonctionnalités
- **Changé** : Modifications de fonctionnalités existantes
- **Déprécié** : Fonctionnalités bientôt supprimées
- **Supprimé** : Fonctionnalités supprimées
- **Corrigé** : Corrections de bugs
- **Sécurité** : Changements liés à la sécurité

### Versioning

EduPilot suit le Semantic Versioning :
- **MAJOR** (X.0.0) : Changements incompatibles
- **MINOR** (0.X.0) : Nouvelles fonctionnalités rétrocompatibles
- **PATCH** (0.0.X) : Corrections de bugs

### Support

- **v1.x** : Support complet jusqu'à fin 2025
- **v0.x** : Non supporté (développement)

---

Pour plus d'informations, consultez :
- [Documentation](docs/)
- [Roadmap](https://github.com/votre-org/edupilot/projects)
- [Issues](https://github.com/votre-org/edupilot/issues)
