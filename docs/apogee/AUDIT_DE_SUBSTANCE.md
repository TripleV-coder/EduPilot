# L'AUDIT DE SUBSTANCE — APOGÉE

## Périmètre
Analyse ciblée du frontend (Next.js 14, App Router) et de ses dépendances, avec extraction des règles métier et des flux asynchrones dominants. Les constats s'appuient sur la structure `src/app`, `src/hooks`, `src/lib` et les validations métier.

---

## Cartographie complète des dépendances

### Noyau d'exécution
- **Next.js 14 / React 18** : App Router, server + client components.
- **TypeScript 5** : typage global, interfaces métier.
- **Prisma 6** : modèles de données, validations métier côté serveur.
- **NextAuth v5 (beta)** : sessions et identité, adaptateur Prisma.

### État, data & asynchronisme
- **@tanstack/react-query** : orchestration des requêtes, cache, invalidation.
- **Zustand** : état local globalisé (ex: UI/latéraux).
- **Socket.io** : canaux temps réel (notifications, synchronisation).
- **Dexie / Serwist** : offline-first, synchro locale + service worker.

### Interface & interaction
- **Tailwind CSS + tailwind-merge** : tokens + utilitaires.
- **Radix UI** : primitives accessibles.
- **Framer Motion** : animations, transitions multi-axes.
- **Lucide React** : iconographie.

### Observabilité & sécurité
- **Upstash Ratelimit / Redis** : throttling et protection d'API.
- **Zod** : validation de schémas.
- **bcryptjs** : hashing des secrets.

---

## Règles métier critiques (extraction)

### Paiements & plans
- Démarrage d'un plan de paiement interdit dans le passé.
- Les mensualités doivent diviser le montant total avec tolérance minimale.
- Un plan actif/pending unique par élève/frais.
- Montant minimal par mensualité.

### Cours & LMS
- Publication d'un cours impossible sans module et leçon associés.
- Ordonnancement strict des modules (0..n sans trous).
- Inscription à un cours conditionnée à l'inscription de classe + unicité.

### Notes & évaluations
- Notes bornées selon configuration d'établissement.
- Plafond spécifique par évaluation.
- Unicité d'une note par élève/évaluation.

### Emploi du temps & rendez-vous
- Validation format horaire (HH:mm) + ordre start/end.
- Détection de conflits classe/enseignant (overlaps multi-cas).
- Rendez-vous : futur obligatoire, disponibilité enseignant, absence de conflits.

### Examens & contenus
- Publication d'examen conditionnée à un minimum de questions.
- Total de points cohérent avec la somme des questions.
- Obligations pour QCM / Vrai-Faux (réponse + options).

---

## Schéma des flux asynchrones

### Flux data principaux
1. **Hooks React Query** (ex: `useSchoolStats`, `useGradeDistribution`, `useRecentActivity`)
   - Query keys dédiées par domaine.
   - Revalidations périodiques (30–60s).
2. **API Routes App Router**
   - Surface d'API large : `/api/analytics`, `/api/students`, `/api/finance`, etc.
3. **Mécanismes offline**
   - Dexie + sync queue pour cache local et réconciliation.
4. **Realtime**
   - Socket.io pour push notifications et états à chaud.

### Asynchronisme critique
- **Auth** : session NextAuth + MFA + contrôle d'accès (RBAC).
- **Notifications** : file d'événements + SMS/Email.
- **Analytics** : consolidation de métriques multi-domaines.

---

## Audit de performance — points structurants

### Surface critique de rendu
- Dashboard principal riche en motion + composants lourds.
- Multiples grilles et tableaux : risques de recalcul et re-render.

### Points de friction détectés
- Appels `fetch` directs mélangés aux helpers `fetchApi`.
- Typage non centralisé des payloads API, risquant la dérive.
- Résultats d'analytics recalculés côté UI plutôt que composés en amont.

---

## Failles identifiées (ancien système)

1. **Incohérence de stratégie data** : mix entre fetch brut et abstractions.
2. **Couplage UI / data** : logique métier souvent imbriquée dans la vue.
3. **Absence de ports/adapters explicites** : peu de frontières claires entre domaine et transport.
4. **Visuals hétérogènes** : accumulation d'effets sans hiérarchie perceptive.

---

## Conclusion
La base métier est riche et robuste, mais l'architecture frontend manque d'une colonne vertébrale explicite (ports/adapters, DDD) et d'une orchestration visuelle vraiment souveraine. Cette refonte APOGÉE installe ces fondations sans renier la logique existante.
