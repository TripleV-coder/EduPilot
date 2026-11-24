# EduPilot — Architecture cible (phase 4)

> 2026-11-24. Principe : **garder le monolithe Next.js + PostgreSQL**. Il est testé, isolé par RLS,
> et son état partagé est déjà dans PostgreSQL. Aucune réécriture, aucun nouveau service sans
> mesure qui le justifie.

## 1. Ce qui ne change pas (décisions saines)

Next.js App Router, `createApiHandler`, Prisma et PostgreSQL avec RLS, file de tâches PostgreSQL,
compte marchand par école, IA locale, moteur de moyennes unique.

## 2. Corrections de l'existant

| Sujet | Changement | Alternative écartée |
|---|---|---|
| Bourses (FIN-01) | ✅ fait : source unique `lib/finance/scholarships.ts` | Créer un échéancier automatique pour chaque boursier : effets de bord (relances, souscription des frais facultatifs) |
| Transitions de paiement (FIN-03) | Table des transitions + `assertPaymentTransition` + trigger SQL | Nouveaux états REFUNDED/DISPUTED : touche 150+ tests pour un gain nul |
| Débit public (PERF-02) | Garder le nonce CSP ; mettre en cache les données de la vitrine plutôt que la page | Retirer le nonce : régression de sécurité |
| Mobile (PERF-01) | Profiler l'hydratation, déplacer des composants client en Server Components, diviser les gros écrans | Application native : coût élevé, rejetée en juillet 2026 |

## 3. Nouveaux composants justifiés

### 3.1 Journal des événements fournisseur (FIN-02)
`PaymentProviderEvent { id, provider, eventId UNIQUE(provider,eventId), paymentId?, signatureOk, payload JSONB, outcome, receivedAt }`,
écrit **avant** le traitement du webhook. Il rend visible le rejeu, permet de rejouer un événement
et appuie le rapprochement.

### 3.2 Écritures comptables automatiques (FIN-04)
À la validation, à l'annulation ou au remboursement d'un paiement de scolarité, une `JournalEntry`
équilibrée est écrite dans la même transaction (compte de trésorerie / compte clients). Le plan de
comptes est configurable par école. Prérequis : validation par un comptable OHADA.

### 3.3 Hors ligne (OFF-01)
- **Périmètre** : appel, saisie de notes, consultation de *ses* classes. **Jamais** le paiement
  Mobile Money, ni un reçu présenté comme « encaissé » sans confirmation du serveur.
- **Mécanisme** : file d'attente dans IndexedDB (API native, sans nouvelle dépendance), chaque
  opération porte une **clé d'idempotence** générée sur l'appareil. Le serveur accepte ou refuse
  chaque opération en la rejouant. Conflit = même élève, même évaluation, valeur serveur modifiée
  depuis la lecture → l'enseignant tranche, il n'y a pas d'écrasement silencieux.
- **Données en cache** : chiffrées par session et purgées à la déconnexion (respect de MS-03).
- **Reçus papier hors ligne** : plages de numéros attribuées par le serveur à un poste
  (`ReceiptRange { schoolId, deviceId, from, to }`), saisies ensuite en « encaissé à confirmer ».

### 3.4 Passerelle EducMaster (INT-01)
`ExternalIdentifier { entity, entityId, system: "EDUCMASTER", externalId (NPI…) }`, avec un
adaptateur d'export au gabarit officiel, un import des listes avec détection des doublons par NPI,
et un journal `IntegrationExchange` (date, période, lignes, rejets). **Bloqué** tant que le gabarit
officiel n'est pas obtenu.

### 3.5 Observabilité
Journaux structurés déjà présents (journal interne qui a remplacé Sentry). À ajouter : identifiant
de corrélation de bout en bout pour chaque paiement (initiation → webhook → validation), et des
métriques de fiabilité financière (§17 de la mission) exposées dans la console root.

## 4. Capacité

Mesuré : environ 35 req/s sur `/` en un seul processus, 136 req/s/processus sur l'API [D]. Il
faut d'abord passer à plusieurs processus (`WEB_CONCURRENCY`, déjà supporté) et monter le pool
Prisma. **Aucune promesse de « millions d'utilisateurs » sans test de charge sur les routes
authentifiées.**
