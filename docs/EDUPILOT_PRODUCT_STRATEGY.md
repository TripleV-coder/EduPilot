# EduPilot — Stratégie produit et différenciation (phase 3)

> 2026-11-24. S'appuie sur la [veille](EDUPILOT_COMPETITIVE_INTELLIGENCE.md) et l'[audit](EDUPILOT_TECHNICAL_AUDIT.md).
> Les montants marqués **(hypothèse)** sont à valider par un pilote : aucun client ne paie encore.

## 1. Le constat « méthode Wave »

Le marché vend la même liste de modules (notes, bulletins, frais, SMS) entre **150 000 et 200 000 F
par an** pour une école de 300 élèves (GestEcole, Geschoul). Personne ne documente ce qui fait
réellement mal à une direction :

| Frustration | Pourquoi elle coûte | Ce qui la résout |
|---|---|---|
| **L'argent** : impayés, montants contestés, reçus perdus, caisse qui ne tombe pas juste | Recouvrement manuel, conflits parent / école, fuites | Un dû juste et expliqué, un paiement sans file d'attente, un reçu vérifiable |
| **Le réseau** : coupures en classe, saisie perdue | Appel refait sur papier puis ressaisi | Saisie hors ligne, synchronisation sûre |
| **La double saisie** : EducMaster d'un côté, cahiers et Excel de l'autre | Des heures de secrétariat à chaque période | Export conforme EducMaster, identifiants partagés (NPI) |

## 2. Trois avantages à construire et prouver (classés)

| # | Proposition de valeur | Déjà acquis | À construire | Impact | Faisabilité | Coût | Risque |
|---|---|---|---|---|---|---|---|
| 1 | **« Chaque franc est juste, et il arrive sur le compte de l'école »** | Encaissement verrouillé et testé (150+ scénarios), compte marchand par école, bourses justes (FIN-01) | Reçus vérifiables par QR, écritures comptables automatiques (FIN-04), journal fournisseur (FIN-02), explication du dû côté parent, paiement multi-enfants | **Très fort** : touche la trésorerie | Élevée (le socle existe) | Moyen | Faible |
| 2 | **« Ça marche quand le réseau tombe »** | PWA, brouillon de notes | File d'attente hors ligne pour l'appel et les notes (IndexedDB), synchronisation avec détection de conflit, plages de numéros de reçus hors ligne | Fort (usage quotidien des enseignants) | Moyenne | Moyen à élevé | Moyen (conflits) |
| 3 | **« Une seule saisie, l'État compris »** | Moteur de moyennes conforme | Export au gabarit EducMaster, import des listes, correspondance NPI, journal des échanges | Fort pour les directions | **Dépend du gabarit officiel** | Faible à moyen | Élevé (accès au format) |

L'IA n'est pas un axe de différenciation à court terme : l'assistant local est lent sur
processeur, et Eduvate inclut déjà un assistant. Elle reste un **accélérateur** (appréciations,
synthèses), pas un argument de vente principal.

## 3. Segments

1. **Cœur** : écoles privées de 200 à 1 000 élèves (Cotonou, Abomey-Calavi, Porto-Novo), avec un
   comptable ou un économe, et des parents qui paient par Mobile Money.
2. **Expansion** : groupes scolaires (le rôle réseau `NETWORK_ADMIN` existe déjà).
3. **Hors cible pour l'instant** : petites écoles de moins de 100 élèves, sensibles au prix seul.

## 4. Modèle économique proposé (hypothèse à valider)

- **Ne pas s'aligner sur 500 F / élève.** Vendre le résultat : recouvrement et temps gagné.
- **Abonnement annuel par école**, par tranche d'effectif, publié sur le site. Ordre de grandeur
  visé (hypothèse) : **250 000 à 400 000 F par an pour 300 à 500 élèves**, justifié par l'encaissement
  en ligne et la fiabilité. Les plans se règlent déjà dans la console root
  (`/dashboard/root-control/plans`).
- **Essai gratuit de 30 jours** (Eduvate le propose déjà) et **reprise des données incluse**.
- **Jamais de commission prélevée sur les fonds de scolarité** sans validation juridique (§6 de la
  fiabilité financière).
- **Coûts réels à mesurer pendant le pilote** : hébergement, WhatsApp (catégorie « utilitaire »),
  SMS de secours, support. Aucun chiffre de marge n'est avancé sans mesure.

## 5. Distribution et preuves

1. **Un à trois pilotes** sur une année scolaire, avec des indicateurs relevés avant et après :
   taux de recouvrement à J+30, délai de confirmation des paiements, contestations de montant,
   heures de secrétariat par période.
2. Demander des démonstrations aux concurrents (Geschoul, GestEcole, Eduvate) pour transformer la
   veille « déclarée » en veille « testée ».
3. Raccordement EducMaster : partir d'une école pilote pour obtenir le gabarit officiel.

## 6. Réponse à la question finale de la mission

| Pour qui | Pourquoi EduPilot (aujourd'hui, prouvé) | À prouver par le pilote |
|---|---|---|
| Direction | Le dû est juste (bourses comprises), les fonds arrivent sur son compte, les moyennes béninoises sont exactes | Recouvrement amélioré |
| Enseignants | Saisie de notes et appel sur mobile (390 px vérifiés) | Hors ligne |
| Parents | Montant recalculé par le serveur, reçu seulement après confirmation réelle | Compréhension du dû, reçus QR |
| Groupe scolaire | Isolation par école, vue réseau | Pilotage multi-sites |
| Partenaire financier | Paiements idempotents, verrouillés, rapprochés | Journal d'événements, API |
