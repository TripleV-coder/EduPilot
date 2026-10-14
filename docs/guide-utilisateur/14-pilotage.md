# 14. Tableaux de bord, analyses et alertes

---

## 14.1 Analyses de l'établissement ✅
- *Analytics* et *Performances pédagogiques* : moyennes par classe, niveau et matière ; répartition des notes ; comparaison entre classes et entre périodes ; lien entre assiduité et résultats.
- Les rapports s'exportent en PDF ou en tableur.

Les moyennes des élèves utilisées dans ces analyses viennent du **même calcul** que le bulletin (chapitre 4). Elles sont mises à jour à chaque saisie de note.

> **À distinguer** : certaines statistiques globales (« moyenne de toutes les notes de l'école », répartition des notes par tranche) portent sur **les notes une à une**. Ce ne sont pas des moyennes générales d'élèves au sens du bulletin.

## 14.2 Prévention : décrochage, échec, impayés ✅
- *Décrochage* : élèves dont l'absentéisme, l'engagement ou les incidents annoncent un risque.
- *Échec scolaire* : élèves dont les résultats se dégradent avant la fin de la période.
- *Impayés* : familles en retard de paiement.

Ce sont des **signaux d'alerte**, pas des jugements : ils servent à agir tôt.

- Le **niveau de risque** affiché est partout le même : celui calculé avec les seuils de l'école (3.9), avec ses causes en clair (« Assiduité faible : 78 % »…).
- La **matrice des risques** place chaque élève selon son taux d'absence et sa moyenne. Les lignes du milieu sont aux seuils de l'école. Un élève sans moyenne ou sans appel n'y figure pas.
- Les seuils, poids et périodes observées se règlent dans *Paramètres → Paramètres de l'établissement*.

## 14.3 Prévision de la moyenne suivante ✅
L'application estime la moyenne de la période suivante à partir des moyennes passées de l'élève. Elle affiche :
- la **moyenne prévue** ;
- une **fourchette à 95 %** et une **fourchette à 80 %** ;
- la **chance d'être à ±1 point** de la prévision.

**Ce que valent ces chiffres** (mesuré sur 5 000 parcours d'élèves) :
- l'écart moyen avec la réalité est de **1,1 point**. C'est mieux que de reprendre la dernière moyenne (1,2 point) ou de prolonger une droite (1,3 point) ;
- la fourchette « 95 % » contient la vraie moyenne **94 fois sur 100**, et la fourchette « 80 % » **82 fois sur 100** ;
- la « chance d'être à ±1 point » est légèrement prudente : la réalité fait un peu mieux que ce qui est annoncé.

**Bon à savoir :**
- avec un historique court (1 ou 2 périodes), la fourchette est volontairement large, et un message le signale ;
- sans aucune moyenne enregistrée, l'application **n'affiche pas de prévision** (avant, elle affichait 10/20) ;
- une rupture brusque (changement d'école, événement personnel) reste par nature imprévisible : la prévision est une **tendance**, la décision reste humaine.

Détail des mesures : `docs/VERIFICATION_CALCULS_ET_IA.md`.

## 14.4 Comparaisons ✅
- *Pilotage de l'organisation* : comparaison des écoles d'un même réseau, sur la même année de référence.
- *Benchmark national* : position de l'école par rapport aux données publiques nationales (module « Comparaison entre établissements » : des chiffres agrégés sortent de l'établissement).

## 14.5 Journal d'audit ✅
*Journal d'audit* : toutes les actions importantes (qui, quoi, quand), consultables 90 jours en accès direct. Depuis l'ajout de l'historique des notes (chapitre 6), chaque modification de note y figure aussi.
