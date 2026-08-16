# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié] - 2026-08-03

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

## [Non publié] - 2026-07-30

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

### 📊 État de la CI
`tsc --noEmit` 0 erreur · `eslint src` 0 erreur · **1 129 tests verts** (115
fichiers, +8) · `next build` OK.

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
