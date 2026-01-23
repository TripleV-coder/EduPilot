# LE CODE SUPRÊME — APOGÉE

## Portée d'exécution
Cette livraison introduit le cœur APOGÉE dans le frontend :
- **Thème global luxueux** (palette profonde, accents néon subtils).
- **Nouvelle architecture DDD** (domain/application).
- **Dashboard refondu** : densité d'information, couches, cinématique.
- **File de priorité + arbre de décision** : signalisation souveraine.

---

## Entrées principales

### Domain
- `src/domain/apogee/model.ts`  
  Modèles immuables (Signal, Metric, Logbook, PerformanceBand).

- `src/domain/apogee/telemetry.ts`  
  Arbres de décision pour présence, finances, académique, engagement.

- `src/domain/apogee/queue.ts`  
  File de priorité (heap binaire), stable par séquence d'arrivée.

### Application
- `src/application/apogee/dashboard-composer.ts`  
  Unit of Work : compose le modèle à partir des hooks existants.

### Adapters (hooks)
- `src/hooks/use-apogee-dashboard.ts`  
  Adaptateur UI -> modèle APOGÉE, mémorisation et erreurs.

### UI premium
- `src/components/apogee/panel.tsx`  
  Surface multi-couches + shader.
- `src/components/apogee/metric-tile.tsx`  
  Métriques denses, hover 3D.
- `src/components/apogee/signal-pill.tsx`  
  Statuts compacts et hiérarchisés.

### Thème
- `src/app/globals.css`  
  Tokens APOGÉE, shaders, sheen, grille.
- `tailwind.config.ts`  
  Extension palette `apogee`.

### Page refondue
- `src/app/(dashboard)/dashboard/page.tsx`  
  Nouvelle matrice opérationnelle ultra-dense.

---

## Propriétés clés

1. **Signature narrative**  
   Les signaux sont hiérarchisés via queue + décision tree pour raconter un état opérationnel lisible.

2. **Cohérence visuelle**  
   Toutes les surfaces adoptent une profondeur uniforme, des overlays réactifs et une logique de grille imbriquée.

3. **Performance**  
   Les calculs dérivés sont centralisés et mémorisés (Unit of Work), évitant les re-renders éclatés.

---

## Résultat attendu
Une interface de commandement dense, hiérarchisée, premium — à haute valeur perçue et
techniquement irréprochable, alignée avec le protocole APOGÉE.
