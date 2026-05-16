# Swiss Enterprise Design System

## 🏛️ Philosophie

Design system strict inspiré de **Bloomberg Terminal**, **Stripe Dashboard**, et **Linear**.

> **Règle d'Acier**: 3 teintes uniquement - Zinc (gris), Blanc, Bleu (#2563EB)

---

## 🎨 Palette Chromatique

| Élément | Valeur | Usage |
|---------|--------|-------|
| **Canvas** (Fond) | `#FAFAFA` Zinc-50 | Fond de page clinique |
| **Surface** | `#FFFFFF` Blanc pur | Cartes et tableaux |
| **Ink** (Titres) | `#18181B` Zinc-900 | Titres et texte principal |
| **Ink Secondary** | `#71717A` Zinc-500 | Metadata, labels |
| **Ink Muted** | `#A1A1AA` Zinc-400 | Placeholders, disabled |
| **Border** | `#E4E4E7` Zinc-200 | Bordures et séparations |
| **Accent** | `#2563EB` Blue-600 | Boutons primaires UNIQUEMENT |

### Badges (Transparents uniquement)

```
✓ Success:  Texte #10B981 + Bordure #10B981/30 + Fond #10B981/5
✗ Danger:   Texte #EF4444 + Bordure #EF4444/30 + Fond #EF4444/5
⚠ Warning:  Texte #F59E0B + Bordure #F59E0B/30
○ Inactive: Texte #71717A + Bordure #71717A/30
```

---

## 📐 Géométrie Stricte

### Unité de Base: 8px

| Token | Valeur | Usage |
|-------|--------|-------|
| `swiss-space-1` | 4px | Micro-espacements |
| `swiss-space-2` | **8px** | Unité de base, padding tableaux |
| `swiss-space-3` | 12px | Padding cartes |
| `swiss-space-4` | 16px | Sections |

### Rayons

```css
--swiss-radius: 0.125rem;  /* 2px - rounded-sm PARTOUT */
```

**Interdictions**:
- ❌ Pas de `rounded-lg` (8px)
- ❌ Pas de `rounded-xl` (12px)
- ❌ Pas de `rounded-full` (pills)

---

## 📝 Typographie Enterprise

### Hiérarchie

| Style | Taille | Usage |
|-------|--------|-------|
| **Heading XL** | 24px / font-semibold | Titres de page |
| **Heading** | 16px / font-semibold | Section headers |
| **Label** | 10px / uppercase / tracking-wide | En-têtes de tableau |
| **Body** | 13px / regular | Contenu dense |
| **Mono** | 12px / monospace | Données numériques |

### Feature Settings

```css
font-feature-settings: "tnum";        /* Tabular nums pour colonnes */
font-variant-numeric: tabular-nums;   /* Alignement décimal */
```

---

## 🧩 Composants

### 1. SwissDataTable

```tsx
<SwissDataTable
  data={students}
  columns={[
    { key: "id", header: "ID", width: "80px", sortable: true },
    { key: "name", header: "Nom", sortable: true },
    { 
      key: "status", 
      header: "Statut",
      render: (value) => <SwissBadge variant="success">{value}</SwissBadge>
    },
  ]}
  itemsPerPage={10}
/>
```

**Caractéristiques**:
- Headers: 10px uppercase tracking-wide
- Cellules: 13px padding 8px 12px
- Bordures: 1px #E4E4E7
- Hover: bg #FAFAFA

### 2. SwissStatCard

```tsx
<SwissStatCard
  label="Total Élèves"
  value="1,250"
  delta="+45"
  deltaType="positive"
/>
```

**Caractéristiques**:
- Label: 10px uppercase
- Valeur: 24px tabular-nums
- Delta: 11px coloré (vert/rouge)

### 3. SwissBadge

```tsx
<SwissBadge variant="success">Actif</SwissBadge>
<SwissBadge variant="danger">Exclu</SwissBadge>
<SwissBadge variant="inactive">Inactif</SwissBadge>
```

**Règle**: Transparent avec bordure UNIQUEMENT. Jamais de fond plein.

### 4. SwissSidebar

```tsx
<SwissSidebar />
```

**Caractéristiques**:
- Fond: #FAFAFA
- Largeur: 240px (60px collapsed)
- Active: bg #18181B text white
- Inactive: text #71717A

---

## 📊 Graphiques (Monochromes)

### Règles Strictes

- ✅ **Autorisé**: 1 couleur + variations d'opacité
- ❌ **Interdit**: Graphiques circulaires multicolores
- ❌ **Interdit**: Palettes arc-en-ciel

### Exemple

```tsx
// Graphique à barres - Monochrome Bleu
<BarChart data={data} fill="#2563EB" fillOpacity={0.8} />

// Graphique à barres - Monochrome Zinc
<BarChart data={data} fill="#18181B" fillOpacity={0.6} />
```

---

## 🚫 Interdictions Absolues

| Interdiction | Raison |
|--------------|--------|
| **Ombres diffuses** | Aspect bas de gamme |
| **Grands arrondis** | Non professionnel |
| **Couleurs pastels** | Amateur |
| **Gradients décoratifs** | Distractifs |
| **Émojis** | Non professionnel |
| **Icônes colorées** | Seul le texte bleu est autorisé |

---

## 📁 Structure des Fichiers

```
src/
├── styles/
│   └── swiss-enterprise.css          # Variables et utilitaires
├── components/ui/
│   ├── swiss-data-table.tsx          # Tableau dense
│   ├── swiss-sidebar.tsx             # Navigation
│   └── swiss-*.tsx                   # Autres composants
└── app/(dashboard)/dashboard/
    └── swiss-demo/
        └── page.tsx                  # Démo complète
```

---

## 🚀 Usage

### 1. Importer le CSS (déjà fait dans globals.css)

```css
@import "../styles/swiss-enterprise.css";
```

### 2. Utiliser les composants

```tsx
import { SwissDataTable, SwissStatCard, SwissBadge } from "@/components/ui/swiss-data-table";
import { SwissSidebar } from "@/components/ui/swiss-sidebar";
```

### 3. Page de démo

Accéder à `/dashboard/swiss-demo` pour voir l'implémentation complète.

---

## 📐 Checklist Migration

Pour migrer une page existante vers Swiss Enterprise:

- [ ] Remplacer `bg-background` par `bg-[#FAFAFA]`
- [ ] Remplacer `rounded-lg` par `rounded-sm`
- [ ] Remplacer `shadow-md` par `border border-[#E4E4E7]`
- [ ] Remplacer les badges colorés par `SwissBadge`
- [ ] Remplacer `text-lg` par `text-[13px]` dans les tableaux
- [ ] Remplacer les KPI cards par `SwissStatCard`
- [ ] Supprimer les icônes colorées décoratives

---

## 🎯 Impact Attendu

> EduPilot ne se présentera plus comme une plateforme générique, mais comme une infrastructure financière et académique d'élite.

**Perception utilisateur**:
- ✅ Professionnalisme irréprochable
- ✅ Confiance des directeurs et comptables
- ✅ Ergonomie longue durée (6h+ de lecture)
- ✅ Modernité sobre (style Linear/Stripe)

---

*Design System Swiss Enterprise v1.0 - EduPilot*
