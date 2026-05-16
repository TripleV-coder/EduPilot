# EduFlow — Kit d'upload Claude Design

**Compagnon du brief** : `2026-05-06-eduflow-design-system-brief.md`

Ce document liste **exactement** quoi uploader sur [claude.ai/design](https://claude.ai/design), dans quel ordre, et quoi dire pour chaque étape.

---

## A. Fichiers à uploader

### A.1 Brief principal (obligatoire)
- `docs/superpowers/specs/2026-05-06-eduflow-design-system-brief.md`

### A.2 Code de référence (obligatoire)
- `tailwind.config.ts` — pour que Claude Design lise la config existante et propose le diff
- `src/app/globals.css` (si présent — sinon le `:root` actuel)
- `package.json` — pour qu'il connaisse les libs autorisées (Recharts, Framer Motion, Radix)

### A.3 Schéma de données partiel (utile pour mockups crédibles)
Extraire de `prisma/schema.prisma` uniquement les modèles touchant l'UI :
- `User`, `TeacherProfile`, `StudentProfile`, `ParentProfile`
- `Class`, `Subject`, `Enrollment`
- `Grade`, `Evaluation`, `Period`, `AcademicYear`
- `Payment`, `Fee`, `PaymentPlan`
- `Attendance` (si modèle dédié) sinon `Incident`
- `Homework`, `HomeworkSubmission`
- `Announcement`, `Notification`

À fournir comme un seul fichier `prisma-ui-models.prisma` — tu peux faire un copier-coller des modèles concernés.

### A.4 Captures d'écran de l'existant (très utile, ~6 captures)
À prendre toi-même dans EduPilot lancé en local (`npm run dev`) :
1. **Dashboard admin overview** (avec données seed)
2. **Sidebar + header** ouvert
3. **Saisie de notes** en cours
4. **Bulletin** preview
5. **Finance dashboard**
6. **Vue parent** sur mobile (Chrome devtools, iPhone 14)

→ Drag & drop dans Claude Design sous le tag "Existant à améliorer".

### A.5 (Optionnel) Web capture
Claude Design propose un outil **web capture**. Si tu déploies une preview (Vercel) sur une branche `eduflow-snapshot`, tu peux pointer Claude Design vers cette URL pour qu'il scrape les composants en place. Sinon, les screenshots A.4 suffisent.

---

## B. Mode d'emploi étape par étape

### Étape 1 — Onboarding (~10 min)
1. `claude.ai/design` → Nouveau projet → "EduFlow Design System".
2. Upload : brief + tailwind.config.ts + package.json + prisma-ui-models.prisma + 6 screenshots.
3. **Premier prompt** :
   > Lis le brief `2026-05-06-eduflow-design-system-brief.md` et confirme que tu as bien intégré : (1) la palette EduFlow (sky → indigo, neutres chauds, sémantique), (2) la typo (Inter UI + JetBrains Mono nombres), (3) les radius (22 / 16 / 12 / 8 / pill), (4) les principes (densité variable, mobile parent first, anti-patterns section 11). Résume-moi en 10 bullets ce que tu vas appliquer.

   Si la réponse rate un point, corrige avant de continuer. Ne passe pas à l'étape 2 tant que ce n'est pas verrouillé.

### Étape 2 — Création du design system (~20 min)
1. Demande : *"Crée le design system EduFlow dans le panneau Brand de Claude Design en utilisant exactement les tokens de la section 3 du brief. Génère les styles light ET dark, et les deux densités (standard / compact). Montre-moi un récapitulatif visuel des tokens (palette swatches, type scale, radius scale, motion scale)."*
2. Vérifie le récapitulatif : couleurs exactes, dark mode présent, JetBrains Mono activé sur les nombres.
3. Si OK, sauvegarde le système comme **Brand par défaut** du projet.

### Étape 3 — Login (le plus simple, échauffement) (~30 min)
1. Prompt :
   > Design la page de login d'EduPilot en respectant la section 6.3 du brief. Donne-moi 3 directions différentes (split desktop, centré sobre, hero illustré) et indique ta recommandation. Dark + light. Mobile 390px obligatoire.

2. Choisis une direction, itère via inline comments sur ce qui ne va pas.
3. Une fois validé, **exporte le handoff bundle**. Garde-le pour Claude Code.

### Étape 4 — Sidebar + Header (chrome global) (~45 min)
1. Prompt :
   > Design le chrome global (sidebar + header) selon section 6.2 du brief. Sidebar light par défaut (260px expanded / 64px collapsed), indicateur actif pastille brand-600, footer avec avatar + rôle. Header sticky 56px avec breadcrumb / search ⌘K / période / densité toggle / notifs / avatar. Donne-moi : desktop expanded, desktop collapsed, mobile drawer, mobile bottom-tab-bar (parent/student).

2. Vérifie : pas de glassmorphism, pas de gradient sombre par défaut, indicateur actif sobre.
3. Export bundle.

### Étape 5 — Dashboard overview (4 variantes) (~1h30)
Faire en 4 prompts séparés (admin, teacher, parent, student) pour éviter de mélanger les variantes.

Prompt admin (idem pour les 3 autres, en adaptant) :
> Design le dashboard overview pour persona **Admin / Director** selon section 6.1.a du brief. Layout desktop 1440px ET mobile 390px. Light + dark. Hero metric + 4 KPIs sparkline 30j + section "Aujourd'hui" + 2 charts + liste "Demandes attention". Densité compact. Données crédibles (section 13). États : default + loading skeletons + empty (année non active).

Pour parent : insister sur **mobile-first**, sélecteur enfant, CTA "Payer" si solde dû.

### Étape 6 — Saisie de notes + Bulletin + Finance + Attendance
Procéder dans cet ordre, un écran par session, ~1h chacun. Prompts dans la section 6 du brief.

### Étape 7 — Bibliothèque de composants
Une fois les 7 écrans Tier 1 validés :
> Génère la bibliothèque shadcn-compatible des composants listés en section 7 du brief. Pour chaque composant : toutes les variants, sizes, états (default/hover/focus/disabled/loading/error). Light + dark. Code Tailwind + CSS variables.

### Étape 8 — Handoff vers Claude Code
1. Pour chaque écran validé, **exporter le handoff bundle**.
2. Revenir dans Claude Code, dans le repo, et écrire :
   > Voici le handoff bundle pour `<écran>` : [coller le contenu ou le lien]. Implémente-le dans `<chemin de la page>` en respectant : (1) les tokens existants dans `tailwind.config.ts`, (2) shadcn déjà présent, (3) Recharts pour les charts, (4) Framer Motion pour les animations. Fais d'abord les CSS variables + tailwind tokens si pas encore fait, puis la page.

3. Je (Claude Code) intègre, lance build + lint + lighthouse, et je te ping pour validation.

---

## C. Checklist de validation par écran (à utiliser dans Claude Design)

Pour chaque écran avant export :

- [ ] Tokens utilisés présents dans la palette EduFlow (vérifier les hex dans l'inspector)
- [ ] Light + dark testés
- [ ] Mobile 390px lisible
- [ ] États : default, loading, empty, error présents
- [ ] Tabular-nums sur tous les nombres (montants, notes, effectifs)
- [ ] Aucun anti-pattern de la section 11
- [ ] Données crédibles (section 13, pas Lorem)
- [ ] A11y : contraste, focus, ARIA OK

---

## D. Si Claude Design dérape

**Symptômes typiques** et corrections :

| Symptôme | Correction à demander |
|---|---|
| Gradient violet/rose surgit | "Utilise UNIQUEMENT `eduflow-gradient-cta` (#2563EB → #4F46E5) et seulement sur les CTA héros, jamais en fond de card." |
| Glassmorphism partout | "Retire tout glassmorphism. Surfaces opaques : `eduflow-surface` (blanc) ou `eduflow-surface-soft` (#F1F5F9)." |
| Inter en titre Display | "Change le titre Display pour un weight 600 + tracking -0.02em + size 32px afin de le différencier nettement du body Inter." |
| Couleurs criardes sur statuts | "Reviens aux tons sémantiques discrets de la section 3.3 : texte foncé + bordure 30% + fond très pâle. Pas de pleine couleur saturée." |
| Mobile négligé | "Reprends en mobile-first 390px d'abord, puis adapte desktop. Le parent passe en priorité sur mobile." |
| Skeleton incohérents | "Utilise `eduflow-surface-soft` + animation shimmer 1.6s ease-in-out infinite. Pas de spinners centrés." |

---

## E. Quand revenir vers moi (Claude Code)

Reviens vers moi avec :
1. **Handoff bundles validés** (1 par écran), OU
2. **Tokens du DS final** consolidé (palette + typo + motion + radius en JSON ou CSS), OU
3. **Question d'intégration** technique ("Comment Claude Design veut-il que je structure les variants Card ?", etc.)

Quand tu reviens, rappelle-moi :
- Le brief : `docs/superpowers/specs/2026-05-06-eduflow-design-system-brief.md`
- Le ou les écrans concernés (Tier 1 numéros 1-7)
- Si c'est une **première intégration** (tokens à poser dans le repo) ou une **itération** (un écran déjà intégré à mettre à jour)

Je m'occupe alors de :
- Mettre à jour `tailwind.config.ts` + `globals.css` avec les tokens EduFlow
- Implémenter l'écran (server components + client components ciblés)
- Tester (build + lint + Lighthouse + a11y)
- Te montrer le résultat avant de propager

---

**Bonne session !** Cible réaliste : Tier 1 complet (7 écrans + chrome + DS) en ~1 semaine de design dans Claude Design, puis ~2 semaines d'intégration code par moi.
