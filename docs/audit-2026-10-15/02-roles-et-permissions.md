# Livrable 2 — Matrice des rôles et des périmètres

> Sources :
> - rôles : enum `UserRole`, `prisma/schema.prisma:2068-2078` ;
> - permissions codées : `src/lib/rbac/permissions.ts` (matrice complète en annexe A4) ;
> - périmètre d'écoles : `src/lib/auth/school-access.ts:33-117` ;
> - menus : `src/components/edu-shell/role-nav.ts` (annexe A5) ;
> - parcours documentés par rôle : `docs/guide-utilisateur/17-parcours-par-role.md` (non revérifié ligne à ligne dans ce lot).

## 1. Règles transverses (vérifiées)

1. **Un rôle par compte**, global à toutes les écoles accessibles (livrable 7 §8). `User.roles[]` n'a pas d'effet côté serveur.
2. **Contrôle serveur** par `createApiHandler` :
   - `allowedRoles` via `roleSatisfies` : seul NETWORK_ADMIN hérite de SCHOOL_ADMIN ; **SUPER_ADMIN n'hérite d'aucun rôle** et doit être listé ;
   - `requiredPermissions` via `hasPermission(role)` ;
   - garde central `?schoolId` ;
   - module activé pour l'école ;
   - 2FA validée si activée.
3. **SUPER_ADMIN n'a pas toutes les permissions** : 84 sur 102. Il lui manque les 18 permissions « famille » et `attendance:*`, `incident:*`. Il est donc refusé sur les routes protégées par ces permissions, alors que ces routes ne listent pas son rôle. Choix de minimisation ou oubli : **à confirmer (Q-ROLE-04)**.
4. **Sous-rôle « racine »** : un SUPER_ADMIN dont l'email figure dans `ROOT_USER_EMAILS`, si la liste est définie (`src/lib/security/require-root.ts`). Il accède seul à `/api/root/*`.
5. **Contexte base (RLS)** : SUPER_ADMIN = système ; TEACHER = école active seule ; autres rôles = école active + écoles accessibles.

## 2. Matrice par rôle

| Rôle | Permissions | Menu latéral | Écoles accessibles (calcul) | Création du compte | Restrictions vérifiées |
|---|---|---|---|---|---|
| **SUPER_ADMIN** (plateforme) | 84 | 8 liens | Aucune restriction : son école active sert de filtre de vue (`school-access.ts:40-42`) | **Uniquement** à l'installation initiale (`POST /api/users` refuse ce rôle, `users/route.ts:151-155`). Seule autre voie trouvée : `PATCH /api/root/users`, qui accepte n'importe quel champ, y compris `role` (MS-05) | Doit être listé explicitement ; refusé sur `attendance:*` et `incident:*` ; `/api/root/*` réservé à la racine |
| **NETWORK_ADMIN** (réseau) | 81 | 4 liens | Écoles de ses organisations (`OrganizationMembership`) + école principale + annexes si l'école principale est MAIN | Par le SUPER_ADMIN | Hérite de SCHOOL_ADMIN dans `allowedRoles`. `SCHOOL_CREATE` accordé, mais **inutilisable** : la seule route de création exige SUPER_ADMIN (`schools/route.ts:173-176`) |
| **SCHOOL_ADMIN** (administration) | 80 | 8 liens | École principale + annexes (si MAIN avec annexes) + organisations | SUPER_ADMIN, ou installation | Avec NETWORK_ADMIN, seul rôle d'école à avoir les suppressions (`USER/FEE/FINANCE/PAYMENT/NOTIFICATION/ORIENTATION_DELETE`) |
| **DIRECTOR** (direction) | 74 | 8 liens | Comme SCHOOL_ADMIN | SUPER_ADMIN ou SCHOOL_ADMIN (`POST /api/users`) | Pas de suppression (commentaire « intentional », `permissions.ts:363`) |
| **TEACHER** | 29 | 8 liens | École principale + rattachements actifs + écoles de ses cours et classes principales (`school-access.ts:44-66`) | Direction (`POST /api/teachers`, `/api/users`) ; multi-écoles par SUPER_ADMIN seul | Base limitée à l'école active ; saisie et correction réservées à **l'enseignant de la matière** ; élèves limités à ses classes ; **notes et bulletins de toute l'école lisibles** (MS-02) |
| **STAFF** (vie scolaire) | 13 | 3 liens | École principale + organisations | Direction | A `SCHOOL_READ` sans `SCHOOL_UPDATE` : les écritures de vie scolaire sont autorisées par `allowedRoles` seul (mémoire du 2026-06-28) ; peut émettre un code de liaison parent |
| **ACCOUNTANT** | 15 | 6 liens | École principale + organisations | Direction | Finance : frais, échéanciers, bourses, guichet, rapprochement, relances |
| **PARENT** | 14 | 8 liens | École principale + écoles des enfants liés (`ParentStudent`) | Direction (compte) ; lien enfant par code (PARCOURS-PARENT-001) | Notes et données limitées à ses enfants (`getOwnStudentIds`) ; liaison d'un enfant possible seulement dans son école active |
| **STUDENT** | 14 | 8 liens | École de son profil élève | Inscription par l'école (mot de passe provisoire) | Ses propres données seulement |

## 3. Combinaisons de fonctions (question de la mission)

| Cas | Pris en charge ? | Preuve |
|---|---|---|
| Enseignant dans A **et** B | **Oui** (rattachements ; changement d'école ; base limitée à l'école active) | Livrable 7, tests |
| Enseignant dans A **et** parent dans B | **Non** avec un seul compte (un rôle, email unique). Deux comptes et deux emails sont nécessaires | `User.role`, `User.email @unique` |
| Directeur dans A **et** enseignant dans C | **Non** (rôle global) | idem |
| Parent avec enfants dans plusieurs écoles | **Partiel** : les écoles des enfants déjà liés deviennent accessibles, mais le parent ne peut lier lui-même qu'un enfant de son école active | `school-access.ts:68-86`, `parents/link-child/route.ts:38,51` |
| Direction d'une école principale et de ses annexes | **Oui** | `school-access.ts:98-114` |

## 4. Écarts entre menu, page et serveur (constatés)

| Écart | Preuve |
|---|---|
| 50 pages du tableau de bord sans aucun lien entrant (accès par URL seulement) | Annexe A2, colonne « Réf. » = Non ; livrable 4 |
| NETWORK_ADMIN : permission `SCHOOL_CREATE` sans route utilisable | ci-dessus |
| `User.roles[]` élargit l'interface (`use-rbac.ts`), jamais le serveur | `use-rbac.ts:28,62` contre `api-helpers.ts:435-450` |
| Lien « Assistant IA » montré seulement aux rôles admis par la page (corrigé précédemment) | `role-nav.ts` `AI_ASSISTANT_ROLES` |

## 5. Désactivation, suppression et conservation

| Action | Effet vérifié |
|---|---|
| Désactivation (`isActive = false`) | Jeton invalidé à la requête suivante, après au plus 30 s par processus (`config.ts:451-460`) |
| Suppression d'un enseignant (`DELETE /api/teachers/[id]`) | Cours et classes principales retirés, disponibilités supprimées, rattachements ARCHIVED, profil supprimé logiquement, compte désactivé (`teachers/[id]/route.ts:497-535`). Un enseignant multi-écoles ne peut être supprimé que par le SUPER_ADMIN |
| Retrait d'une école (enseignant) | `detachTeacherFromSchool` : rattachement INACTIVE, cours retirés, journal. **Sessions ouvertes non invalidées** (MS-01) |
| Suppression d'un compte par la personne (`POST /api/users/[id]/delete`) | Suppression logique de son propre compte ; suppression définitive (HARD) réservée au SUPER_ADMIN, qui efface aussi notes et paiements de l'élève |
| Conservation | Politique par type de données (`DataRetentionPolicy`, `/api/compliance/retention`), purge `/api/system/retention` (voir PARCOURS-RGPD-001) |
