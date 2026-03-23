<div align="center">
  <img src="public/logo.png" alt="EduPilot Logo" width="200"/>
  <h1>🎓 EduPilot - The Ultimate SaaS for Academic Excellence</h1>
  <p><em>World-Class School Management System • "Academic Luxe" Design • Fully GDPR Compliant</em></p>

  [![Next.js](https://img.shields.io/badge/Next.js-16.1-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
  [![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
  [![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis)](https://upstash.com/)
</div>

<br />

## 🌟 Introduction

**EduPilot** n'est pas qu'un simple logiciel de gestion scolaire. C'est un véritable écosystème SaaS (Software as a Service) pensé pour propulser les établissements éducatifs vers l'excellence. Conçu avec l'esthétique **"Academic Luxe"** (tons sombres profonds, accents dorés, interfaces épurées "Glassmorphism"), EduPilot offre une expérience utilisateur premium, digne des plus prestigieuses institutions.

Le système est **multi-tenant** (gestion native de plusieurs écoles indépendantes), hautement sécurisé (MFA, RBAC granulaire), conçu pour la souveraineté des données (**Conformité 100% RGPD**), et embarque des fonctionnalités d'intelligence artificielle avancées.

---

## 🏗 Architecture & Stack Technique Haute Performance

EduPilot est construit sur les standards les plus récents et exigeants de l'industrie :

- **Framework Core :** Next.js 16 (App Router, Server Actions, Middleware Edge)
- **Langage :** TypeScript (End-to-end type safety)
- **Base de données relationnelle :** PostgreSQL managée via **Prisma ORM**
- **Mise en cache & Rate Limiting :** Redis (Upstash)
- **Styling & UI :** Tailwind CSS + Radix UI + Framer Motion (Animations fluides)
- **Validation & Sécurité :** Zod (Validation stricte des schémas), NextAuth.js v5 (Authentification & Sessions)
- **Infrastructure :** Docker / Docker-compose / Déploiement PM2
- **Testing :** Vitest (Unit) & Playwright (E2E)

---

## 👥 Un Écosystème Multi-Profils (RBAC)

EduPilot connecte tous les acteurs de la vie éducative avec des tableaux de bord et des fonctionnalités adaptés sur mesure.

### 1. 🌐 Super Admin (Master Control)
Le *Dieu* du système. Il pilote le SaaS dans son intégralité.
* **Master Dashboard :** Statistiques globales, MRR (Revenus globaux), Croissance utilisateurs.
* **Onboarding d'écoles :** Création et configuration instantanée de nouveaux établissements clients.
* **Surveillance Système :** Logs d'audit universels, intégrité du cache, rétention de données automatisée.

### 2. 🏛️ School Admin & Director (Gestion d'Établissement)
Les pilotes de la scolarité pour leur établissement spécifique.
* **Configurations Académiques :** Années scolaires, trimestres, matières, barèmes.
* **Ressources Humaines & Finance :** Affectation des professeurs, suivi des paiements (facturation, échéanciers, portefeuilles), alertes d'impayés.
* **Scolarité :** Gestion des exclusions, changements de classe, diplomation, passage d'année.

### 3. 👨‍🏫 Professeurs / Enseignants
La salle de classe numérique au creux des mains.
* **LMS (Learning Management System) Complet :** Création de leçons interactives, upload de ressources, gestion des devoirs.
* **Cahier de Textes & Notes :** Saisie ultra-rapide des notes, calculs de moyennes automatiques, validation des livrets scolaires.
* **Assiduité & Comportement :** Appel numérique quotidien, signalement d'incidents, attribution de bons points (Gamification/Achievements).
* **Communication :** Messagerie directe avec les parents et les élèves.

### 4. 👨‍🎓 Étudiants / Élèves
L'expérience académique augmentée.
* **Dashboard Premium :** Vue d'ensemble sur l'emploi du temps, les devoirs à venir, le classement et les performances.
* **Learning Hub :** Accès aux cours en ligne, passage d'examens dématérialisés avec timer et auto-correction.
* **Tickets Cantine & Emprunts :** Suivi des QR Codes de restauration et de la bibliothèque.
* **IA Buddy :** Chatbot IA (Ollama / Local) pour aider aux révisions et réexpliquer les concepts complexes en temps réel.

### 5. 👨‍👩‍👧‍👦 Parents
Implication totale sans friction.
* **Portail Famille :** Visualisation des enfants multiples sous le même compte.
* **Suivi en temps réel :** Notifications push (ou SMS/Email via webhooks) pour les absences, les sanctions ou les excellentes notes.
* **Espace Financier :** Consultation des échéances, paiement en ligne, reçus de scolarité.

---

## 🚀 Modules Clés & Fonctionnalités Détaillées

### 📚 Pédagogie & Évaluations
- **Système de Notation Dynamique :** Support de multiples types d'évaluations (Contrôles continus, partiels, examens blancs) avec coefficients personnalisables.
- **Génération de Bulletins :** Génération PDF ultra-rapide des livrets scolaires avec graphiques d'évolution, appréciations, et signatures électroniques.
- **LMS Intégré :** Cours structurés en chapitres, devoirs remis en ligne avec feedbacks interactifs.

### 💰 Finance & Comptabilité
- **Flexibilité de Paiement :** Scolarité forfaitaire ou plans de versements (Installments).
- **Trésorerie :** Gestion des paiements en espèces (cash-desk) et paiements électroniques via Webhooks de passerelles de paiement.
- **Rapports Financiers :** Export Excel de la balance, suivi des relances, gestion des bourses (Scholarships).

### 🏥 Santé & Sécurité (Health/Discipline)
- **Dossiers Médicaux :** Suivi des allergies, groupes sanguins, contacts d'urgence, et journal des vaccinations.
- **Discipline :** Enregistrement des incidents de comportement, conseils de discipline, rappels à l'ordre, et sanctions hiérarchisées.

### 🔒 Conformité RGPD & Sécurité de Grade Militaire (World-Class Security)
EduPilot ne transige JAMAIS sur la sécurité de la donnée.
- **Portabilité (Art 15 & 20) :** Extraction "One-Click" d'absolument TOUTES les données d'un utilisateur au format JSON.
- **Droit à l'Oubli (Art 17) :** Module d'anonymisation interactif de la base de données (hashing réversible, destruction des traces, maintien de l'intégrité comptable).
- **Politiques de Rétention :** Jobs de nettoyage stricts (ex: suppression des logs serveur ou des brouillons de messages après *X* années).
- **Surveillance :** Rate Limiting drastique (Redis) au niveau Endpoint, protections CSRF, et Content-Security-Policy strictes via le Edge Middleware. **Tout est loggé** de manière inaltérable (Audit Logs).

---

## 🛠 Guide de Déploiement Rapide (Getting Started)

L'environnement de développement a été pensé pour être lancé en un minimum de frictions.

### 1. Prérequis
- Node.js `20.x` (LTS recommandé)
- PostgreSQL `15+`
- Redis (Local ou Upstash)

### 2. Installation Locale

```bash
# Cloner le dépôt et installer les dépendances (Lockfile respecté)
git clone https://github.com/votre-org/edupilot.git
cd edupilot-master
npm install

# Configurer les variables d'environnement
cp .env.example .env
# -> /!\ Éditez soigneusement le fichier .env (DATABASE_URL, UPSTASH_REDIS_REST_URL, NEXTAUTH_SECRET)

# Générer les clients Prisma et appliquer le schéma
npx prisma generate
npx prisma db push
```

### 3. Le Script de Seed Magique 🌟
EduPilot embarque un orchestrateur de seed massif générant une école complète, cohérente, avec des centaines d'entrées réalistes, de la comptabilité aux profils médicaux :

```bash
# Générer tout le dataset de démonstration
npm run db:seed
```
*Génère automatiquement 3 écoles, des dizaines d'admins, directeurs, professeurs, élèves, notes, présences, et transactions financières.*

**Comptes de connexion par défaut créés par le Seed (UNIQUEMENT pour le développement local) :**
- Super Admin: `admin@edupilot.bj`
- Admin École: `admin@saintmichel.bj`
- Directeur: `directeur@saintmichel.bj`
- Professeur: `m.agbossou@saintmichel.bj`

> ⚠️ Ces comptes et le mot de passe universel `Password123!` ne doivent JAMAIS être utilisés ou conservés tels quels sur un environnement exposé (staging ou production). En production, créez vos propres comptes avec des mots de passe forts et/ou des tokens de premier login.

### 4. Lancement du Serveur de Développement

```bash
npm run dev
# L'application sera disponible sur http://localhost:3000
```

---

## 🚢 Déploiement Production

Pour la production, EduPilot compile de manière agressive pour optimiser les performances Turbopack.

```bash
# Type check et validation Prisma
npm run type-check
npx prisma validate

# Build Next.js
npm run build

# Démarrer en production
npm run start
```

Un script `deploy.sh` ainsi que les fichiers `ecosystem.config.js` (pour PM2) et `docker-compose.yml` sont fournis nativement à la racine du projet pour faciliter l'intégration DevOps CI/CD.

---

## 🎨 Philosophie de Design : "Academic Luxe"

Fini les interfaces ternes des ERP scolaires des années 2000. L'UI d'EduPilot a été craftée avec amour :
- **Dark Mode Natif :** Fond d'écran minéral et composantes `Glassmorphism` superposées.
- **Couleurs :** Accents Or/Ambre (`amber-500` / `yellow-600`) évoquant le prestige académique, contrastant avec des bleus pétrole et ardoise (`slate-900`, `zinc-950`).
- **Composants Radix :** Boutons réactifs, modals fluides, et squelettes de chargement (skeletons) pour ne jamais frustrer l'œil.

---

<p align="center">
  <i>EduPilot — Parce que l'éducation d'excellence nécessite des outils d'excellence.</i><br/>
  Propulsé avec ❤️ par votre équipe d'Agents AI & Ingénieurs.
</p>
