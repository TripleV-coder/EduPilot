import { beforeAll, describe, expect, it, vi } from "vitest";
import type { JWT } from "next-auth/jwt";
import type { UserRole } from "@prisma/client";
import owner from "./owner-db";
import { uniqueCode } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";

/**
 * Coût réel du contrôle de session (audit MS-01, clôture du lot 2) : nombre
 * d'instructions SQL émises par le callback `jwt` qu'exécute `auth()` à
 * chaque requête authentifiée (deux fois par requête API : middleware, puis
 * route). Un appel Prisma peut émettre plusieurs instructions : c'est le
 * nombre d'instructions réellement envoyées à PostgreSQL qui est compté. Le client Prisma de l'application est
 * remplacé par le même client (contexte RLS compris) qui journalise chaque
 * instruction envoyée à PostgreSQL.
 *
 * Mesuré le 2026-10-17 (enseignant, parent, direction) : requête courante =
 * 1 appel Prisma = 2 instructions SQL (le compte, puis son école) ; après un
 * changement de droits = 8 instructions de données + 4 délimiteurs de
 * transaction. Les plafonds sont ces valeurs mesurées : une hausse signale
 * une régression du chemin le plus fréquent de l'application.
 */
const sql = vi.hoisted(() => ({ statements: [] as string[] }));

vi.mock("@/lib/prisma", async () => {
    const { PrismaClient } = await import("@prisma/client");
    const { createScopedClient } = await import("@/lib/db/scoped-client");
    const base = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
    base.$on("query", (event) => sql.statements.push(event.query));
    const client = createScopedClient(base);
    return { default: client, prisma: client };
});

const { authConfig } = await import("@/lib/auth/config");
const jwt = (token: JWT) => authConfig.callbacks!.jwt!({ token } as never) as Promise<JWT>;

let A: TenantGraph;
let B: TenantGraph;
const token = (userId: string, role: UserRole, school: string): JWT =>
    ({ id: userId, role, schoolId: school, primarySchoolId: school, accessibleSchoolIds: [school], iat: Math.floor(Date.now() / 1000) }) as JWT;

/** Instructions SQL émises par une requête (hors BEGIN/COMMIT éventuels). */
async function measure(run: () => Promise<unknown>) {
    sql.statements.length = 0;
    await run();
    const all = [...sql.statements];
    return { total: all.length, data: all.filter((q) => !/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(q.trim())).length };
}
async function averageMs(run: () => Promise<unknown>, n = 200) {
    const start = performance.now();
    for (let i = 0; i < n; i++) await run();
    return (performance.now() - start) / n;
}

beforeAll(async () => {
    [A, B] = await Promise.all([seedTenantGraph("COST-A"), seedTenantGraph("COST-B")]);
    await owner.teacherSchoolAssignment.createMany({
        data: [
            { teacherId: A.ids.teacher, userId: A.teacherUserId, schoolId: A.schoolId, status: "ACTIVE", isPrimary: true },
            { teacherId: A.ids.teacher, userId: A.teacherUserId, schoolId: B.schoolId, status: "ACTIVE", isPrimary: false },
        ],
    });
});

describe("Coût du contrôle de session par requête", () => {
    it("enseignant multi-écoles : requête courante = 2 instructions SQL (1 appel Prisma) ; recalcul seulement après un changement", async () => {
        const t = token(A.teacherUserId, "TEACHER", A.schoolId);
        const cold = await measure(() => jwt({ ...t }));
        const warm = await measure(() => jwt({ ...t }));
        expect(warm.data).toBeGreaterThan(0); // le compte est bien relu à chaque requête

        await owner.teacherSchoolAssignment.update({
            where: { teacherId_schoolId: { teacherId: A.ids.teacher, schoolId: B.schoolId } },
            data: { status: "INACTIVE" },
        });
        const afterChange = await measure(() => jwt({ ...t }));
        const warmAgain = await measure(() => jwt({ ...t }));

        const warmMs = await averageMs(() => jwt({ ...t }));
        process.stdout.write(`\n[cout-session] ${JSON.stringify({ role: "TEACHER", cold, warm, afterChange, warmAgain, warmMs: Number(warmMs.toFixed(2)) })}\n`);

        expect(warm.data).toBeLessThanOrEqual(2);
        expect(warmAgain.data).toBe(warm.data);
        expect(cold.data).toBeGreaterThan(warm.data);
        expect(afterChange.data).toBe(cold.data);
    });

    it("parent et direction : même schéma (2 instructions SQL par requête courante)", async () => {
        const director = await owner.user.create({
            data: { email: `${uniqueCode("cost-dir")}@integration.test`, password: "x", firstName: "Dir", lastName: "Cost", role: "DIRECTOR", schoolId: A.schoolId },
        });
        const parent = await owner.parentProfile.findFirstOrThrow({
            where: { parentStudents: { some: { studentId: A.ids.student } } },
            select: { userId: true },
        });
        for (const [label, t] of [
            ["PARENT", token(parent.userId, "PARENT", A.schoolId)],
            ["DIRECTOR", token(director.id, "DIRECTOR", A.schoolId)],
        ] as const) {
            const cold = await measure(() => jwt({ ...t }));
            const warm = await measure(() => jwt({ ...t }));
            process.stdout.write(`\n[cout-session] ${JSON.stringify({ role: label, cold, warm })}\n`);
            expect(cold.data, label).toBeGreaterThan(warm.data);
            expect(warm.data, label).toBeLessThanOrEqual(2);
        }
    });
});
