# ADR-0014 : WhatsApp canal principal des messages aux familles, SMS en secours

**Statut** : Accepté (décision du propriétaire, 2026-11-14)

## Contexte

Les familles béninoises utilisent massivement WhatsApp. Un message utilitaire
WhatsApp coûte environ 0,004 $ (≈ 2,4 FCFA, tarif Meta « Afrique » du
1er octobre 2026), contre 8 à 25 FCFA pour un SMS local et jusqu'à 95 FCFA via
un agrégateur. Jusqu'ici, WhatsApp ne servait qu'aux diffusions manuelles, et
« envoyé » voulait seulement dire « accepté par Meta » (TD-027) : un numéro
sans WhatsApp n'était jamais rattrapé.

## Décision

- Un point d'envoi unique, `src/lib/notifications/family-channel.ts` :
  WhatsApp d'abord ; SMS seulement en **secours** et seulement si permis
  (`smsFallback`) — WhatsApp non configuré, refus immédiat de Meta (4xx),
  ou échec signalé ensuite par Meta.
- Branché sur : alertes d'absence/retard, relances de paiement, envois
  manuels et groupés (`/api/notifications/sms`), diffusion WhatsApp.
- Un modèle Meta par type (absence, paiement, notes, rappel) et un modèle par
  défaut, réglés dans la console root ; le texte de l'école est le paramètre
  {{1}}, aplati selon les règles Meta.
- Statuts reçus par `/api/whatsapp/webhook` : signature
  `X-Hub-Signature-256` obligatoire (clé secrète de l'application Meta),
  jeton de vérification dérivé du secret maître. Identifiant Meta stocké dans
  `communication_logs.externalId` (indexé). Statuts sans recul
  (SENT → DELIVERED → READ) ; FAILED → SMS de secours **une seule fois**
  (transition conditionnelle).
- Parents qui ont un compte : WhatsApp en plus de la notification et de
  l'e-mail, mais **pas** de SMS de secours (ils ont déjà deux canaux).

## Conséquences

- Coût par message divisé par 5 à 10 ; remise et lecture enfin connues.
- Le secours SMS dépend du webhook : sans lui, seuls les refus immédiats
  basculent en SMS. La console affiche l'adresse et le jeton à déclarer.
- Un échec transitoire qui épuise toutes ses tentatives n'est pas rattrapé
  par SMS (la tâche est abandonnée par la file) : cas rare, visible dans
  l'historique (statut RETRYING).
- Les numéros et textes partent chez Meta (États-Unis) : à couvrir par la
  demande d'autorisation de transfert à l'APDP (art. 391 du Code du numérique).
