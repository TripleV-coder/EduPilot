import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildOpenApiDocument, readRoutes, apiPathOf } from "../../scripts/docs/build-openapi";

/**
 * Lot 8 — la spécification OpenAPI est **générée depuis le code** et versionnée
 * dans `docs/openapi.json` (servie par `/api/docs`). Elle remplace l'ancien
 * `src/lib/swagger.ts`, écrit à la main, qui décrivait 4 chemins sur 288 et
 * documentait encore le paramètre `?page=` retiré au Lot 8.
 *
 * Ce test est le garde-fou : il échoue dès qu'une route est ajoutée, retirée,
 * change de méthode ou de garanties d'accès sans `npm run docs:openapi`.
 */
const ROOT = path.resolve(__dirname, "../..");
const versioned = JSON.parse(readFileSync(path.join(ROOT, "docs/openapi.json"), "utf8"));
const version = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8")).version as string;

describe("OpenAPI — générée depuis le code", () => {
    it("docs/openapi.json correspond exactement au code (sinon : npm run docs:openapi)", async () => {
        const rebuilt = await buildOpenApiDocument(version);
        expect(rebuilt).toEqual(versioned);
    });

    it("décrit toutes les routes de src/app/api, pas un échantillon", () => {
        const routes = readRoutes();
        const missing = routes
            .map((route) => route.apiPath)
            .filter((apiPath) => !(apiPath in versioned.paths));

        expect(missing).toEqual([]);
        expect(Object.keys(versioned.paths).length).toBeGreaterThan(250);
    });

    it("traduit les segments dynamiques du routeur en paramètres OpenAPI", () => {
        expect(apiPathOf(path.join(ROOT, "src/app/api/classes/[id]/route.ts"))).toBe("/api/classes/{id}");
        expect(apiPathOf(path.join(ROOT, "src/app/api/auth/[...nextauth]/route.ts"))).toBe("/api/auth/{nextauth}");
    });

    it("décrit les corps de requête par les schémas Zod, pas par du JSON Schema écrit à la main", () => {
        const classCreate = versioned.paths["/api/classes"].post;
        expect(classCreate.requestBody.content["application/json"].schema.$ref).toBe(
            "#/components/schemas/classSchema",
        );
        // Le schéma vient de z.toJSONSchema : il porte les champs réellement validés.
        expect(Object.keys(versioned.components.schemas.classSchema.properties)).toContain("name");
    });

    it("dit la vérité sur les garanties d'accès, lues dans createApiHandler", () => {
        expect(versioned.paths["/api/classes"].post.description).toContain("CLASS_CREATE");
        expect(versioned.paths["/api/classes"].post.security).toEqual([{ sessionCookie: [] }]);
        // Route publique : pas de session exigée, et aucune réponse 401 annoncée.
        expect(versioned.paths["/api/health"].get.security).toEqual([]);
        expect(versioned.paths["/api/health"].get.responses["401"]).toBeUndefined();
    });

    it("ne documente plus le paramètre ?page=, retiré au Lot 8", () => {
        const texte = JSON.stringify(versioned);
        expect(texte).not.toContain('"name": "page"');
        expect(versioned.components.schemas.CursorPagination.properties.nextCursor).toBeDefined();
    });
});
