# API EduPilot — conventions

> **La liste des routes n'est plus tenue à la main.** Elle est produite depuis
> le code : [`docs/openapi.json`](openapi.json), régénérée par
> `npm run docs:openapi` et servie par `GET /api/docs` (page lisible :
> `/api/docs/swagger-ui`). Elle couvre **287 chemins et 463 opérations**, avec
> pour chacun la session, les rôles et les permissions réellement appliqués par
> `createApiHandler`, et les corps de requête convertis depuis les schémas Zod.
>
> Ce fichier ne décrit plus que ce qu'une spécification exprime mal : les
> conventions communes à toutes les routes. Il était auparavant une liste
> manuelle de 33 routes sur 288, périmée (audit M9).

---

## Authentification

Session **next-auth**, portée par un cookie. Il n'y a ni jeton Bearer ni clé
d'API pour les routes applicatives ; seules les tâches planifiées présentent un
secret (voir plus bas).

- Les comptes à second facteur doivent l'avoir validé : une session
  pré-2FA reçoit **403 `MFA_REQUIRED`**, y compris sur les routes d'API.
- Un compte dont le mot de passe est provisoire est renvoyé vers le changement
  de mot de passe avant tout accès.
- Les routes publiques sont déclarées dans `proxy.ts`. Trois le sont par
  chemin **exact** — `/api/health`, `/api/system/automation`,
  `/api/system/retention` — pour que `/api/health/vaccinations`, par exemple,
  reste protégée. Les autres le sont par préfixe : `/api/auth`, `/api/setup`,
  `/api/explorer`, `/api/docs`, `/api/public`, et les webhooks de paiement
  (`/api/payments/webhook`, `…/fedapay/webhook`, `…/momo/webhook`), dont la
  signature est vérifiée par la route elle-même. Tout le reste exige une
  session.
- Les deux routes de tâches planifiées sont publiques au middleware mais
  exigent `Authorization: Bearer <CRON_SECRET>`, comparé en temps constant.

## Isolation entre établissements

Chaque route lit l'établissement de l'appelant depuis sa session, jamais depuis
un paramètre de la requête. Une ressource d'un autre établissement répond
**404**, pas 403 : l'existence n'est pas révélée. Le paramètre `?schoolId=`
d'un autre établissement répond **403**.

Les tables sensibles sont en outre protégées par la **RLS PostgreSQL**
(`FORCE ROW LEVEL SECURITY`), avec un rôle applicatif non propriétaire : une
requête qui échapperait au filtre applicatif ne verrait rien.

## Pagination — un seul format

Toutes les listes répondent :

```json
{
  "data": [ … ],
  "pagination": {
    "limit": 20,
    "hasNextPage": true,
    "nextCursor": "eyJ2IjoiMjAyNi0wOS0xOFQxMDowMDowMC4wMDBaIiwiaWQiOiJjOSJ9",
    "total": 137
  }
}
```

- `?limit=` fixe la taille, plafonnée par chaque route.
- `?cursor=` demande la suite : repasser la valeur de `nextCursor`.
- `total` n'est présent que sur la **première page** (un `count()` sur une
  grande table coûte cher, et ne sert qu'une fois).
- `nextCursor` est **opaque** : ne rien en déduire, il peut porter une valeur
  de tri ou une position selon la route.
- **`?page=` n'existe plus** (retiré au Lot 8). Il est ignoré sans erreur : un
  client resté en arrière reçoit la première page.
- Un curseur illisible répond **400 `INVALID_CURSOR`**.

## Corps de requête

`application/json`. Plafond de **1 Mo** par défaut (5 Mo sur les routes de
téléversement), au-delà : **413 `PAYLOAD_TOO_LARGE`**.

- JSON illisible → **400 `INVALID_JSON`** ;
- corps refusé par le schéma Zod → **400 `VALIDATION_ERROR`**, avec le détail
  par champ dans `details`.

## Limites de débit

Par adresse de client, établie par le serveur — jamais par un en-tête fourni
par le client (`X-Forwarded-For` n'est lu que si un proxy de confiance est
déclaré par `TRUSTED_PROXY_HOPS`).

| Famille | Limite |
|---|---|
| API générale | 100 requêtes / minute |
| Opérations sensibles (paiements, notes, comptes) | 20 / minute |
| Téléversement | 10 / minute |
| Authentification (mot de passe oublié, vérification) | 5 / 15 minutes |
| **Échecs** de connexion | 10 / 15 minutes |
| Vérification du second facteur | 5 / 10 minutes |

Une connexion réussie **rend** l'unité consommée : seuls les échecs comptent,
pour qu'une école derrière une seule adresse publique ne se bloque pas
elle-même.

Au dépassement : **429 `TOO_MANY_REQUESTS`**, avec `Retry-After` en secondes.
Le middleware ajoute `X-RateLimit-Remaining` aux réponses qu'il laisse passer.

## Forme des erreurs

```json
{ "error": "Message en français, destiné à la personne", "code": "CODE_STABLE", "details": { … } }
```

`error` peut changer de formulation ; **`code` est le contrat**.

| Code | Statut | Sens |
|---|---|---|
| `INVALID_JSON` | 400 | Corps illisible |
| `VALIDATION_ERROR` | 400 | Refusé par le schéma Zod (`details` par champ) |
| `INVALID_REFERENCE` | 400 | Référence vers un enregistrement inexistant |
| `RELATION_VIOLATION` | 400 | Contrainte relationnelle |
| `INVALID_CURSOR` | 400 | Curseur de pagination illisible |
| `NO_SCHOOL` | 403 | Compte sans établissement |
| `MFA_REQUIRED` | 403 | Second facteur non validé |
| `MODULE_DISABLED` | 403 | Module désactivé par l'établissement |
| `NOT_FOUND` | 404 | Inexistant, ou hors de l'établissement |
| `DUPLICATE` | 409 | Un enregistrement identique existe déjà |
| `PAYLOAD_TOO_LARGE` | 413 | Corps au-delà du plafond |
| `TOO_MANY_REQUESTS` | 429 | Limite de débit atteinte |
| `MAINTENANCE` | 503 | Mode maintenance (`Retry-After: 120`) |
| `INTERNAL_ERROR` | 500 | Erreur interne ; le détail va au journal, pas à la réponse |

## Identifiant de requête

Chaque réponse porte `x-request-id`, repris dans **chaque ligne de journal** de
la requête. C'est ce qu'il faut communiquer pour faire retrouver une trace.

## Traçabilité

Les consultations et modifications de données sensibles — notes, santé,
paiements, rôles — sont écrites dans `AuditLog`. Aucune donnée personnelle en
clair ne va dans les journaux applicatifs.
