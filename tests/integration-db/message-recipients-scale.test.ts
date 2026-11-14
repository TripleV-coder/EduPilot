import { beforeAll, describe, expect, it } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { GET as listRecipients } from "@/app/api/messages/recipients/route";
import { POST as sendMessage } from "@/app/api/messages/route";

/**
 * Messagerie dans une école de taille réelle (2026-11-08) : l'autorisation
 * d'envoi relisait la liste affichée, plafonnée à 200 noms. Dans l'école de
 * démonstration (2 646 comptes), le directeur ne pouvait écrire qu'aux noms
 * de « A » à « Ahounou » : envoi à un parent nommé Zinsou refusé (403).
 */
let schoolId: string;
let otherSchoolId: string;
let directorId: string;
let lastParentId: string;
let foreignUserId: string;
const tag = uniqueCode("dest").replace(/[^a-z0-9]/gi, "");

beforeAll(async () => {
    schoolId = (await createSchool("DEST")).id;
    otherSchoolId = (await createSchool("DEST-AUTRE")).id;
    directorId = (
        await prisma.user.create({
            data: { email: `${uniqueCode("dir")}@integration.test`, password: "x", firstName: "Direction", lastName: "Aaa", role: "DIRECTOR", schoolId },
        })
    ).id;
    // 260 parents dont les noms se trient AVANT le dernier
    await prisma.user.createMany({
        data: Array.from({ length: 260 }, (_, i) => ({
            email: `${uniqueCode(`p${i}`)}@integration.test`,
            password: "x",
            firstName: "Parent",
            lastName: `A${String(i).padStart(3, "0")}`,
            role: "PARENT" as const,
            schoolId,
        })),
    });
    lastParentId = (
        await prisma.user.create({
            data: { email: `${uniqueCode("zinsou")}@integration.test`, password: "x", firstName: "Afiavi", lastName: `Zinsou${tag}`, role: "PARENT", schoolId },
        })
    ).id;
    foreignUserId = (
        await prisma.user.create({
            data: { email: `${uniqueCode("ailleurs")}@integration.test`, password: "x", firstName: "Parent", lastName: `Zinsou${tag}`, role: "PARENT", schoolId: otherSchoolId },
        })
    ).id;
});

const asDirector = () => actAs(sessionFor("DIRECTOR", schoolId, directorId));

describe("destinataires de la direction dans une grande école", () => {
    it("envoi au dernier nom de l'alphabet : accepté", async () => {
        asDirector();
        const sent = await callRoute(sendMessage, {
            method: "POST",
            path: "/api/messages",
            body: { recipientId: lastParentId, subject: "Rendez-vous", content: "Bonjour, pouvez-vous passer jeudi ?" },
        });
        expect(sent.status).toBe(201);
    });

    it("la recherche trouve la personne ; le total couvre toute l'école, la page reste bornée", async () => {
        asDirector();
        const all = await callRoute(listRecipients, { path: "/api/messages/recipients" });
        const body = all.body as { data: { id: string }[]; total: number };
        expect(body.total).toBe(261);
        expect(body.data).toHaveLength(50);

        const found = await callRoute(listRecipients, { path: `/api/messages/recipients?q=${encodeURIComponent(`afiavi zinsou${tag}`)}` });
        expect((found.body as { data: { id: string }[] }).data.map((p) => p.id)).toEqual([lastParentId]);
    });

    it("étanchéité : un homonyme d'une autre école n'est ni proposé ni joignable", async () => {
        asDirector();
        const found = await callRoute(listRecipients, { path: `/api/messages/recipients?q=Zinsou${tag}` });
        expect((found.body as { data: { id: string }[] }).data.map((p) => p.id)).not.toContain(foreignUserId);
        const sent = await callRoute(sendMessage, {
            method: "POST",
            path: "/api/messages",
            body: { recipientId: foreignUserId, subject: "Test", content: "Hors périmètre" },
        });
        expect(sent.status).toBe(403);
        expect(await prisma.message.count({ where: { senderId: directorId, recipientId: foreignUserId } })).toBe(0);
    });

    it("compte désactivé : ni proposé ni joignable", async () => {
        const inactive = await prisma.user.create({
            data: { email: `${uniqueCode("off")}@integration.test`, password: "x", firstName: "Ancien", lastName: `Parti${tag}`, role: "PARENT", schoolId, isActive: false },
        });
        asDirector();
        const found = await callRoute(listRecipients, { path: `/api/messages/recipients?q=Parti${tag}` });
        expect((found.body as { total: number }).total).toBe(0);
        const sent = await callRoute(sendMessage, {
            method: "POST",
            path: "/api/messages",
            body: { recipientId: inactive.id, subject: "Test", content: "Compte fermé" },
        });
        expect(sent.status).toBe(400);
    });
});
