# 11. Communication avec les familles

---

## 11.1 Messagerie ✅
*Messages* : conversations entre le personnel, les parents et les élèves de l'établissement. La direction peut envoyer un message à un groupe (une classe, tous les parents d'un niveau…).

Les nouveaux messages arrivent **en temps réel**, sans recharger la page : en général en moins d'une seconde, au plus 2 à 3 secondes. Si la connexion est coupée, la messagerie se remet à jour d'elle-même dès qu'elle revient.

**Écrire à quelqu'un** : *Nouveau message*, puis tapez le nom, le prénom ou l'e-mail de la personne dans la recherche. Chaque personne est affichée avec son rôle et son e-mail, pour distinguer les homonymes. Qui peut écrire à qui :
- la direction : toute personne de l'établissement ;
- un enseignant : les élèves et les parents de ses classes, et la direction ;
- un parent ou un élève : les enseignants des classes concernées, et la direction ;
- le reste du personnel : la direction et les enseignants.

Le comptable peut transmettre le journal comptable à la direction par la messagerie. Un organisateur de cagnotte peut écrire à tous les participants.

## 11.2 Annonces ✅
*Fil d'annonces* : informations générales de l'école, visibles par les publics choisis (personnel, parents, élèves).

## 11.3 Notifications ✅
*Centre de notifications* : toutes les alertes reçues. Un clic ouvre directement la page concernée : une note, une absence, un paiement, un message…

Une nouvelle notification s'affiche **aussitôt** dans un petit encadré en haut à droite, avec un bouton *Ouvrir*, et un point rouge apparaît sur la cloche. Sur la page *Messages*, un message reçu apparaît directement dans la conversation, sans encadré.

### Notifications push sur le téléphone ✅
Dans *Paramètres › Notifications*, **« Activer sur cet appareil »** : les notifications de l'école (absence, note, paiement, message…) arrivent sur le téléphone ou l'ordinateur **même application fermée**. Chaque appareil s'active séparément ; plusieurs notifications reçues ensemble deviennent un seul résumé. La déconnexion arrête le push sur l'appareil.
- Sur **iPhone / iPad** : ajouter d'abord EduPilot à l'écran d'accueil (Partager › Sur l'écran d'accueil), puis l'ouvrir depuis son icône.
- 🔧 La plateforme doit avoir ses clés de notification (VAPID) : sans elles, la page l'indique.
- 🔧 Pas encore de choix par type de notification : c'est tout ou rien, par appareil.

Les e-mails de sécurité (mot de passe oublié, lien d'activation) partent toujours. Les SMS, WhatsApp et messages vocaux sont envoyés par l'établissement selon ses règles : pour ne plus les recevoir, s'adresser à l'établissement.

## 11.4 Modèles de messages ✅
*Modèles de communication* : modèles d'e-mail, de SMS et de WhatsApp propres à l'école, réutilisables (relance, convocation, information).

## 11.5 Notifications vocales et WhatsApp ✅ (module à activer)
Messages vocaux en plusieurs langues et messages WhatsApp aux familles. **Les numéros de téléphone sont transmis à un prestataire** pour l'envoi.
- **WhatsApp** (*Diffuser un message*) : à toute l'école ou à une classe ; une trace par famille dans l'historique. Passe par un **modèle de message approuvé par Meta** (WhatsApp Business).
- **Messages vocaux** (*Nouvelle campagne*) : français, fon, yoruba, bariba ou dendi, avec la version française gardée par l'école ; une passerelle d'appels passe les appels.
- Les familles retenues sont les parents dont un enfant est **inscrit** dans l'école (ou la classe) et qui ont un numéro valide ; le nombre de familles sans numéro est affiché.
- 🔧 Il faut que la plateforme ait configuré WhatsApp Business et la passerelle vocale : sinon, l'envoi est refusé avec une explication.
- 🔧 « Envoyé » signifie accepté par le prestataire : la remise et la lecture ne sont pas encore suivies.

## 11.6 Cahier de liaison
Voir le chapitre 8.

## 11.7 Ce qui est envoyé automatiquement
| Événement | Qui est prévenu |
|---|---|
| Absence ou retard à l'appel | les parents (application, e-mail, ou SMS sans compte) |
| Échéance de paiement (7 jours avant, le jour même, en retard, retard critique) | les parents |
| Bourse attribuée | l'élève et ses parents |
| Plan de paiement créé | l'élève et ses parents |
| Résultat d'un examen en ligne | l'élève |

Un envoi qui échoue n'annule jamais l'action qui l'a déclenché. Les envois sont faits en arrière-plan : on n'attend pas leur fin pour continuer à travailler.
