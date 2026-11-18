import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { Session } from "next-auth";
import prisma from "./owner-db";
import { actAs, createSchool, sessionFor, uniqueCode } from "./helpers";
import { GET as openStream } from "@/app/api/notifications/stream/route";

/**
 * Audit MS-01, F2 — un flux SSE de notifications déjà ouvert continuait à
 * livrer les notifications d'un compte désactivé (ou dont le mot de passe
 * avait été changé pour expulser une session volée). Vraie route, vraie base,
 * vrai intervalle de vérification (5 s) : le flux doit se fermer à la
 * vérification suivante et ne plus rien transmettre.
 */
const CHECK_WAIT_MS = 6_500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let schoolId: string;

async function account() {
    const user = await prisma.user.create({
        data: { email: `${uniqueCode("flux")}@integration.test`, password: "x", firstName: "Flux", lastName: "Notifications", role: "TEACHER", schoolId },
    });
    return user.id;
}

/** Ouvre le flux comme le ferait le navigateur et accumule tout ce qui arrive. */
async function open(userId: string) {
    const session: Session = sessionFor("TEACHER", schoolId, userId);
    actAs(session);
    const abort = new AbortController();
    const res = await openStream(new NextRequest(new URL("/api/notifications/stream", "http://localhost:3000"), { signal: abort.signal }), { params: Promise.resolve({}) });
    const state = { status: res.status, text: "", ended: false };
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const done = (async () => {
        for (;;) {
            const { value, done: finished } = await reader.read();
            if (finished) break;
            state.text += decoder.decode(value);
        }
        state.ended = true;
    })().catch(() => { state.ended = true; });
    return { state, abort, reader, done };
}
const notify = (userId: string, title: string) =>
    prisma.notification.create({ data: { userId, type: "INFO", title, message: "Contenu privé" } });

beforeAll(async () => {
    schoolId = (await createSchool("FLUX")).id;
});

describe("Flux de notifications : révocation pendant une connexion ouverte", () => {
    it("compte toujours autorisé : reçoit ses notifications, le flux reste ouvert", async () => {
        const userId = await account();
        const s = await open(userId);
        expect(s.state.status).toBe(200);
        await notify(userId, "NOTIF-AUTORISE");
        await sleep(CHECK_WAIT_MS);
        expect(s.state.text).toContain("NOTIF-AUTORISE");
        expect(s.state.ended).toBe(false);
        s.abort.abort();
        await s.reader.cancel().catch(() => {});
    }, 20_000);

    it("compte désactivé : flux fermé à la vérification suivante, plus aucune notification", async () => {
        const userId = await account();
        const s = await open(userId);
        await sleep(500);
        await prisma.user.update({ where: { id: userId }, data: { isActive: false } });
        await notify(userId, "NOTIF-APRES-DESACTIVATION");
        await sleep(CHECK_WAIT_MS);
        expect(s.state.ended).toBe(true);
        expect(s.state.text).toContain("session-ended");
        expect(s.state.text).not.toContain("NOTIF-APRES-DESACTIVATION");
    }, 20_000);

    it("mot de passe changé après l'ouverture : flux fermé, notification non livrée", async () => {
        const userId = await account();
        const s = await open(userId);
        await sleep(500);
        await prisma.user.update({ where: { id: userId }, data: { passwordChangedAt: new Date() } });
        await notify(userId, "NOTIF-APRES-MOT-DE-PASSE");
        await sleep(CHECK_WAIT_MS);
        expect(s.state.ended).toBe(true);
        expect(s.state.text).not.toContain("NOTIF-APRES-MOT-DE-PASSE");
    }, 20_000);

    it("compte supprimé définitivement : flux fermé", async () => {
        const userId = await account();
        const s = await open(userId);
        await sleep(500);
        await prisma.user.delete({ where: { id: userId } });
        await sleep(CHECK_WAIT_MS);
        expect(s.state.ended).toBe(true);
        expect(s.state.text).toContain("session-ended");
    }, 20_000);

    it("établissement suspendu : flux fermé", async () => {
        const suspended = (await createSchool("FLUX-SUSP")).id;
        const user = await prisma.user.create({
            data: { email: `${uniqueCode("flux-susp")}@integration.test`, password: "x", firstName: "Flux", lastName: "Suspendu", role: "TEACHER", schoolId: suspended },
        });
        const s = await open(user.id);
        await sleep(500);
        await prisma.school.update({ where: { id: suspended }, data: { isActive: false } });
        await notify(user.id, "NOTIF-ECOLE-SUSPENDUE");
        await sleep(CHECK_WAIT_MS);
        expect(s.state.ended).toBe(true);
        expect(s.state.text).not.toContain("NOTIF-ECOLE-SUSPENDUE");
    }, 20_000);
});
