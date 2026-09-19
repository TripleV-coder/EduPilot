import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { navGroupsForRole } from "@/components/edu-shell/role-nav";
import { roleSatisfies } from "@/lib/rbac/permissions";

/**
 * Aucun lien de navigation ne mène à « Accès refusé » (constaté au balayage du
 * 2026-09-19 : « Ma classe » pour l'élève, l'Assistant IA pour le comptable,
 * quatre liens du personnel). On lit la garde `roles={[...]}` de la page cible.
 */
const ALIASES: Record<string, string> = {
    "/dashboard/ai-assistant": "/dashboard/ai",
    "/dashboard/schedules": "/dashboard/schedule",
    "/dashboard/cafeteria": "/dashboard/canteen",
    "/dashboard/health": "/dashboard/medical",
};
// Pages qui servent une vue dédiée AVANT leur garde (vérifié dans le code).
const OWN_VIEW_BEFORE_GUARD: Record<string, string[]> = { "/dashboard/finance": ["PARENT"] };

describe("navigation ↔ gardes de page", () => {
    it.each(["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF"])(
        "%s : chaque lien mène à une page qui l'admet",
        (role) => {
            const denied: string[] = [];
            for (const group of navGroupsForRole(role)) {
                for (const link of group.links) {
                    const href = ALIASES[link.href] ?? link.href;
                    const file = path.join(process.cwd(), "src/app/(dashboard)", href, "page.tsx");
                    expect(existsSync(file), `page absente : ${href}`).toBe(true);
                    const guard = readFileSync(file, "utf8").match(/roles=\{\[([^\]]*)\]\}/);
                    if (!guard || role === "SUPER_ADMIN" || OWN_VIEW_BEFORE_GUARD[href]?.includes(role)) continue;
                    const allowed = [...guard[1].matchAll(/"([A-Z_]+)"/g)].map((m) => m[1]);
                    if (!roleSatisfies(role, allowed)) denied.push(href);
                }
            }
            expect(denied).toEqual([]);
        },
    );
});
