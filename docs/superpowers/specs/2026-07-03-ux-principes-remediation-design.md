# Design — Remédiation principes UX SaaS

Date : 2026-07-03
Branche : chore/p1-p3-completion

## Contexte

Audit des 28 principes UX SaaS contre EduPilot. Points structurels déjà respectés
(landing, onboarding par rôle, erreurs humaines, feedback, recherche, cohérence).
Manques réels retenus, à corriger en 4 chantiers indépendants livrés d'affilée.

Correctif d'audit : la télémétrie **existe déjà** côté ingestion (modèle
`TelemetryEvent` + `POST /api/ux/events` via `src/lib/ux/telemetry.ts`). Le manque
#28 est la **couche de lecture** (agrégation rétention/activation), pas la collecte.

## Chantier 1 — Auto-save (#16)

### Périmètre
- Réglages idempotents : profil, apparence, locale, préférences (via `PATCH /api/user/profile`).
- Saisie de notes (`EvaluationSheet`) **avec précaution** : auto-save par cellule,
  statut par cellule, rollback solide, jamais de doublon.
- **Exclus** : formulaires de création multi-entités (bouton explicite « Créer » conservé).

### Livrables
- `src/hooks/use-autosave.ts` — hook générique :
  - debounce (~1000 ms) après la dernière modification ;
  - ignore le montage initial (ne sauve pas des données inchangées au chargement) ;
  - valide via un validateur optionnel (Zod) avant envoi ;
  - garde anti-course : une réponse périmée n'écrase pas un envoi plus récent (compteur de séquence) ;
  - retry sur échec / offline (écoute `navigator.onLine`) ;
  - états : `idle | dirty | saving | saved | error`.
- `src/components/edu/save-status.tsx` — indicateur discret et accessible
  (`aria-live="polite"`) : « Modifications non enregistrées » → « Enregistrement… »
  → « Enregistré à HH:MM » → « Échec — réessayer » (bouton retry).
- Branchement des 4 pages settings + `EvaluationSheet`. Un bouton « Enregistrer
  maintenant » (flush immédiat) reste disponible.

### Sécurité / correctness
- Auto-save uniquement sur endpoints idempotents (PATCH/upsert), jamais POST créationnel.
- Notes : chaque cellule a sa propre clé de sauvegarde ; un échec sur une cellule
  n'affecte pas les autres ; valeur invalide (hors barème) bloquée avant envoi.

## Chantier 2 — Optimistic UI (#17)

- `src/hooks/use-optimistic-mutation.ts` — wrapper autour de SWR `mutate` :
  `optimisticData`, rollback automatique sur erreur, toast d'échec, revalidation finale.
- Appliqué aux mutations de liste à fort trafic (toggle/suppression/ajout) : users,
  teachers, notifications.

## Chantier 3 — Analytics rétention (#28, lecture seule)

- `src/lib/ux/analytics.ts` — agrégations sur `TelemetryEvent` :
  - activation : funnel onboarding (viewed → checked_step → completed) ;
  - rétention J1 / J7 / J30 (utilisateurs actifs revenus après N jours) ;
  - événements les plus fréquents.
- `GET /api/ux/analytics` — réservé `SUPER_ADMIN` (via `allowedRoles`), rate-limité.
- Page `/dashboard/root-control/ux-analytics` consommant l'API (états loading/empty/error).
- Aucune nouvelle collecte : on lit `TelemetryEvent` existant.

## Chantier 4 — A11y systématique (#26, remédiation)

- Skip-link global (`Aller au contenu`) dans le layout dashboard.
- Gestion du focus au changement de route (focus sur `<main>`).
- Vérifier `aria-live` sur les toasts.
- Passe axe sur pages non couvertes + corrections contraste/labels au fil des findings.

## Ordre & vérification
1 → 2 → 3 → 4. Chaque chantier : `lint` + `typecheck` + `test` verts avant le suivant.
Tests unitaires ajoutés pour `use-autosave`, `use-optimistic-mutation`, `analytics`.

## Hors périmètre (YAGNI)
- Auto-save sur créations multi-entités.
- Refonte de la collecte télémétrie (déjà en place).
- Dashboard analytics temps réel / websockets.
