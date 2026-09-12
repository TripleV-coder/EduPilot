import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * M6 — `.env.example` doit décrire exactement la configuration que le code
 * lit : l'audit comptait 18 variables lues non documentées et 2 documentées
 * jamais lues. Ce test échoue dès qu'une variable apparaît ou disparaît sans
 * mise à jour de la documentation.
 */
const ROOT = path.resolve(__dirname, "../../..");

/** Variables posées par Node/Next eux-mêmes : rien à configurer. */
const FRAMEWORK_VARIABLES = new Set(["NODE_ENV", "NEXT_PHASE", "NEXT_RUNTIME"]);

const READ_PATTERNS = [
    /process\.env\.([A-Z][A-Z0-9_]+)/g,
    /process\.env\[["']([A-Z][A-Z0-9_]+)["']\]/g,
    /getEnv\(["']([A-Z][A-Z0-9_]+)["']\)/g,
    /\benv\.([A-Z][A-Z0-9_]+)/g, // lib/security/client-ip.ts (environnement injectable)
];

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return /\.(ts|tsx|js|mjs|cjs)$/.test(entry) ? [full] : [];
    });
}

function variablesReadByCode(): Set<string> {
    const files = [
        ...sourceFiles(path.join(ROOT, "src")),
        ...["instrumentation.ts", "next.config.js", "sentry.server.config.ts", "sentry.edge.config.ts"]
            .map((f) => path.join(ROOT, f))
            .filter((f) => {
                try {
                    return statSync(f).isFile();
                } catch {
                    return false;
                }
            }),
    ];
    const names = new Set<string>();
    for (const file of files) {
        const content = readFileSync(file, "utf8");
        for (const pattern of READ_PATTERNS) {
            for (const match of content.matchAll(pattern)) names.add(match[1]);
        }
    }
    for (const name of FRAMEWORK_VARIABLES) names.delete(name);
    return names;
}

function variablesDocumented(): Set<string> {
    const content = readFileSync(path.join(ROOT, ".env.example"), "utf8");
    return new Set([...content.matchAll(/^#?\s*([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
}

describe(".env.example ↔ code", () => {
    const read = variablesReadByCode();
    const documented = variablesDocumented();

    it("documente toute variable lue par le code", () => {
        expect([...read].filter((name) => !documented.has(name)).sort()).toEqual([]);
    });

    it("ne documente aucune variable que le code ne lit pas", () => {
        expect([...documented].filter((name) => !read.has(name)).sort()).toEqual([]);
    });
});
