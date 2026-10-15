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
| Expiré · à rapprocher | paiement en ligne resté sans confirmation après 24 h : à comparer avec le relevé du fournisseur |

## 9.3 Payer en ligne par Mobile Money ✅
Le parent peut payer depuis l'application si l'école a configuré le paiement en ligne (MTN Mobile Money ou FedaPay, qui couvre MTN, Moov et Celtiis).
- Le montant est plafonné au **reste à payer** : montant de l'échéancier s'il existe (bourses déduites), sinon montant du frais, moins ce qui est déjà validé ou rapproché.
- Un paiement en ligne **en attente depuis moins de 24 h** réserve son montant : on ne peut pas relancer un second paiement qui dépasserait le reste à payer. Le message indique le montant encore payable. Passé 24 h, l'essai ne bloque plus rien.
- Deux demandes envoyées **en même temps** (double clic, deux téléphones) ne créent jamais deux paiements pour le même reste à payer.
- La confirmation du fournisseur est **vérifiée** : authenticité, **montant exact** et **devise (franc CFA)**. Un montant partiel, supérieur, absent ou une autre devise **ne valide rien** : le paiement reste visible avec la mention « À rapprocher » et l'écart constaté.
- Une confirmation n'est prise en compte qu'**une fois**, même si elle arrive plusieurs fois.
- **Au bout de 24 h sans réponse**, la maintenance quotidienne interroge le fournisseur : payé au bon montant → validé ; échec → annulé ; incertain → « Expiré · à rapprocher ». Rien n'est supprimé.
- Une confirmation **tardive** (après expiration) est encore acceptée si elle est authentique et au bon montant : l'argent a bien été reçu. Si la famille avait réglé autrement entre-temps, le **trop-perçu** est noté sur le paiement pour être traité.
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
- Le **remboursement** d'un trop-perçu se traite encore hors de l'application (décision à prendre).
