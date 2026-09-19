import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import openApiDocument from "../../../../docs/openapi.json";

/**
 * Spécification OpenAPI de l'API, **générée depuis le code** :
 * `npm run docs:openapi` (chemins et méthodes lus dans `src/app/api`, garanties
 * d'accès lues dans les options de `createApiHandler`, corps de requête
 * convertis depuis les schémas Zod). Ne pas éditer `docs/openapi.json` à la main :
 * `tests/lib/openapi.test.ts` échoue dès qu'elle ne correspond plus au code.
 */
export const GET = createApiHandler(
    async () => NextResponse.json(openApiDocument),
    { requireAuth: false },
);
