/**
 * Construit la spécification OpenAPI d'EduPilot à partir du code lui-même :
 *
 *  - les chemins et les méthodes viennent des fichiers `src/app/api/**\/route.ts` ;
 *  - l'authentification, les rôles et les permissions viennent des options
 *    passées à `createApiHandler` dans chaque route ;
 *  - les corps de requête viennent des schémas **Zod** de `src/lib/validations`,
 *    convertis par `z.toJSONSchema` — jamais réécrits à la main ;
 *  - les réponses communes (400, 401, 403, 413, 429, 503…) viennent des
 *    comportements réellement implémentés par `createApiHandler`.
 *
 * `scripts/docs/generate-openapi.ts` écrit le résultat dans `docs/openapi.json`,
 * et `tests/lib/openapi.test.ts` échoue dès qu'une route est ajoutée, retirée ou
 * change de méthode sans régénération.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const ROOT = path.resolve(__dirname, "../..");
const API_DIR = path.join(ROOT, "src/app/api");
const VALIDATIONS_DIR = path.join(ROOT, "src/lib/validations");

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

export interface Operation {
    method: HttpMethod;
    /** Schéma Zod du corps, s'il est validé par la route. */
    bodySchema?: string;
    requireAuth: boolean;
    allowedRoles?: string[];
    requiredPermissions?: string[];
    /** Route non enveloppée par createApiHandler : garanties non lisibles statiquement. */
    rawHandler: boolean;
}

export interface RouteEntry {
    /** Chemin OpenAPI : `/api/classes/{id}`. */
    apiPath: string;
    /** Chemin du fichier, relatif à la racine. */
    file: string;
    operations: Operation[];
}

// ─── Lecture des routes ───────────────────────────────────────────────────────

function routeFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) return routeFiles(full);
        return entry === "route.ts" ? [full] : [];
    });
}

/** `src/app/api/classes/[id]/route.ts` → `/api/classes/{id}`. */
export function apiPathOf(file: string): string {
    const rel = path.relative(API_DIR, path.dirname(file));
    const segments = rel === "" ? [] : rel.split(path.sep);
    const mapped = segments.map((segment) => {
        const dynamic = segment.match(/^\[\.\.\.(.+)\]$/);
        if (dynamic) return `{${dynamic[1]}}`;
        const param = segment.match(/^\[(.+)\]$/);
        if (param) return `{${param[1]}}`;
        return segment;
    });
    return `/api/${mapped.join("/")}`.replace(/\/$/, "") || "/api";
}

/** Extrait le bloc d'options de `createApiHandler(handler, { … })` pour une méthode. */
function optionsBlockFor(source: string, method: string): string | null {
    const start = source.search(
        new RegExp(`export\\s+(const\\s+${method}\\s*=|async\\s+function\\s+${method}\\b)`, "i"),
    );
    if (start === -1) return null;
    // Fin de l'export : prochain `export` de plus haut niveau, ou fin de fichier.
    const nextExport = source.slice(start + 1).search(/\nexport\s+(const|async function)\s/);
    const block = nextExport === -1 ? source.slice(start) : source.slice(start, start + 1 + nextExport);
    return block;
}

function parseOperation(source: string, method: HttpMethod): Operation | null {
    const upper = method.toUpperCase();
    const block = optionsBlockFor(source, upper);
    if (block === null) return null;

    const rawHandler = !/createApiHandler\s*\(/.test(block);

    const roles = block.match(/allowedRoles:\s*(\[[^\]]*\]|[A-Z_a-z]+)/);
    const permissions = block.match(/requiredPermissions:\s*\[([^\]]*)\]/);
    const body = block.match(/(\w*[Ss]chema)\s*\.\s*(safeParse|parse)\s*\(/);

    return {
        method,
        rawHandler,
        requireAuth: rawHandler ? false : !/requireAuth:\s*false/.test(block),
        allowedRoles: roles
            ? roles[1]
                  .replace(/[[\]]/g, "")
                  .split(",")
                  .map((role) => role.trim().replace(/["']/g, ""))
                  .filter(Boolean)
            : undefined,
        requiredPermissions: permissions
            ? permissions[1]
                  .split(",")
                  .map((permission) => permission.trim().replace(/^Permission\./, ""))
                  .filter(Boolean)
            : undefined,
        bodySchema: body ? body[1] : undefined,
    };
}

export function readRoutes(): RouteEntry[] {
    return routeFiles(API_DIR)
        .sort()
        .map((file) => {
            const source = readFileSync(file, "utf8");
            const operations = HTTP_METHODS.map((method) => parseOperation(source, method)).filter(
                (operation): operation is Operation => operation !== null,
            );
            return { apiPath: apiPathOf(file), file: path.relative(ROOT, file), operations };
        })
        .filter((route) => route.operations.length > 0);
}

// ─── Composants issus des schémas Zod ─────────────────────────────────────────

/** Convertit tous les schémas Zod exportés par `src/lib/validations`. */
export async function zodComponents(): Promise<Record<string, unknown>> {
    const components: Record<string, unknown> = {};
    for (const file of readdirSync(VALIDATIONS_DIR).filter((f) => f.endsWith(".ts")).sort()) {
        const moduleExports: Record<string, unknown> = await import(
            path.join(VALIDATIONS_DIR, file)
        );
        for (const [name, value] of Object.entries(moduleExports)) {
            if (!(value instanceof z.ZodType)) continue;
            try {
                components[name] = z.toJSONSchema(value, { io: "input", unrepresentable: "any" });
            } catch {
                // Un schéma non représentable en JSON Schema (transformations, effets)
                // est décrit comme objet libre plutôt que d'être omis en silence.
                components[name] = { type: "object", description: `Schéma Zod « ${name} » non représentable en JSON Schema.` };
            }
        }
    }
    return components;
}

// ─── Document ─────────────────────────────────────────────────────────────────

const COMMON_RESPONSES = {
    BadRequest: {
        description: "Requête invalide : JSON illisible (`INVALID_JSON`) ou corps refusé par le schéma Zod (`VALIDATION_ERROR`, avec le détail par champ).",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
    },
    Unauthorized: {
        description: "Session absente ou expirée, ou second facteur non validé.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
    },
    Forbidden: {
        description: "Rôle ou permission insuffisante, ou ressource d'un autre établissement.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
    },
    NotFound: {
        description: "Ressource inexistante, ou hors de l'établissement de l'appelant (l'existence n'est pas révélée).",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
    },
    PayloadTooLarge: {
        description: "Corps au-delà de la taille maximale de la route (1 Mo par défaut).",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
    },
    TooManyRequests: {
        description: "Limite de débit atteinte. En-tête `Retry-After` en secondes.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
    },
    ServiceUnavailable: {
        description: "Mode maintenance, ou dépendance indisponible.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
    },
} as const;

const BASE_SCHEMAS = {
    ApiError: {
        type: "object",
        required: ["error"],
        properties: {
            error: { type: "string", description: "Message destiné à la personne, en français." },
            code: { type: "string", description: "Code stable, lisible par un programme." },
            details: { type: "object", additionalProperties: true, description: "Détail par champ pour une erreur de validation." },
        },
    },
    CursorPagination: {
        type: "object",
        description:
            "Format de pagination unique du projet (Lot 3/Lot 8). `?page=` n'existe plus : la page suivante se demande avec `?cursor=`.",
        required: ["limit", "hasNextPage", "nextCursor"],
        properties: {
            limit: { type: "integer", description: "Taille de page demandée, plafonnée par la route." },
            hasNextPage: { type: "boolean" },
            nextCursor: { type: ["string", "null"], description: "À repasser en `?cursor=` pour la page suivante." },
            total: { type: "integer", description: "Présent sur la première page seulement." },
        },
    },
} as const;

function operationObject(route: RouteEntry, operation: Operation, componentNames: Set<string>) {
    const responses: Record<string, unknown> = {
        "200": { description: "Succès." },
        "400": { $ref: "#/components/responses/BadRequest" },
        "429": { $ref: "#/components/responses/TooManyRequests" },
        "503": { $ref: "#/components/responses/ServiceUnavailable" },
    };
    if (operation.requireAuth) responses["401"] = { $ref: "#/components/responses/Unauthorized" };
    if (operation.allowedRoles || operation.requiredPermissions) {
        responses["403"] = { $ref: "#/components/responses/Forbidden" };
    }
    if (route.apiPath.includes("{")) responses["404"] = { $ref: "#/components/responses/NotFound" };
    if (operation.bodySchema) responses["413"] = { $ref: "#/components/responses/PayloadTooLarge" };

    const garanties: string[] = [];
    if (operation.rawHandler) {
        garanties.push(
            "Route sans `createApiHandler` : ses garanties ne sont pas lisibles dans les options et doivent être vérifiées dans le code.",
        );
    } else {
        garanties.push(operation.requireAuth ? "Session requise." : "Accessible sans session.");
        if (operation.allowedRoles?.length) garanties.push(`Rôles : ${operation.allowedRoles.join(", ")}.`);
        if (operation.requiredPermissions?.length) {
            garanties.push(`Permissions : ${operation.requiredPermissions.join(", ")}.`);
        }
    }

    const body =
        operation.bodySchema && componentNames.has(operation.bodySchema)
            ? {
                  required: true,
                  content: {
                      "application/json": {
                          schema: { $ref: `#/components/schemas/${operation.bodySchema}` },
                      },
                  },
              }
            : undefined;

    return {
        summary: `${operation.method.toUpperCase()} ${route.apiPath}`,
        description: garanties.join(" "),
        tags: [route.apiPath.split("/")[2] ?? "api"],
        ...(operation.requireAuth ? { security: [{ sessionCookie: [] }] } : { security: [] }),
        ...(body ? { requestBody: body } : {}),
        responses,
    };
}

export async function buildOpenApiDocument(version: string) {
    const routes = readRoutes();
    const schemas = { ...BASE_SCHEMAS, ...(await zodComponents()) };
    const componentNames = new Set(Object.keys(schemas));

    const paths: Record<string, Record<string, unknown>> = {};
    for (const route of routes) {
        paths[route.apiPath] ??= {};
        for (const operation of route.operations) {
            paths[route.apiPath][operation.method] = operationObject(route, operation, componentNames);
        }
        const params = [...route.apiPath.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
        if (params.length > 0) {
            paths[route.apiPath].parameters = params.map((name) => ({
                name,
                in: "path",
                required: true,
                schema: { type: "string" },
            }));
        }
    }

    return {
        openapi: "3.1.0",
        info: {
            title: "EduPilot API",
            version,
            description:
                "Spécification générée depuis le code : chemins et méthodes lus dans `src/app/api`, " +
                "garanties d'accès lues dans les options de `createApiHandler`, corps de requête " +
                "convertis depuis les schémas Zod de `src/lib/validations`. Ne pas modifier à la main : " +
                "lancer `npm run docs:openapi`.",
        },
        servers: [{ url: "/", description: "Instance de l'établissement" }],
        components: {
            securitySchemes: {
                sessionCookie: {
                    type: "apiKey",
                    in: "cookie",
                    name: "next-auth.session-token",
                    description: "Session next-auth. Les comptes à second facteur doivent l'avoir validé.",
                },
            },
            schemas,
            responses: COMMON_RESPONSES,
        },
        paths,
    };
}
