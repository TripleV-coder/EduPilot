# Inventaire de l'interface — état au 2026-09-18

> **Constat uniquement.** Ce document n'énonce aucune recommandation et
> n'accompagne aucune modification : le design est gelé (règle 9 de la mission
> de remise à niveau). Il sert de point de départ à la refonte à venir, pour
> qu'elle parte de ce qui existe et non d'une supposition.
>
> Méthode : lecture du dépôt à la révision `a578eea` (branche
> `fix/production-readiness`). Chaque chiffre est le résultat d'un comptage sur
> les sources, reproductible par les commandes indiquées en annexe.

---

## 1. Volume

| Élément | Nombre |
|---|---|
| Pages (`page.tsx`) | **177** |
| dont pages du tableau de bord | 159 |
| dont pages publiques et d'authentification | 18 |
| Coquilles de page (`layout.tsx`) | 3 |
| Composants React (`.tsx` sous `src/components`) | 175 |
| Routes d'API | 288 |

Les 159 pages du tableau de bord se répartissent en **61 regroupements** de
premier niveau, du plus fourni au plus mince :

`settings` (25 sous-pages), `root-control`, `grades`, `finance`, `analytics`,
`students`, `teachers`, `classes`, `health`, `staff`, `orientation`, puis une
longue traîne de regroupements à une ou deux pages : `alumni`, `benchmark`,
`cagnotte`, `canteen`, `clubs`, `competences`, `gamification`, `liaison`,
`transport`, `voice-notifs`, `wallet`, `wellbeing`, `whatsapp`…

Pages hors tableau de bord : accueil, `explorer`, `ecoles`, `ecole/[code]`,
`privacy`, `terms`, `offline`, `disabled`, et le parcours d'authentification
(`login`, `register`, `first-login`, `forgot-password`, `reset-password`,
`verify-email`, `setup`, `mfa-setup`, `mfa-verify`).

---

## 2. Jetons de style

Deux fichiers portent les jetons, avec deux conventions de nommage.

### `src/styles/edupilot-tokens.css` — 489 lignes, **315 variables**

Jetons « eduflow », en valeurs littérales (hexadécimal, pixels) :

| Famille | Contenu |
|---|---|
| Marque | `--brand-50` → `--brand-900`, `--brand-accent-500/600`, `--gradient-cta` |
| Sémantique | `--eduflow-success-*`, `--eduflow-info-*`, `--eduflow-warning-*`, `--eduflow-danger-*` (10 nuances chacune) |
| Texte et surfaces | `--eduflow-text-primary/secondary/on-brand`, surfaces, bordures |
| Typographie | `--eduflow-font-display`, `--eduflow-font-body`, `--eduflow-font-mono` |
| Espacement | `--eduflow-space-1` (4 px) → `--eduflow-space-24` (96 px), échelle de 12 pas |
| Rayons | `--eduflow-radius-sm` 8 px, `md` 12, `lg` 16, `xl` 22, `2xl` 28, `full`, `chip` 8 |
| Ombres, mouvement | ombres graduées, durées et courbes d'animation |

### `src/app/globals.css` — variables au format HSL pour Tailwind/shadcn

Jetons `--primary`, `--secondary`, `--accent`, `--background`, `--foreground`,
`--card`, `--popover`, `--muted`, `--destructive`, chacun décliné en 11 nuances
(`-50` → `-950`), exprimés en triplets HSL sans fonction (`221 83% 53%`) pour
être composés par Tailwind (`hsl(var(--primary) / 0.5)`).

**Les deux familles décrivent la même charte deux fois.** `--brand-600`
(`#2563EB`) et `--primary` (`221 83% 53%`) sont la même couleur, écrites
différemment, dans deux fichiers différents.

### Thème sombre

Déclaré par la classe `.dark` (`edupilot-tokens.css:235`, `globals.css:230`).
Il redéfinit les jetons de surface et de texte, pas les jetons de marque.

### Typographie

Deux polices chargées par `next/font/google` dans `src/app/layout.tsx` :
**Inter** (sous `--font-body`, avec les alias `--font-display`, `--font-ui`,
`--font-eduflow-body` dérivés en CSS pour ne la charger qu'une fois) et
**JetBrains Mono** (`--font-eduflow-mono`).

### Mouvement

`prefers-reduced-motion: reduce` est traité globalement dans `globals.css`
(deux blocs, dont un neutralisant les animations des primitives).

---

## 3. Deux familles de primitives

C'est le fait structurant de l'interface actuelle.

| | `src/components/ui/` | `src/components/edu/` |
|---|---|---|
| Nombre de composants | 31 | 17 |
| Origine | shadcn/ui (Radix + `class-variance-authority`) | maison |
| Style | classes Tailwind, jetons HSL de `globals.css` | **`style={{}}` en ligne**, jetons `var(--…)` de `edupilot-tokens.css` |
| Fichiers qui l'importent | **151** | **124** |

Six primitives existent **dans les deux familles**, avec des API différentes :

| Composant | `ui/` | `edu/` |
|---|---|---|
| `button` | variantes `default`, `destructive`, `outline`, `secondary`, `ghost`, `link` ; tailles `default`, `sm`, `lg`, `icon` | variantes `primary`, `secondary`, `ghost`, `danger`, `soft` ; tailles `sm`, `md`, `lg` |
| `card`, `input`, `badge`, `avatar`, `progress` | idem : variantes Tailwind | idem : jetons en ligne |

Les hauteurs ne coïncident pas : `ui/button` taille `default` fait `h-10`
(40 px), `edu/button` taille `md` fait 38 px.

`src/components/edu/icon.tsx` définit **35 icônes** en SVG interne
(`ICON_PATHS`), tandis que **138 fichiers** importent `lucide-react`.

### Composants propres à un domaine

`charts/` (16), `students/` (17), `analytics/` (12), `dashboard/` (11),
`landing/` (10), `layout/` (7), `onboarding/` (6), `edu-homes/` (6),
`edu-shell/` (5), puis 1 à 4 fichiers pour `a11y`, `access-control`,
`accounting`, `ai`, `alumni`, `auth`, `cagnotte`, `compliance`, `evaluations`,
`explorer`, `gdpr`, `grades`, `guard`, `messaging`, `performance`, `providers`,
`public`, `pwa`, `schedule`, `settings`, `shared`, `signatures`, `system`.

---

## 4. Coquille et états de page

La structure de page est unifiée et largement adoptée :

| Composant (`src/components/layout/`) | Fichiers qui l'utilisent |
|---|---|
| `PageHeader` | 153 |
| `PageShell` | 146 |
| `PageError` | 103 |
| `PageLoading` | 92 |
| `PageEmpty` | 60 |

**157 des 159 pages du tableau de bord** utilisent `PageShell`.

La navigation est portée par `src/components/edu-shell/` : `EduSidebar`,
`EduTopBar`, `EduMobileNav`, `EduCommandPalette`, et **`role-nav.ts`**, seule
source de la navigation par rôle.

---

## 5. Contournements du design system

Comptés dans `src/components` et `src/app`.

| Contournement | Occurrences | Fichiers |
|---|---|---|
| Couleur hexadécimale codée en dur (`#2563EB`) | **113** | 28 |
| Classe Tailwind de couleur brute (`bg-blue-500`, `text-red-600`…) | **140** | 17 |
| Style en ligne `style={{ … }}` | — | **175** |

Le style en ligne n'est pas toujours un contournement : les primitives `edu/`
sont **conçues** ainsi, et `page-states.tsx` l'utilise pour lire un jeton
(`style={{ color: "var(--eduflow-text-secondary)" }}`). Le contournement
véritable est la **valeur littérale** qui ne passe par aucun jeton.

Les couleurs en dur se concentrent dans :

- **les graphiques** (`charts/InteractiveRiskPieChart`, `InteractivePerformanceBarChart`,
  `InteractiveSubjectRadarChart`, `DendrogramChart`, `AttendanceGradesScatter`) —
  Recharts reçoit des couleurs en propriété, non des classes ;
- **les écrans à code couleur métier** : `dashboard/risks/student-risk-board`,
  `debt-risk-board`, `ai/student-risk-card`, `students/student-id-card` ;
- **quelques pages** : `notifications/sms`, `wallet`, `messages`, `whatsapp`,
  `ai`, `access-control`, `orientation/me`, `orientation/post-bepc`,
  `grades/bulletins`, `analytics`, `settings/subject-categories`, `mfa-verify` ;
- `components/edu/chip.tsx`, qui est pourtant une primitive.

`src/app/(dashboard)/dashboard/design-system/showcase.tsx` en contient aussi :
c'est la page de démonstration du design system, qui affiche les valeurs.

---

## 6. Ce que la remise à niveau a touché à l'interface

Pour mémoire, le design étant gelé, seules des corrections fonctionnelles ont
été faites (règle 9, exceptions autorisées) :

- accessibilité : zone principale de l'annuaire, titres, bouton nommé des
  évaluations (M8), focus au changement de route ;
- états manquants : 27 pages distinguent désormais une panne de chargement
  d'une absence de données (`PageError` au lieu d'un état vide) ;
- écrans nécessaires au démarrage à vide et au consentement ;
- chargement à la demande de SheetJS et des onglets d'analyse.

Aucune couleur, aucune typographie, aucun espacement, aucun jeton, aucune mise
en page, aucun texte marketing n'a été modifié.

---

## Annexe — commandes de comptage

```bash
# Pages et composants
find src/app -name page.tsx | wc -l
find "src/app/(dashboard)" -name page.tsx | wc -l
find src/components -name '*.tsx' | wc -l

# Jetons
grep -c '^\s*--' src/styles/edupilot-tokens.css

# Deux familles de primitives
grep -rl 'from "@/components/ui/'  --include=*.tsx src | wc -l
grep -rl 'from "@/components/edu'  --include=*.tsx src | wc -l

# Contournements
grep -rEo '#[0-9a-fA-F]{6}\b' --include=*.tsx src/components src/app | wc -l
grep -rEo '\b(bg|text|border)-(red|blue|green|yellow|orange|purple|pink|indigo|gray|slate|emerald|amber|cyan|teal|violet|rose|lime|sky)-[0-9]{2,3}' \
  --include=*.tsx src/components src/app | wc -l
grep -rc 'style={{' --include=*.tsx src/components src/app | grep -v ':0$' | wc -l

# Adoption de la coquille
grep -rl PageShell --include=page.tsx "src/app/(dashboard)" | wc -l
```
