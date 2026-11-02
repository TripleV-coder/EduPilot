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
| Expiré · à rapprocher | demande de paiement en ligne jamais transmise au fournisseur : rien n'a été prélevé, à rapprocher si besoin |

## 9.3 Payer en ligne par Mobile Money ✅
Le parent paie depuis *Paiements* (*Scolarité et paiements*), **enfant par enfant**.
- **Un seul enfant** : sa situation s'affiche directement. **Plusieurs enfants** : on choisit l'enfant ; chacun garde son école, ses frais et son reste à payer. Rien n'est additionné entre enfants, même dans deux écoles différentes.
- Pour chaque frais de l'année : montant, déjà payé (confirmé), en attente de confirmation, reste à payer, et les **échéances** s'il existe un échéancier. Seuls les frais qui concernent l'enfant apparaissent : son année, son niveau, et les frais facultatifs auxquels il est inscrit.
- Trois façons de payer, selon ce qui existe vraiment :
  - **la prochaine échéance** (seulement la plus ancienne non réglée, si un échéancier existe) ;
  - **tout le solde** ;
  - **un autre montant**, en francs CFA entiers, sans dépasser ce qui est payable maintenant.
  Pour l'échéance et le solde, c'est l'application qui calcule le montant au moment du paiement, pas l'écran.
- Le paiement se fait chez **FedaPay** (MTN, Moov, Celtiis), **sur le compte de l'école de l'enfant**. Chaque école a son propre compte : l'argent ne passe jamais par le compte d'une autre école ni par un compte commun. Si l'école n'a pas de compte actif, le paiement en ligne est indiqué **indisponible** et le parent règle à l'économat.
- Un paiement **en attente réserve son montant**, quel que soit son âge : on ne peut pas payer deux fois la même somme. Tant qu'il attend, seul un « autre montant » reste possible, dans la limite de ce qui n'est pas réservé.
- Deux demandes envoyées **en même temps** (double clic, deux onglets, deux téléphones) ne créent jamais deux paiements pour la même somme.
- Si le fournisseur ne répond pas clairement au lancement, le paiement reste **en vérification** : ne pas le relancer, il sera vérifié automatiquement.
- **Au retour de FedaPay**, la page affiche l'état **enregistré par l'école**, jamais celui annoncé par le navigateur : confirmé, en attente, en vérification ou non abouti. Elle se met à jour seule pendant quelques minutes, puis sur demande. Le paiement reste visible dans l'historique de l'enfant (bouton *Suivre*).
- La confirmation du fournisseur est **vérifiée** : authenticité (secret du compte de l'école), **montant exact** et **devise (franc CFA)**. Sinon rien n'est validé et le paiement est marqué « À rapprocher ». Une confirmation n'est comptée qu'**une fois**.
- **Au bout de 24 h sans réponse**, la maintenance quotidienne interroge le fournisseur avec le compte de l'école : payé au bon montant → validé ; échec → annulé ; incertain → reste en attente ; au-delà de 48 h, l'école est alertée.
- **Sans attendre**, le comptable ou l'administration de l'école peut ouvrir *Finance › Rapprochement* et cliquer sur **Interroger le fournisseur** devant un paiement en ligne en attente, en indiquant un motif (par exemple : la famille présente un débit sur son téléphone). Les règles sont les mêmes : validé seulement si le fournisseur confirme le bon montant, annulé seulement s'il déclare un échec définitif, sinon rien ne change et le montant reste réservé. Le motif, l'auteur et la réponse sont conservés sur le paiement et dans le journal. Il n'existe **aucun moyen de libérer un montant sans réponse du fournisseur**. Un paiement pour lequel le fournisseur n'a jamais donné de numéro de transaction ne peut pas être interrogé : il faut alors vérifier dans l'espace FedaPay de l'école.
- Le **reçu** PDF n'existe que pour un paiement **confirmé** (validé ou rapproché) ; il ne montre pas les notes internes de l'école.
- Le **remboursement** d'un paiement en ligne se fait par l'école depuis son espace FedaPay ; il n'est pas automatisé dans l'application.

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
- **Une contribution déclarée par une famille est « en attente »** : elle n'entre pas dans le total collecté tant que l'école n'a pas vérifié la somme.
  - La famille remet l'argent au secrétariat, ou paie par Mobile Money et indique la référence.
  - Le **comptable** ou la **direction** ouvre la cagnotte : la carte *À valider* liste chaque déclaration avec le nom de la famille, la référence et le montant.
  - *Somme reçue* : la contribution est comptée, le journal public l'affiche comme reçue, la famille est prévenue.
  - *Rejeter* : un motif est obligatoire (par exemple « aucune somme reçue à ce nom ») ; la famille le reçoit dans sa notification et le voit sur la cagnotte.
  - Quand le comptable encaisse lui-même au guichet pour une famille, la contribution est comptée tout de suite.
- Chaque décision est inscrite au journal d'audit (auteur, date, motif).

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
