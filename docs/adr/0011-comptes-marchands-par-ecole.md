# ADR-0011 : Comptes marchands indépendants par école (S7)

**Statut** : Proposé (2026-10-18, en attente de revue humaine)
**Remplace** : la configuration globale des fournisseurs de l'[ADR-0010 (mobile money)](0010-mobile-money-providers.md) pour les paiements des écoles

## Contexte

Tous les identifiants des fournisseurs de paiement étaient des variables d'environnement globales (`FEDAPAY_SECRET_KEY`, `MOMO_API_KEY`, `PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY` et leurs secrets de webhook) : un seul compte marchand pour toute la plateforme. Les fonds de toutes les écoles arrivaient donc sur le même compte, contrairement à la règle de souveraineté : **chaque école possède et contrôle son propre compte marchand ; aucun compte global EduPilot ne sert de solution de repli.**

Constats vérifiés pendant l'audit :
- FedaPay est l'intégration principale (SDK officiel `fedapay` 1.2.5, github.com/fedapay/fedapay-node).
- Le SDK configure clé, environnement et compte par **état global du processus** (`FedaPay.setApiKey`, lu à chaque requête par `Requestor.defaultHeaders`). Avec une clé par école, deux requêtes simultanées pourraient s'écraser : un paiement de l'école A créé avec la clé de B. Le SDK est donc inutilisable tel quel pour plusieurs comptes.
- Documentation officielle FedaPay (docs.fedapay.com, consultée le 2026-10-18) : chaque marchand a son propre compte et ses clés ; clés de test et de production distinctes ; webhooks signés (en-tête `X-FEDAPAY-SIGNATURE`, avec horodatage), secret **unique par point de terminaison** et différent entre test et production ; événements `transaction.approved`, `transaction.declined`, `transaction.canceled`, `transaction.transferred`… ; API `POST /transactions`, `POST /transactions/{id}/token`, `GET /transactions/{id}` (champ `merchant_reference`) ; **remboursements uniquement depuis le tableau de bord FedaPay, et seulement vers MTN Mobile Money — aucune API de remboursement documentée**.
- Points non documentés publiquement, établis par le code du SDK officiel : URL de base (`https://sandbox-api.fedapay.com`, `https://api.fedapay.com`, préfixe `/v1`), authentification `Authorization: Bearer <clé secrète>`, signature = HMAC-SHA256 de `"<t>.<corps brut>"`, en-tête `t=<horodatage>,s=<signature>`, tolérance 300 s ; enveloppe de réponse `v1/transaction`.
- Le compte « Marketplace » FedaPay (sous-comptes, répartition des paiements) n'est **pas** retenu : la documentation ne précise ni la propriété des fonds ni les modalités de versement ; il ne garantit donc pas la souveraineté demandée.

## Décision

### 1. Un compte FedaPay direct par école

Modèle `SchoolPaymentAccount` : une ligne = une école, un fournisseur (`FEDAPAY`), un environnement (`SANDBOX` ou `LIVE`), un statut (`INACTIVE` → `ACTIVE` → `REVOKED`). Au plus **un compte actif** par école, fournisseur et environnement (index unique partiel en base). Les lignes ne sont jamais réattribuées à une autre école (garde-fou en base sur `schoolId`).

### 2. Secrets chiffrés, liés à leur école

- Clé secrète API et secret de webhook chiffrés en AES-256-GCM, stockés séparément.
- Clé maîtresse dans l'environnement : `PAYMENT_SECRETS_KEY` (64 caractères hexadécimaux), **distincte** de `TOTP_ENCRYPTION_KEY`, avec un numéro de version (`PAYMENT_SECRETS_KEY_VERSION`) ; les clés précédentes restent lisibles via `PAYMENT_SECRETS_PREVIOUS_KEYS` pendant une rotation.
- Données associées (AAD) = école + compte + champ : un chiffré recopié d'une école ou d'un compte à l'autre ne se déchiffre pas.
- Clé maîtresse absente ou invalide : aucune configuration ne peut être enregistrée et aucun paiement en ligne ne part (jamais de stockage en clair).
- Les API ne renvoient que l'état, l'environnement, le fournisseur et les 4 derniers caractères de la clé ; jamais les secrets, ni dans les journaux.

### 3. Client FedaPay par requête

Client HTTP propre (`fetch`) qui envoie l'en-tête `Authorization` du compte **à chaque appel**, sans état global. La vérification de signature reprend l'algorithme du SDK officiel, avec le secret du compte passé en paramètre (aucun état global).

### 4. Paiement lié à son compte, de façon immuable

`Payment.paymentAccountId` : renseigné à l'initiation avec le compte actif de l'**école du frais** (jamais une valeur envoyée par le navigateur). Garde-fous en base : le compte doit appartenir à l'école du frais ; une fois posé, le lien ne change plus. Les paiements historiques gardent `paymentAccountId` vide : ils ne sont ni réattribués ni falsifiés.

### 5. Webhooks par compte

Chaque école déclare dans **son** tableau de bord FedaPay l'adresse `/api/payments/fedapay/webhook/<identifiant du compte>` et en recopie le secret. La route vérifie la signature avec le secret de ce compte, puis ne valide que les paiements liés à ce compte : un événement de l'école A ne peut pas écrire sur un paiement de l'école B (refus sans modification, alerte). Montant, devise, identifiant de transaction et référence restent contrôlés (S3). L'ancienne route globale ne valide plus que les paiements **historiques** sans compte.

### 6. Pas de repli global

- École sans compte FedaPay actif et valide : paiement en ligne indisponible pour cette école (503 `ONLINE_PAYMENT_UNAVAILABLE`), message « payez à l'économat », aucune écriture.
- MoMo direct, Flutterwave et Paystack n'existent qu'en configuration globale : ils ne servent plus à initier un paiement d'école (même refus) jusqu'à une prise en charge par école.
- Un compte `LIVE` n'est utilisable que si `PAYMENTS_LIVE_ENABLED=true` (garde-fou existant).

### 7. Rotation et révocation

Nouvelle clé = nouveau compte `INACTIVE`, testé (appel en lecture chez FedaPay), puis activé : l'ancien compte actif du même environnement passe `REVOKED` dans la même transaction. Les paiements déjà liés à l'ancien compte restent rapprochables avec ses secrets (lecture seule). Toutes les actions sont journalisées (sans secret).

### 8. Remboursements

Aucun remboursement automatique : FedaPay ne documente pas d'API de remboursement. L'école rembourse depuis son propre tableau de bord FedaPay ; EduPilot n'implémente aucun transfert entre écoles.

## Conséquences

- (+) Fonds versés directement au compte de chaque école ; une panne ou une clé expirée chez l'école A n'affecte pas B.
- (+) Isolation vérifiable en base : lien paiement → compte → école contrôlé par des garde-fous.
- (−) Chaque école doit ouvrir un compte FedaPay, configurer son webhook et saisir ses clés.
- (−) MoMo direct, Flutterwave et Paystack sont indisponibles pour les écoles tant qu'ils ne sont pas pris en charge par école.
- (−) Le rapprochement des paiements historiques (sans compte) reste lié à l'ancienne configuration globale.

## Migration depuis la configuration globale

1. Déployer la migration (tables et colonnes nouvelles, aucune donnée modifiée).
2. Définir `PAYMENT_SECRETS_KEY`.
3. Chaque école crée son compte FedaPay, déclare l'adresse de webhook de son compte, saisit ses clés, teste puis active.
4. Les variables globales FedaPay ne servent plus qu'aux paiements historiques ; les retirer une fois ceux-ci soldés.
