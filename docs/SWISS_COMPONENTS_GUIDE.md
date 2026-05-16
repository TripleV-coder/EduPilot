# Swiss Enterprise Components - Guide d'utilisation

## 🎯 Composants 21st.dev créés

Ce guide présente les composants UI modernes et professionnels créés avec l'inspiration 21st.dev, adaptés au design system Swiss Enterprise.

---

## 📦 Installation

Tous les composants sont disponibles via l'export central:

```tsx
import { 
  SwissCommandPalette,
  SwissDialog, SwissAlertDialog,
  SwissToastProvider, useSwissToast,
  SwissBarChart, SwissStatsGrid, SwissSparkline,
  SwissDropdownMenu,
  SwissBentoCard, SwissBentoGrid,
} from "@/components/ui/swiss";
```

---

## 🎨 1. Command Palette (Palette de commandes)

Navigation rapide avec raccourcis clavier (Cmd+K).

### Usage
```tsx
// Dans votre layout ou page
<SwissCommandPalette />

// Le composant affiche automatiquement un trigger cliquable
// et répond au raccourci Cmd+K
```

### Fonctionnalités
- **Cmd+K** pour ouvrir/fermer
- **Flèches** pour naviguer
- **Entrée** pour sélectionner
- **Escape** pour fermer
- Recherche en temps réel
- Groupes par catégorie

---

## 🪟 2. Dialog (Modal)

Fenêtres modales minimalistes et professionnelles.

### Usage basique
```tsx
const [open, setOpen] = useState(false);

<SwissDialog open={open} onOpenChange={setOpen}>
  <SwissDialogContent>
    <SwissDialogHeader>
      <SwissDialogTitle>Titre</SwissDialogTitle>
      <SwissDialogDescription>Description</SwissDialogDescription>
    </SwissDialogHeader>
    <SwissDialogBody>
      Contenu ici...
    </SwissDialogBody>
    <SwissDialogFooter>
      <button onClick={() => setOpen(false)}>Annuler</button>
      <button onClick={handleConfirm}>Confirmer</button>
    </SwissDialogFooter>
  </SwissDialogContent>
</SwissDialog>
```

### Alert Dialog (Confirmation)
```tsx
<SwissAlertDialog
  open={alertOpen}
  onOpenChange={setAlertOpen}
  title="Confirmer la suppression"
  description="Cette action est irréversible."
  confirmLabel="Supprimer"
  cancelLabel="Annuler"
  onConfirm={handleDelete}
  variant="danger" // ou "default"
/>
```

### Tailles disponibles
- `size="sm"` - 384px
- `size="md"` - 448px (défaut)
- `size="lg"` - 512px
- `size="xl"` - 576px

---

## 🔔 3. Toast Notifications

Notifications non-intrusives avec barre de progression.

### Setup
```tsx
// Dans le layout.tsx
import { SwissToastProvider } from "@/components/ui/swiss-toast";

export default function Layout({ children }) {
  return (
    <SwissToastProvider>
      {children}
    </SwissToastProvider>
  );
}
```

### Usage
```tsx
const { success, error, info, warning, loading, updateLoading } = useSwissToast();

// Types de notifications
success("Opération réussie");
error("Une erreur est survenue");
info("Information importante");
warning("Attention requise");

// Loading avec mise à jour
const id = loading("Création en cours...");
// ... après traitement
updateLoading(id, "success", "Création terminée");

// Avec action
success("Élève créé", {
  action: {
    label: "Voir",
    onClick: () => router.push("/students/123")
  }
});
```

### Caractéristiques
- Position: coin supérieur droit
- Durée: 4s par défaut (configurable)
- Pause au survol
- Barre de progression
- Icônes par type

---

## 📊 4. Charts (Graphiques)

Graphiques minimalistes monochrome.

### SwissBarChart
```tsx
const data = [
  { label: "6ème", value: 245 },
  { label: "5ème", value: 218 },
  // ...
];

<SwissBarChart 
  data={data} 
  showValues 
  barHeight={8}
  monochrome={true}
/>
```

### SwissStatsGrid (avec sparklines)
```tsx
const stats = [
  { 
    label: "Élèves actifs", 
    value: "1,248", 
    change: "+12 ce mois", 
    trend: "up",
    sparklineData: [40, 42, 45, 44, 48, 50, 52, 55, 53, 58, 60, 62]
  },
  // ...
];

<SwissStatsGrid stats={stats} />
```

### Sparkline individuel
```tsx
<SwissSparkline 
  data={[40, 42, 45, 44, 48]} 
  trend="up" // "up" | "down" | "neutral"
/>
```

### Générateur de données
```tsx
import { generateTrendData } from "@/components/ui/swiss";

const data = generateTrendData(20, "up"); // 20 points, tendance hausse
// "up" | "down" | "mixed"
```

---

## 🎯 5. Dropdown Menu

Menus contextuels avec style Swiss Enterprise.

### Usage
```tsx
<SwissDropdownMenu>
  <SwissDropdownMenuTrigger asChild>
    <button>Actions</button>
  </SwissDropdownMenuTrigger>
  <SwissDropdownMenuContent align="end">
    <SwissDropdownMenuLabel>Actions rapides</SwissDropdownMenuLabel>
    <SwissDropdownMenuItem onClick={handleEdit}>
      <Edit className="mr-2 h-4 w-4" />
      Modifier
    </SwissDropdownMenuItem>
    <SwissDropdownMenuSeparator />
    <SwissDropdownMenuItem 
      destructive
      onClick={handleDelete}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Supprimer
    </SwissDropdownMenuItem>
  </SwissDropdownMenuContent>
</SwissDropdownMenu>
```

### Features
- `destructive` - Style rouge pour actions dangereuses
- `inset` - Indentation pour sous-menus
- Checkbox et Radio items
- Sub-menus

---

## 🎴 6. Bento Cards

Cartes dans le style grille bento.

### Usage
```tsx
<SwissBentoGrid cols={4}>
  <SwissBentoCard
    title="Total Élèves"
    value="1,250"
    subtitle="+45 ce mois"
    icon={Users}
    variant="default"
    size="md"
  />
  
  <SwissBentoCard
    title="Alertes"
    value="3"
    variant="accent"
    size="md"
    footer={
      <button className="text-[11px] text-white/80 hover:text-white">
        Voir tout →
      </button>
    }
  />
  
  <SwissBentoCard
    title="Performance"
    variant="highlight"
    size="lg"
  >
    <SwissSparkline data={data} trend="up" />
  </SwissBentoCard>
</SwissBentoGrid>
```

### Variantes
- `default` - Fond blanc
- `accent` - Fond bleu (#2563EB)
- `highlight` - Fond noir
- `muted` - Fond gris clair

### Tailles
- `sm`, `md`, `lg`, `xl`

---

## 🎨 Design Principles

### Palette couleurs
```
Fond: #FAFAFA (gris très clair)
Cartes: #FFFFFF (blanc)
Bordures: #E4E4E7 (gris clair)
Texte: #18181B (presque noir)
Texte secondaire: #71717A (gris)
Accent: #2563EB (bleu)
Succès: #10B981
Danger: #EF4444
Warning: #F59E0B
```

### Géométrie
- Border radius: 2px (`rounded-sm`)
- Pas d'ombres (sauf modals/dialogs)
- Bordures fines (1px)
- Padding compact (12-16px)

### Typographie
- Titres: 13-15px, semibold, tracking-tight
- Corps: 12-13px, normal
- Labels: 10-11px, uppercase, tracking-wider

---

## 🚀 Exemple complet

Voir la page démo complète à `/dashboard/swiss-demo`

```bash
npm run dev
# Accédez à http://localhost:3000/dashboard/swiss-demo
```

---

## 📝 Notes

- Tous les composants sont **client components** ("use client")
- Les animations utilisent **Framer Motion**
- Les icônes viennent de **Lucide React**
- Le style est géré par **Tailwind CSS**
- Les couleurs suivent le design system Swiss Enterprise

---

## 🔧 Dépendances requises

```bash
npm install framer-motion lucide-react @radix-ui/react-dialog @radix-ui/react-dropdown-menu
```

---

**Créé avec l'inspiration 21st.dev pour EduPilot**
