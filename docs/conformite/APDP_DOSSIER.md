# Dossier APDP — EduPilot

Brouillon des démarches auprès de l'**Autorité de Protection des Données à
caractère Personnel (APDP, apdp.bj)**, au titre du Livre V du Code du numérique
(loi n° 2017-20, modifiée par la loi n° 2020-35).

> ⚠️ Ce document n'est pas un avis juridique. Les articles cités (391 :
> transferts ; 446 : mineurs) ont été relevés dans des reprises du texte de
> 2017 ; **vérifier la numérotation et la rédaction dans le texte consolidé**
> et utiliser les **formulaires officiels** de l'APDP (formulaire de
> déclaration, formulaire de transfert). Les mentions `[À COMPLÉTER]` sont à
> remplir par l'école ou l'exploitant.

## 0. Qui fait quoi

| Rôle | Qui | Démarche |
|---|---|---|
| **Responsable du traitement** | chaque **école** (elle décide des finalités : scolarité, notes, finances) | déclaration / demande d'autorisation du traitement (partie A) |
| **Sous-traitant** | l'**exploitant d'EduPilot** `[À COMPLÉTER : nom, IFU, RCCM, adresse]` | contrat de sous-traitance avec chaque école ; dossier de transfert commun (partie B) |
| Sous-traitants ultérieurs | hébergeur, Meta (WhatsApp), passerelle SMS, e-mail, FedaPay | listés en partie B |

Conseil : déposer **une seule fois** le dossier de transfert pour la plateforme
(partie B), et fournir aux écoles un modèle de déclaration déjà rempli
(partie A) qu'elles signent.

---

## A. Déclaration du traitement « gestion scolaire » (par l'école)

**Dénomination** : gestion de la scolarité, de la vie scolaire, des résultats
et des frais de scolarité de `[À COMPLÉTER : nom de l'école]` au moyen de la
plateforme EduPilot.

**Finalités**
1. Inscriptions, classes, emplois du temps.
2. Notes, moyennes, bulletins, conseils de classe, orientation.
3. Assiduité (appel), justification des absences, information des familles.
4. Vie scolaire : discipline (incidents, sanctions), cahier de liaison.
5. Frais de scolarité : échéanciers, paiements (dont paiement mobile), reçus.
6. Communication école-famille : messagerie, notifications, e-mail,
   **WhatsApp** (canal principal), **SMS** (secours).
7. Santé scolaire (module optionnel) : dossier médical, allergies, vaccinations.
8. Personnel : présence, congés, paie (module RH).

**Personnes concernées** : élèves (majoritairement **mineurs**), parents et
responsables légaux, enseignants et personnel.

**Catégories de données**

| Catégorie | Exemples |
|---|---|
| Identité | nom, prénoms, date et lieu de naissance, sexe, matricule, photo |
| Coordonnées | téléphone, e-mail, adresse (parents, personnel) |
| Scolarité | classe, notes, moyennes, rangs, bulletins, absences, retards |
| Vie scolaire | incidents, sanctions, observations |
| Financier | frais dus, paiements, références de transaction mobile |
| **Santé (sensible)** | dossier médical, allergies, vaccinations — module désactivable |
| Connexion et sécurité | journaux d'accès, adresses IP, double authentification |

**Base de licéité** : exécution de la mission éducative et du contrat de
scolarité ; **consentement** pour les usages non nécessaires (droit à l'image,
statistiques d'usage) ; pour les **mineurs de moins de 16 ans**, consentement
recueilli auprès du titulaire de l'autorité parentale (art. 446) — EduPilot
le demande à la première connexion du parent (écran « Avant de continuer »).

**Destinataires** : personnel habilité de l'école (accès par rôle :
direction, enseignants, comptabilité, vie scolaire), parents pour leurs
enfants, élèves pour eux-mêmes. **Aucune donnée d'une école n'est accessible
à une autre** (cloisonnement en base : sécurité au niveau des lignes).

**Durées de conservation** (réglables par l'école dans EduPilot,
Conformité › Rétention) :

| Données | Traitement |
|---|---|
| Comptes des élèves partis | désactivés, coordonnées effacées |
| Notes et bulletins des élèves partis | anonymisés |
| Dossiers médicaux des élèves partis | supprimés |
| Pièces comptables | conservées (obligation légale), jamais supprimées automatiquement |
| Journaux (badges, audit), notifications, messages | supprimés à l'échéance |

**Droits des personnes** : accès et **téléchargement** de ses données,
rectification, gestion des consentements, **effacement** (anonymisation du
compte) — rubrique « Mes données personnelles » ; demandes traitées par
l'école (Conformité › Demandes). Point de contact : `[À COMPLÉTER : e-mail du
référent données de l'école]`.

**Mesures de sécurité** (techniques, vérifiables)
- HTTPS obligatoire ; pare-feu (seuls les ports web ouverts) ; mises à jour
  de sécurité automatiques.
- Cloisonnement des écoles en base (RLS PostgreSQL, rôle applicatif sans
  privilège de contournement).
- Mots de passe hachés (bcrypt) ; double authentification ; verrouillage
  après échecs ; sessions révocables.
- Secrets (clés de paiement, intégrations, 2FA) chiffrés AES-256-GCM.
- Sauvegarde **quotidienne chiffrée** (AES-256), copie hors serveur,
  restauration éprouvée.
- Journal d'audit des actions sensibles ; journal des erreurs sans données
  personnelles.

---

## B. Demande d'autorisation de transfert hors du Bénin (exploitant)

Art. 391 : tout transfert vers un État tiers requiert l'**autorisation
préalable de l'APDP**, qui apprécie le niveau de protection du pays ou les
garanties contractuelles.

| Destinataire (sous-traitant) | Pays | Données transférées | Finalité | Garanties à joindre |
|---|---|---|---|---|
| Hébergeur du serveur `[À COMPLÉTER : Contabo GmbH / OVHcloud]` | **Allemagne / France (UE)** | toutes les données de la plateforme | hébergement | contrat et accord de traitement (DPA) de l'hébergeur ; le RGPD s'applique dans le pays |
| **Meta Platforms** (WhatsApp Business) | **États-Unis** (et UE) | numéro de téléphone du destinataire, texte du message | information des familles | conditions WhatsApp Business et accord de traitement de Meta `[À COMPLÉTER : version et lien]` |
| Passerelle SMS `[À COMPLÉTER]` | `[À COMPLÉTER]` | numéro, texte | secours des messages | contrat du fournisseur |
| E-mail `[À COMPLÉTER : Brevo (France) / autre]` | `[À COMPLÉTER]` | adresse e-mail, contenu du message | réinitialisation de mot de passe, avis | DPA du fournisseur |
| FedaPay | Bénin | montant, référence, téléphone du payeur | paiement mobile | (pas de transfert hors Bénin) |

**Minimisation déjà en place**
- WhatsApp et SMS ne reçoivent **que** le numéro et le texte du message ;
  aucun dossier, aucune note détaillée, aucune donnée de santé n'est envoyé.
- L'assistant IA d'EduPilot fonctionne **entièrement sur le serveur** :
  aucune donnée n'est envoyée à un service d'intelligence artificielle.
- Les comparaisons entre établissements n'utilisent que des chiffres agrégés.

**Pièces à joindre (à confirmer auprès de l'APDP)**
1. Formulaire de transfert de l'APDP, rempli.
2. Description du traitement (partie A) et de l'architecture (schéma :
   navigateur → HTTPS → serveur UE ; serveur → Meta / SMS / e-mail).
3. Contrats et accords de traitement de chaque sous-traitant.
4. Mesures de sécurité (liste ci-dessus).
5. Identité de l'exploitant (`[À COMPLÉTER : RCCM, IFU]`) et du référent.

## C. Avant la mise en service — liste de contrôle

- [ ] Partie B déposée et autorisation reçue (transferts).
- [ ] Partie A signée et déposée par chaque école cliente.
- [ ] Contrat de sous-traitance signé avec chaque école.
- [ ] Module Santé activé seulement là où une personne formée l'utilise.
- [ ] Mentions d'information affichées (pages légales d'EduPilot : à relire
      avec le nom réel de l'exploitant).
- [ ] Point ouvert à trancher : la **suppression définitive** réservée au
      super-administrateur efface aussi des pièces comptables (guide
      utilisateur §15.6) — la limiter ou la remplacer par l'anonymisation.
