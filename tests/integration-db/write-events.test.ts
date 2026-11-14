import { afterEach, describe, expect, it } from "vitest";
import prisma from "@/lib/prisma";
import { runAsSystem } from "@/lib/db/db-context";
import { onModelWrite } from "@/lib/db/write-events";
import { createSchool } from "./helpers";

/**
 * Le client Prisma de l'application signale chaque écriture réussie (base
 * réelle) : c'est ce signal qui invalide les moyennes de classe partagées.
 */
let unsubscribe: (() => void) | null = null;
afterEach(() => {
    unsubscribe?.();
    unsubscribe = null;
});

describe("signal d'écriture du client Prisma", () => {
    it("écriture isolée, écriture dans une transaction ; pas de signal pour une lecture", async () => {
        const seen: string[] = [];
        const school = await createSchool("IT-WRITE-EVENTS");
        unsubscribe = onModelWrite((model) => seen.push(model));

        await runAsSystem("test:write-events", async () => {
            await prisma.academicYear.findMany({ where: { schoolId: school.id } });
            expect(seen).toEqual([]);

            await prisma.academicConfig.upsert({
                where: { schoolId: school.id },
                create: { schoolId: school.id },
                update: {},
            });
            await prisma.$transaction(async (tx) => {
                await tx.configOption.create({
                    data: { schoolId: school.id, category: "it-write-events", code: "x", label: "x" },
                });
            });
        });

        expect(seen).toEqual(["AcademicConfig", "ConfigOption"]);
    });
});
