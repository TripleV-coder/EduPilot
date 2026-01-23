# LE SCHÉMA ARCHITECTURAL — APOGÉE

## Architecture DDD (Frontend)

```
src/
  app/                      -> Presentation (routes, layouts)
  components/               -> UI (primitives + apogee)
  hooks/                    -> Adaptateurs React Query / UI
  domain/
    apogee/
      model.ts              -> Types de domaine
      telemetry.ts          -> Règles de décision (arbres)
      queue.ts              -> File de priorité (heap)
  application/
    apogee/
      dashboard-composer.ts -> Orchestrateur (Unit of Work)
  infrastructure/           -> (port prévu : adapters API, storage)
```

### Flux principal
```
UI (App Router)
  -> Hook (adapter)
      -> Application (compose)
          -> Domain (règles, décision, queue)
              -> Output modèle prêt à rendre
```

---

## Design System (APOGÉE)

### Tokens
- **Noirs profonds / gris métalliques** (`--apogee-abyss`, `--apogee-graphite`)
- **Accents** : Gold, Cobalt, Emerald, Crimson (signaux critiques)
- **Effets** : glass + shader + sheen, grids imbriquées, profondeur.

### Primitives UI
- `ApogeePanel` : surface souveraine, couches + shader intégré.
- `ApogeeMetricTile` : métrique dense, cadence forte, hover 3D.
- `ApogeeSignalPill` : état synthétique, densité élevée.

---

## Patterns utilisés (conformité APOGÉE)

### Ports & Adapters
- **Hook** = adapter UI.
- **Domain** = cœur invariant (pas d'import UI).
- **Application** = composition, mapping, Unit of Work.

### Unit of Work (frontend)
- `composeApogeeDashboard` : une seule passe de transformation,
  centralise la logique et évite les recalculs dispersés.

### Repository Pattern (frontend)
- Les hooks jouent le rôle de **repositories** pour la data.
- Contrats typés (SchoolStats, GradeDistribution, ActivityItem).

### Adapter Pattern
- `useApogeeDashboard` adapte les hooks existants
  vers le modèle de domaine `ApogeeDashboardModel`.

---

## Diagramme d'architecture (texte)

```
┌───────────────────────────┐
│        Presentation       │  Next.js + components
└─────────────┬─────────────┘
              │
┌─────────────▼─────────────┐
│        Application        │  Compose / orchestration
└─────────────┬─────────────┘
              │
┌─────────────▼─────────────┐
│           Domain          │  Decisions + rules + queue
└─────────────┬─────────────┘
              │
┌─────────────▼─────────────┐
│        Infrastructure      │  API / storage / sockets
└───────────────────────────┘
```

---

## Typage strict & invariants
- Types mappés pour signaux et métriques.
- Zéro `any`, zéro `unknown` sur les nouvelles couches.
- Modèles immuables + données dérivées mémorisées.

---

## State Management (réactivité < 16ms)
- **React Query** pour I/O, cache, invalidation.
- **useMemo** systématique pour dérivés, évite les re-renders inutiles.
- **PriorityQueue** pour hiérarchiser les signaux sans tri répétitif.
