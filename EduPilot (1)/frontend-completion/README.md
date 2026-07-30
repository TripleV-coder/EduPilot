# Frontend Completion — EduPilot

> Paquet de complétion · 10 juin 2026
> Complète les derniers boutons « à venir » du frontend avec leurs pages et API.

## Ce que contient ce paquet

Après audit du codebase `edupilot-master`, le frontend couvre déjà la quasi-totalité
du design (75+ écrans, 152/219 routes API couvertes). Les seuls trous restants
étaient les boutons désactivés `title="… à venir"` dans les 3 modules du sprint
final. Ce paquet les complète.

### Nouveaux fichiers (11)

**API routes (6)**

| Fichier | Rôle |
|---|---|
| `src/app/api/cagnottes/route.ts` | ⚠️ **REMPLACE l'existant** — ajoute `POST` (création de cagnotte + entrée journal), le `GET` existant est conservé à l'identique |
| `src/app/api/cagnottes/[cagnotteId]/route.ts` | `GET` détail + journal public + contributions pseudonymisées |
| `src/app/api/cagnottes/[cagnotteId]/contributions/route.ts` | `POST` contribution (déclarative ; câbler le webhook MoMo plus tard) |
| `src/app/api/wellbeing/reports/route.ts` | `GET` liste + `POST` création de signalement (anonymat by design : `reporterUserId` jamais stocké si anonyme) |
| `src/app/api/wellbeing/reports/[reportId]/route.ts` | `GET` dossier détaillé + RDV psy liés ; `PATCH` statut/sévérité |
| `src/app/api/accounting/entries/route.ts` | `GET` plan de comptes + exercices + dernières écritures ; `POST` écriture **avec validation partie double** (Σ débits = Σ crédits) + mise à jour des soldes |

**Pages (5)**

| Fichier | Rôle |
|---|---|
| `dashboard/cagnotte/new/page.tsx` | Création cagnotte (titre, classe, objectif, deadline, calcul participation/famille) |
| `dashboard/cagnotte/[cagnotteId]/page.tsx` | Détail : progression, journal public transparent, formulaire de contribution |
| `dashboard/wellbeing/new/page.tsx` | Ouverture de dossier (type, catégorie, P0/P1/P2, description) |
| `dashboard/wellbeing/[reportId]/page.tsx` | Dossier détaillé + workflow de traitement (Ouvert → En examen → Suivi → Clôturé) + rappel protocole MEMP |
| `dashboard/accounting/entries/new/page.tsx` | Saisie d'écriture en partie double, badge Équilibrée/Écart en temps réel, bouton bloqué tant que déséquilibrée |

## Installation

1. Copier le contenu de `src/` dans le repo (même arborescence).
   Le seul fichier **remplacé** est `src/app/api/cagnottes/route.ts` — diff à
   relire avant commit (le GET est inchangé, seul POST est ajouté).
2. Vérifier `npm run type-check`.

## Patchs à appliquer sur les pages existantes (dé-griser les boutons)

### `dashboard/cagnotte/page.tsx`

- L.~177 : `<Button icon="plus" disabled title="Création parent à venir">`
  → `<Link href="/dashboard/cagnotte/new"><Button icon="plus">Créer une cagnotte</Button></Link>`
  (garder le guard rôle : la création reste direction/enseignant ; pour un parent, masquer le bouton)
- L.~575 : bouton « Détails » `disabled title="Page détails à venir"`
  → `<Link href={`/dashboard/cagnotte/${c.id}`}>` autour du bouton, retirer `disabled`
- L.~550 : bouton « Payer » `disabled title="Paiement parent à venir…"`
  → rediriger vers `/dashboard/cagnotte/${c.id}` (le formulaire de contribution y est)

### `dashboard/wellbeing/page.tsx`

- L.~212 : `<Button icon="plus" disabled title="Création dossier à venir">`
  → `<Link href="/dashboard/wellbeing/new">`, retirer `disabled`
- L.~522 : bouton « Dossier » `title="Page dossier à venir"`
  → `<Link href={`/dashboard/wellbeing/${r.id}`}>`, retirer `disabled`
  (nécessite que la liste passe par `/api/wellbeing/reports` qui renvoie les `id` — déjà le cas si l'overview inclut les ids ; sinon basculer la liste sur la nouvelle route)

### `dashboard/accounting/page.tsx`

- L.~191 : `<Button icon="plus" disabled title="Création écriture à venir">`
  → `<Link href="/dashboard/accounting/entries/new">`, retirer `disabled`
- L.~188 : bouton « Export DGI iTAS » — reste désactivé (nécessite le format
  d'export DGI, non couvert par ce paquet)

## Reste volontairement hors scope

- **Paiement MoMo intégré dans les cagnottes** : nécessite le webhook opérateur
  (MTN/Moov/Celtiis). Le formulaire actuel enregistre une contribution
  déclarative avec référence — le webhook viendra la remplacer.
- **Export DGI iTAS** : format de fichier propriétaire à obtenir auprès de la DGI.
- **Génération PDF rapport climat** (wellbeing) : brancher sur le service PDF
  existant (`scripts/generate-dossier-pdf.js`) quand priorisé.

## Conventions respectées

- `PageGuard` + `Permission` + rôles sur chaque page
- Isolation tenant : `getActiveSchoolId(session)` + `ensureRequestedSchoolAccess` sur chaque route
- Composants `@/components/edu` (Button, Card, Badge, Input, Icon, Progress) + `PageHeader`/`SubLabel` de `edu-homes/_shared`
- Tokens `--eduflow-*` / `--brand-*`, `tabular-nums` sur tous les montants, format FCFA `fr-FR`
- `params` en `Promise<>` (Next.js 15), BigInt pour tous les montants FCFA
- Accès wellbeing restreint `SUPER_ADMIN / SCHOOL_ADMIN / DIRECTOR` ; signalement anonyme = aucun lien compte stocké
