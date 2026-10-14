# 9. Argent : frais, paiements, bourses, comptabilité

**Règle de base ✅** : tous les montants sont en **francs CFA entiers**. Le franc CFA n'a pas de centimes : l'application refuse tout montant avec des centimes, ainsi que tout montant nul, négatif ou illisible.

---

## 9.1 Les frais ✅
*Finance → Configuration des frais* : scolarité, inscription et autres lignes tarifaires. Pour chaque frais :
- nom ;
- montant ;
- année scolaire ;
- niveau concerné (facultatif) ;
- date limite ;
- obligatoire ou non.

Un frais déjà payé par au moins une famille **ne peut pas être supprimé** : il est seulement désactivé, pour garder l'historique.

## 9.2 Encaisser un paiement ✅
*Finance → Nouvel encaissement* : élève, frais, montant, mode de paiement :
- espèces ;
- Mobile Money MTN ;
- Mobile Money Moov ;
- virement bancaire ;
- chèque ;
- autre.

- Le montant ne peut pas dépasser le **reste à payer** de ce frais.
- Chaque paiement reçoit une **référence**.
- Un **reçu** en PDF peut être téléchargé.

Un paiement passe par ces états :

| État | Signification |
|---|---|
| En attente | paiement en ligne lancé, pas encore confirmé |
| Validé | l'argent est reçu |
| Rapproché | rapproché d'un relevé bancaire |
| Annulé | le paiement n'a pas abouti |

## 9.3 Payer en ligne par Mobile Money ✅
Le parent peut payer depuis l'application si l'école a configuré le paiement en ligne (MTN Mobile Money ou FedaPay, qui couvre MTN, Moov et Celtiis).
- Le montant est plafonné au **reste à payer**. Un même frais ne peut donc pas être payé deux fois.
- La confirmation du fournisseur est **vérifiée** (authenticité, montant). Elle n'est prise en compte qu'une fois, même si elle arrive deux fois.
- Si le paiement en ligne n'est pas configuré, l'application le dit clairement. Un transfert déjà reçu s'enregistre alors à la main, avec sa référence.

## 9.4 Plans de paiement (échéancier) ✅
Un frais peut être payé en **2 à 12 mensualités**.
- Les **bourses actives** de l'élève sont déduites avant le découpage.
- Le total est découpé en **mensualités entières dont la somme tombe juste**. Par exemple, 100 000 FCFA en 3 donne 33 334 + 33 333 + 33 333.
- Les échéances tombent le même jour chaque mois. Si ce jour n'existe pas dans le mois, l'échéance tombe le **dernier jour** du mois (le 31 janvier est suivi du 28 ou 29 février, pas du 3 mars).
- Le plan est soldé quand toutes les mensualités sont payées.

## 9.5 Relances automatiques ✅
Pour chaque échéance, la famille reçoit au plus une relance par étape :

| Étape | Quand |
|---|---|
| À venir | dans les **7 jours** avant l'échéance |
| Aujourd'hui | le jour de l'échéance |
| En retard | de 1 à 30 jours après |
| Retard critique | plus de **30 jours** après |

Une échéance non payée passe automatiquement « en retard ». Les jours sont comptés de manière identique, quel que soit le serveur.

## 9.6 Bourses et aides ✅
*Bourses & aides scolaires* : une bourse est soit un **montant**, soit un **pourcentage** (de 1 à 100 %), avec une date de début et, au besoin, une date de fin.
- Types : mérite, sur critères sociaux, sportive, partielle, totale, autre.
- La famille est prévenue de l'attribution.
- Plusieurs bourses actives s'additionnent. Le reste à payer ne descend jamais sous 0.

## 9.7 Avis de paiement ✅
*Finance → Avis de paiement* : pour un frais et un niveau, l'application calcule le **reste à payer** de chaque élève (montant du frais moins ses paiements validés) et prépare les avis à remettre aux familles.

## 9.8 Rapprochement, rapports, exports ✅
- *Réconciliation bancaire* : associer les virements reçus aux paiements des élèves.
- *Rapports financiers* : revenus, impayés, prévisions.
- *Export financier* : extractions pour la comptabilité. Les contenus dangereux pour un tableur sont neutralisés.

## 9.9 Cagnottes ✅
*Cagnottes & pots communs* : sortie scolaire, fournitures partagées, cadeau collectif.
- 100 % transparent, sans frais.
- Les contributions vont de 1 à 100 000 000 FCFA (entiers).
- Les contributeurs apparaissent par leurs initiales.
- Une cagnotte peut être ouverte, clôturée ou annulée.

## 9.10 Portefeuille de l'école ✅
*Wallet école* : solde consolidé des comptes Mobile Money et bancaires de l'école. Aucune vérification d'identité fictive n'y est simulée.

## 9.11 Comptabilité OHADA ✅
*Comptabilité OHADA* :
- tenue en **partie double** (SYSCOHADA) ;
- une écriture a au moins deux lignes, chacune au débit **ou** au crédit ;
- le total des débits doit **égaler** le total des crédits ;
- chaque montant est un nombre entier de francs, strictement positif.

## 9.12 Points sensibles encore ouverts 🔧
- Le **numéro de reçu** est aujourd'hui un extrait d'identifiant. Il n'y a pas de numérotation continue (0001, 0002…), souvent exigée pour les pièces comptables.
- La **suppression définitive** d'un compte élève par l'administrateur de la plateforme efface aussi ses paiements. Les pièces comptables doivent normalement être conservées.
- La confirmation d'un paiement en ligne est acceptée **sans contrôle du montant** quand le fournisseur ne le transmet pas, et la **devise** n'est jamais vérifiée.
