# Livrable 11 — Questions métier (le code ne permet pas de trancher)

> Aucune décision n'est prise ici. Chaque question renvoie au constat qui la motive.

| ID | Question | Pourquoi elle se pose | Constat |
|---|---|---|---|
| Q-ROLE-01 | Une même personne doit-elle pouvoir avoir **des fonctions différentes selon l'école** (enseignante en A, parente en B, directrice en C) avec **un seul compte** ? | Aujourd'hui : un rôle par compte et un compte par email | Livrable 7 §8, livrable 2 §3 |
| Q-ROLE-02 | Le champ `User.roles[]` (« rôles hybrides ») doit-il avoir un effet réel, ou être retiré ? | Il élargit l'interface sans effet serveur | Livrable 2 §4 |
| Q-ROLE-03 | Un enseignant doit-il voir les **notes et bulletins de toute l'école**, ou seulement de ses classes ? Et le professeur principal ? Le conseil de classe ? | Les élèves sont restreints, pas les notes | MS-02 |
| Q-ROLE-04 | Le SUPER_ADMIN doit-il voir présences et incidents (permissions absentes aujourd'hui) ? | Minimisation volontaire ou oubli | Livrable 2 §1 |
| Q-ROLE-05 | Le NETWORK_ADMIN peut-il ouvrir une annexe (permission accordée, route refusée) ? | Incohérence | Livrable 2 §2 |
| Q-ACCES-01 | Délai maximal acceptable entre un retrait d'accès et sa prise d'effet (immédiat, 30 s, 5 min) ? | Aujourd'hui : jusqu'à 24 h | MS-01 |
| Q-ECOLE-01 | Qui peut **suspendre** une école : la plateforme seule, ou aussi la direction ou le réseau ? | Même champ `isActive` | DA-07 |
| Q-PARENT-01 | Comment une école B rattache-t-elle un **compte parent existant** (créé par l'école A) à un élève de B ? | Le parent ne peut lier qu'un enfant de son école active | PARCOURS-PARENT-001 |
| Q-INSCR-01 | Le **transfert** d'un élève entre deux écoles EduPilot est-il un parcours à prévoir (historique, notes, dossier) ? | Aucune route de transfert trouvée | SC-C-03 |
| Q-INSCR-02 | Le matricule doit-il être unique dans l'école, y compris pour les élèves supprimés ou partis ? | Index non unique | DA-02 |
| Q-FIN-01 | Que faire d'un **trop-perçu** : remboursement (par quel canal), avoir sur l'échéance suivante, transfert vers un autre enfant ? | Seule une note est enregistrée | PARCOURS-FINANCE-006 |
| Q-FIN-02 | EduPilot répartit actuellement les montants des paiements validés ou rapprochés entre les échéances impayées, en commençant par la plus ancienne (`syncPaymentPlanLedger`, `src/lib/finance/helpers.ts:269-400`). Validons-nous cette règle comme comportement général ? Existe-t-il des exceptions nécessitant une affectation manuelle ou particulière ? *(Corrigé le 2026-10-16 : voir le journal des corrections dans `00-INDEX.md`, C-01.)* | Règle implémentée mais jamais validée par le métier | DA-10, SIMP-01 |
| Q-FIN-03 | Les reçus doivent-ils avoir une **numérotation continue** ? | Guide 9.12 | SC-D-06 |
| Q-BULL-01 | Le bulletin doit-il avoir un état **« publié »** (figé, visible des familles à une date, notification), et peut-il être modifié ensuite ? | Aucun état publié | SC-E-03 |
| Q-NOTIF-01 | Faut-il prévenir les familles d'une **correction de note** ? D'une nouvelle note ? | A6 | SC-H-04 |
| Q-NAV-01 | Quels modules doivent apparaître dans le menu, et pour quels rôles ? | 67 écrans non atteignables | NAV-01, NAV-02 |
| Q-RGPD-01 | Durées légales de conservation (notes, bulletins, pièces comptables, santé, signalements), et que faire à la **fermeture d'une école** (suppression ou archivage) ? | Suppression en cascade aujourd'hui | DA-03, DA-04, PARCOURS-RGPD-001 |
| Q-RGPD-02 | La purge de conservation doit-elle être **planifiée** (cron), et à quelle fréquence ? | Absente du cron livré | SC-J-03 |
| Q-ECOUTE-01 | Faut-il un **code de suivi** pour les signalements anonymes à la cellule d'écoute ? | Décision en attente | PARCOURS-ECOUTE-001 |
| Q-PERF-01 | Quel objectif de capacité **chiffré** à 12 et 24 mois (écoles peuplées, comptes, pointe de connexions) ? | Nécessaire pour dimensionner les scénarios du livrable 8 | Livrable 8 |
| Q-PERF-02 | Hors-ligne : faut-il consulter hors connexion des données déjà vues (et lesquelles), au prix des précautions du MS-03 ? | Le service worker met tout en cache aujourd'hui | MS-03 |
| Q-SEC-01 | Faut-il imposer une **expiration** au mot de passe provisoire ? | Il n'expire pas (A10) | PARCOURS-AUTH-002 |
