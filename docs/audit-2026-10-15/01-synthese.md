# Livrable 1 — Synthèse générale

> Audit en lecture seule du 2026-10-15, branche `feat/enseignant-multi-ecoles`, commit `0d57d9c`.
> Seul ajout au dépôt : le test de régression `tests/integration-db/multi-school-teacher.test.ts` (non commité) et ce dossier `docs/audit-2026-10-15/`. Aucun fichier source, schéma, migration ou configuration n'a été modifié.

## 1. Architecture actuelle (vérifiée)

| Couche | Réalité |
|---|---|
| Application | Next.js 16 (App Router), TypeScript ; **181 pages**, **313 routes API** (506 gestionnaires, dont 499 via `createApiHandler`) ; middleware `src/proxy.ts` (débit, 2FA, routes publiques) |
| Données | PostgreSQL 16 + Prisma 6 : **130 modèles**, 70 énumérations ; RLS forcée sur **16 tables** ; contexte de base fixé par requête (AsyncLocalStorage) |
| Identité | NextAuth, sessions JWT de 24 h ; **un rôle par compte** parmi 9 ; 102 permissions |
| Multi-écoles | École active dans le jeton ; liste d'écoles accessibles calculée à la connexion et au changement d'école ; enseignant limité à l'école active en base |
| Cache | Cache HTTP serveur (Redis TCP, Upstash ou mémoire), 30 à 300 s, clé par utilisateur et école ; mémoïsation en processus (15 à 60 s) ; SWR côté client ; service worker Serwist |
| Asynchrone | File de tâches PostgreSQL (email, SMS) ; maintenance quotidienne sous bail exclusif ; webhooks de paiement signés ; sauvegarde quotidienne |
| Externes | FedaPay, MTN MoMo, Flutterwave, Paystack, SMTP, passerelle SMS, n8n et fournisseurs LLM, Redis |

## 2. Domaines et acteurs
- **Domaines présents** : tous ceux de la grille A à AL, sauf **remboursements** (absent) et **support / assistance** (aucune route ni page). Domaines supplémentaires : comptabilité OHADA, RH (paie, congés), cantine, transport, bibliothèque, clubs, contrôle d'accès, alumni, cagnottes, portefeuille, signatures, IA, gamification, examens en ligne, vitrine publique.
- **Acteurs** : SUPER_ADMIN (dont un sous-rôle racine), NETWORK_ADMIN, SCHOOL_ADMIN, DIRECTOR, TEACHER, STAFF, ACCOUNTANT, PARENT, STUDENT.
- **Acteurs techniques** : cron, fournisseurs (webhooks), file de tâches.
- Matrice : livrable 2 et annexe A4.

## 3. Constats majeurs (anomalies confirmées)

| Rang | ID | Constat | Livrable |
|---|---|---|---|
| 1 | DA-10 (révisé) | **Les confirmations de paiement en ligne ne resynchronisent pas l'échéancier.** Les voies manuelles le font. Jusqu'au prochain encaissement manuel, échéances, relances, SMS, espace parent et plafond du guichet ignorent le paiement en ligne. Tableaux de bord et rapports restent justes. Risque distinct : encaissements **simultanés** au guichet (plafond lu hors transaction) *(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)* | 5, 9 |
| 2 | MS-03 | Le **service worker met en cache les réponses API et les pages authentifiées** pendant 24 h, sans distinction de compte ni d'école, et sans purge à la déconnexion | 7 |
| 3 | MS-01 | **Retrait d'accès sans effet sur les sessions ouvertes** (jusqu'à 24 h) ; `roleChangedAt` jamais écrit | 7 |
| 4 | DA-03 / DA-04 | **Suppression définitive d'une école** en cascade sans journal ; **journal d'audit supprimé** avec l'utilisateur | 5 |
| 5 | NAV-01 / NAV-02 | **Module RH inaccessible** (hub redirigé) ; **67 écrans** non atteignables depuis les menus, dont 50 sans aucune référence | 4 |
| 6 | DA-01 | Contrainte des présences inopérante quand `timeSlot` est NULL : doublons possibles | 5 |
| 7 | MS-02 | Un enseignant lit les **notes et bulletins de toute son école** | 7 |
| 8 | DA-07 | La direction peut **suspendre** son école (`isActive`) | 5 |
| 9 | MS-04 | Brouillon d'inscription (données d'un mineur) conservé sur l'appareil, sans propriétaire | 7 |
| 10 | MS-05 | `PATCH /api/root/users` accepte n'importe quel champ, sans journal | 7 |

**Constat corrigé en cours d'audit** : `/api/analytics/bi?schoolId=` n'est **pas** une faille. Le garde central de `createApiHandler` le refuse ; le test le démontre.

## 4. Points forts (prouvés)
- Isolation entre écoles, à la fois applicative et en base :
  - garde central `?schoolId` ;
  - RLS sur 16 tables ;
  - balayage de 70 routes `[id]` ;
  - nouveau test du parcours enseignant multi-écoles : 18 vérifications de contenu vertes.
- Paiements en ligne robustes : verrou, montant et devise, idempotence, réconciliation à 24 h (18 tests sur base réelle).
- Moteur de moyennes unique et banc de précision à 0 écart.
- File de tâches durable, coupe-circuits, bail de maintenance, arrêt propre.
- Clés de cache serveur propres à chaque utilisateur et à chaque école.

## 5. Couverture de cet audit (honnête)

| Élément | Couverture |
|---|---|
| Inventaires (routes, pages, modèles, permissions, menus) | **Exhaustifs** (extraction automatique, annexes A1 à A5) |
| Multi-écoles, cache, paiements | **Approfondis** (code + tests exécutés) |
| Parcours critiques (18) | Format complet, condensé (livrable 3 §A) |
| Autres parcours (≈ 35) | Inventoriés avec statut (livrable 3 §B) ; **description complète au lot 2** |
| Écrans | Statique ; **recette de navigation réelle non relancée** (navigateur non autorisé) |
| Performance | Mesures existantes reprises ; **aucun nouveau test de charge** |
| Non examinés | Contenu détaillé des modules secondaires (cantine, transport, bibliothèque, LMS, examens, IA, gamification, signatures, portefeuille) ; procédure de restauration ; `npm audit` des dépendances ; pages `/dashboard/system/*` |

## 6. Inconnues importantes
22 questions métier (livrable 11). Les plus structurantes :
- Q-ROLE-01 : fonctions différentes selon l'école ;
- Q-FIN-02 : validation de la règle d'affectation déjà implémentée (échéance impayée la plus ancienne) et de ses exceptions ;
- Q-BULL-01 : publication des bulletins ;
- Q-ROLE-03 : périmètre de l'enseignant ;
- Q-PERF-01 : objectif de capacité chiffré.
