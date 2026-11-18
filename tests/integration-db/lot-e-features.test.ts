import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import prisma from "./owner-db";
import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import { seedTenantGraph, type TenantGraph } from "./fixtures/tenant-graph";
import { ALL_MODULE_IDS } from "@/lib/modules/catalog";
import { PULSE_MIN_RESPONSES, pulseWeekOf } from "@/lib/wellbeing/pulse";
import { JOB_HANDLERS } from "@/lib/jobs/handlers";

import * as pulseRoute from "@/app/api/wellbeing/pulse/route";
import * as overviewRoute from "@/app/api/wellbeing/overview/route";
import * as appointmentsRoute from "@/app/api/wellbeing/appointments/route";
import * as appointmentRoute from "@/app/api/wellbeing/appointments/[id]/route";
import * as eventsRoute from "@/app/api/events/route";
import * as participateRoute from "@/app/api/events/[id]/participate/route";
import * as lineStudentsRoute from "@/app/api/transport/lines/[id]/students/route";
import * as externalRoute from "@/app/api/students/[id]/external-averages/route";
import * as walletOverviewRoute from "@/app/api/wallet/overview/route";
import * as walletAccountsRoute from "@/app/api/wallet/accounts/route";
import * as walletAccountRoute from "@/app/api/wallet/accounts/[id]/route";
import * as voiceRoute from "@/app/api/voice-notifs/route";
import * as whatsappRoute from "@/app/api/whatsapp/broadcast/route";
import * as awardRoute from "@/app/api/gamification/achievements/award/route";

/**
 * Lot E (2026-11-05/06) — façades terminées, sur PostgreSQL réel (RLS active) :
 * pulse climat anonyme, agenda d'écoute, inscriptions aux évènements, élèves
 * d'une ligne de transport, moyennes d'origine, portefeuille calculé,
 * campagnes vocales et WhatsApp, badges par défaut.
 */
let g: TenantGraph;
const admin = () => actAs(sessionFor("SCHOOL_ADMIN", g.schoolId, g.adminId));
const asParent = () => actAs(sessionFor("PARENT", g.schoolId, g.ids.parentUser));
const asStudent = (userId = g.ids.studentUser) => actAs(sessionFor("STUDENT", g.schoolId, userId));

const ENV_KEYS = ["WHATSAPP_PHONE_ID", "WHATSAPP_ACCESS_TOKEN", "WHATSAPP_TEMPLATE_NAME", "VOICE_WEBHOOK_URL"] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(async () => {
    g = await seedTenantGraph("LOTE");
    await prisma.school.update({ where: { id: g.schoolId }, data: { enabledModules: [...ALL_MODULE_IDS] } });
    // Parent joignable (ancien numéro à 8 chiffres)
    await prisma.user.update({ where: { id: g.ids.parentUser }, data: { phone: "97 00 00 01" } });
    for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
}, 180_000);

afterAll(() => {
    for (const key of ENV_KEYS) {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
    }
    vi.unstubAllGlobals();
});

describe("pulse climat anonyme", () => {
    const answer = (score: number) => ({ score, safety: true, friend: true, adultListens: score >= 5, harassWitness: false });

    it("une réponse par élève et par semaine, sans trace de ce qu'il a répondu", async () => {
        asStudent();
        const first = await callRoute(pulseRoute.POST!, { method: "POST", path: "/api/wellbeing/pulse", body: answer(8) });
        expect(first.status).toBe(201);
        const again = await callRoute(pulseRoute.POST!, { method: "POST", path: "/api/wellbeing/pulse", body: answer(2) });
        expect(again.status).toBe(409);

        const state = await callRoute(pulseRoute.GET!, { path: "/api/wellbeing/pulse" });
        expect((state.body as { answered: boolean }).answered).toBe(true);

        const participation = await prisma.climatePulseParticipation.findFirstOrThrow({ where: { userId: g.ids.studentUser } });
        expect(Object.keys(participation).sort()).toEqual(["createdAt", "id", "schoolId", "userId", "weekStart"]);
    });

    it("l'enseignant ou le parent ne peuvent pas répondre", async () => {
        asParent();
        const res = await callRoute(pulseRoute.POST!, { method: "POST", path: "/api/wellbeing/pulse", body: answer(5) });
        expect(res.status).toBe(403);
    });

    it(`la semaine n'est publiée qu'à partir de ${PULSE_MIN_RESPONSES} réponses`, async () => {
        admin();
        const hidden = await callRoute(overviewRoute.GET!, { path: "/api/wellbeing/overview" });
        const hiddenBody = hidden.body as { pulseWeeks: unknown[]; pulseStats: unknown[]; kpis: { climateScore: number | null }; pulse: { currentWeekResponses: number } };
        expect(hiddenBody.pulseWeeks).toHaveLength(0);
        expect(hiddenBody.pulseStats).toHaveLength(0);
        expect(hiddenBody.kpis.climateScore).toBeNull();
        expect(hiddenBody.pulse.currentWeekResponses).toBe(1);

        // 4 autres élèves répondent (notes 8, 6, 4, 2, 10 → moyenne 6)
        for (const score of [6, 4, 2, 10]) {
            const user = await prisma.user.create({
                data: { email: `${uniqueCode("pulse")}@integration.test`, password: "x", firstName: "Élève", lastName: "Pulse", role: "STUDENT", schoolId: g.schoolId },
            });
            asStudent(user.id);
            const res = await callRoute(pulseRoute.POST!, { method: "POST", path: "/api/wellbeing/pulse", body: answer(score) });
            expect(res.status).toBe(201);
        }

        admin();
        const shown = await callRoute(overviewRoute.GET!, { path: "/api/wellbeing/overview" });
        const body = shown.body as {
            pulseWeeks: { weekLabel: string; value: number; isCurrent: boolean; responses: number }[];
            pulseStats: { key: string; value: number }[];
            kpis: { climateScore: number; pulseResponses: number };
        };
        expect(body.pulseWeeks).toHaveLength(1);
        expect(body.pulseWeeks[0]).toMatchObject({ value: 6, isCurrent: true, responses: 5 });
        expect(body.pulseWeeks[0].weekLabel).toBe(pulseWeekOf().weekLabel.replace(/^\d{4}-S0?/, "S"));
        expect(body.kpis).toMatchObject({ climateScore: 6, pulseResponses: 5 });
        // « Un adulte m'écoute » : oui pour 8, 6 et 10 → 60 %
        expect(body.pulseStats.find((s) => s.key === "adult")?.value).toBe(60);
    });
});

describe("agenda de la cellule d'écoute", () => {
    it("la direction planifie puis annule un rendez-vous ; un rendez-vous passé est refusé", async () => {
        admin();
        const startAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
        const created = await callRoute(appointmentsRoute.POST!, {
            method: "POST",
            path: "/api/wellbeing/appointments",
            body: { startAt, durationMinutes: 45, kind: "Première écoute", anonymousLabel: "Anonyme · 6e A" },
        });
        expect(created.status).toBe(201);
        const { id, variantHint } = created.body as { id: string; variantHint: string };
        expect(variantHint).toBe("warning");

        const overview = await callRoute(overviewRoute.GET!, { path: "/api/wellbeing/overview" });
        expect((overview.body as { appointments: { id: string }[] }).appointments.map((a) => a.id)).toContain(id);

        const past = await callRoute(appointmentsRoute.POST!, {
            method: "POST",
            path: "/api/wellbeing/appointments",
            body: { startAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), kind: "Suivi régulier" },
        });
        expect(past.status).toBe(400);

        const removed = await callRoute(appointmentRoute.DELETE!, { method: "DELETE", path: `/api/wellbeing/appointments/${id}`, params: { id } });
        expect(removed.status).toBe(200);
        expect(await prisma.psyAppointment.findUnique({ where: { id } })).toBeNull();
    });

    it("un enseignant ne voit ni ne planifie l'agenda", async () => {
        actAs(sessionFor("TEACHER", g.schoolId, g.teacherUserId));
        const res = await callRoute(appointmentsRoute.POST!, {
            method: "POST",
            path: "/api/wellbeing/appointments",
            body: { startAt: new Date(Date.now() + 86_400_000).toISOString(), kind: "Suivi régulier" },
        });
        expect(res.status).toBe(403);
    });
});

describe("inscriptions aux évènements", () => {
    it("le parent inscrit son enfant, le voit inscrit, puis annule avant l'évènement", async () => {
        const event = await prisma.schoolEvent.create({
            data: { schoolId: g.schoolId, title: "Sortie au musée", startDate: new Date(Date.now() + 10 * 86_400_000), isPublished: true },
        });
        asParent();
        const joined = await callRoute(participateRoute.POST!, {
            method: "POST",
            path: `/api/events/${event.id}/participate`,
            params: { id: event.id },
            body: { studentId: g.ids.student, permissionGiven: true },
        });
        expect(joined.status).toBe(201);

        const list = await callRoute(eventsRoute.GET!, { path: "/api/events?upcoming=true" });
        const body = list.body as { data: { id: string; myRegistrations: string[] }[]; viewerStudents: { id: string }[] };
        expect(body.viewerStudents.map((s) => s.id)).toEqual([g.ids.student]);
        expect(body.data.find((e) => e.id === event.id)?.myRegistrations).toEqual([g.ids.student]);

        const cancelled = await callRoute(participateRoute.DELETE!, {
            method: "DELETE",
            path: `/api/events/${event.id}/participate?studentId=${g.ids.student}`,
            params: { id: event.id },
        });
        expect(cancelled.status).toBe(200);
        expect(await prisma.eventParticipation.count({ where: { eventId: event.id } })).toBe(0);
    });

    it("une inscription ne s'annule plus une fois l'évènement commencé", async () => {
        const started = await prisma.schoolEvent.create({
            data: { schoolId: g.schoolId, title: "Kermesse", startDate: new Date(Date.now() - 3_600_000), isPublished: true },
        });
        await prisma.eventParticipation.create({ data: { eventId: started.id, studentId: g.ids.student } });
        asParent();
        const res = await callRoute(participateRoute.DELETE!, {
            method: "DELETE",
            path: `/api/events/${started.id}/participate?studentId=${g.ids.student}`,
            params: { id: started.id },
        });
        expect(res.status).toBe(409);
    });
});

describe("élèves d'une ligne de transport", () => {
    it("inscrit un élève de l'école, refuse un doublon et un élève d'une autre école, puis le retire", async () => {
        admin();
        const id = g.ids.transportLine;
        const path = `/api/transport/lines/${id}/students`;
        const added = await callRoute(lineStudentsRoute.POST!, { method: "POST", path, params: { id }, body: { studentId: g.ids.student, direction: "BOTH" } });
        expect(added.status).toBe(201);
        const dup = await callRoute(lineStudentsRoute.POST!, { method: "POST", path, params: { id }, body: { studentId: g.ids.student } });
        expect(dup.status).toBe(409);

        const other = await createSchool("LOTE-B");
        const strangerUser = await prisma.user.create({
            data: { email: `${uniqueCode("autre")}@integration.test`, password: "x", firstName: "Autre", lastName: "École", role: "STUDENT", schoolId: other.id },
        });
        const stranger = await prisma.studentProfile.create({ data: { userId: strangerUser.id, schoolId: other.id, matricule: uniqueCode("EXT") } });
        const foreign = await callRoute(lineStudentsRoute.POST!, { method: "POST", path, params: { id }, body: { studentId: stranger.id } });
        expect(foreign.status).toBe(404);

        const listed = await callRoute(lineStudentsRoute.GET!, { path, params: { id } });
        expect((listed.body as { students: { id: string }[] }).students.map((s) => s.id)).toEqual([g.ids.student]);

        const removed = await callRoute(lineStudentsRoute.DELETE!, { method: "DELETE", path: `${path}?studentId=${g.ids.student}`, params: { id } });
        expect(removed.status).toBe(200);
        const twice = await callRoute(lineStudentsRoute.DELETE!, { method: "DELETE", path: `${path}?studentId=${g.ids.student}`, params: { id } });
        expect(twice.status).toBe(404);
    });
});

describe("moyennes d'origine d'un élève transféré (table sous RLS)", () => {
    it("saisit, relit et efface une moyenne ; refuse quand l'année est clôturée", async () => {
        admin();
        const id = g.ids.student;
        const path = `/api/students/${id}/external-averages`;
        const set = await callRoute(externalRoute.PUT!, { method: "PUT", path, params: { id }, body: { periodId: g.ids.period, average: 12.35, originSchool: "CEG Gbégamey" } });
        expect(set.status).toBe(200);

        const read = await callRoute(externalRoute.GET!, { path, params: { id } });
        const periods = (read.body as { periods: { periodId: string; average: number | null; originSchool: string | null }[] }).periods;
        expect(periods.find((p) => p.periodId === g.ids.period)).toMatchObject({ average: 12.35, originSchool: "CEG Gbégamey" });

        await prisma.academicYear.update({ where: { id: g.ids.year }, data: { status: "CLOSED" } });
        try {
            const locked = await callRoute(externalRoute.PUT!, { method: "PUT", path, params: { id }, body: { periodId: g.ids.period, average: 15, originSchool: "CEG Gbégamey" } });
            expect(locked.status).toBeGreaterThanOrEqual(400);
            const row = await prisma.externalPeriodAverage.findUniqueOrThrow({ where: { studentId_periodId: { studentId: id, periodId: g.ids.period } } });
            expect(Number(row.average)).toBe(12.35);
        } finally {
            await prisma.academicYear.update({ where: { id: g.ids.year }, data: { status: "ACTIVE" } });
        }

        const cleared = await callRoute(externalRoute.PUT!, { method: "PUT", path, params: { id }, body: { periodId: g.ids.period, average: null } });
        expect(cleared.status).toBe(200);
        expect(await prisma.externalPeriodAverage.count({ where: { studentId: id } })).toBe(0);
    });
});

describe("portefeuille : comptes déclarés, soldes calculés", () => {
    it("solde = ouverture + encaissements validés du canal depuis la déclaration", async () => {
        admin();
        const created = await callRoute(walletAccountsRoute.POST!, {
            method: "POST",
            path: "/api/wallet/accounts",
            body: { name: "Caisse principale", kind: "CASH", accountRef: null, openingBalanceFcfa: 5000 },
        });
        expect(created.status).toBe(201);
        const accountId = (created.body as { id: string }).id;

        // Encaissement espèces validé APRÈS la déclaration : compté ; en attente : non
        const fee = await prisma.fee.findFirstOrThrow({ where: { schoolId: g.schoolId } });
        await prisma.payment.create({ data: { studentId: g.ids.student, feeId: fee.id, amount: 20000, method: "CASH", status: "VERIFIED" } });
        await prisma.payment.create({ data: { studentId: g.ids.student, feeId: fee.id, amount: 7000, method: "CASH", status: "PENDING" } });
        // Second compte espèces : ne reçoit pas les encaissements (jamais comptés deux fois)
        const second = await callRoute(walletAccountsRoute.POST!, {
            method: "POST",
            path: "/api/wallet/accounts",
            body: { name: "Petite caisse", kind: "CASH", openingBalanceFcfa: 1000 },
        });
        const secondId = (second.body as { id: string }).id;

        const overview = await callRoute(walletOverviewRoute.GET!, { path: "/api/wallet/overview" });
        const accounts = (overview.body as { accounts: { id: string; balanceFcfa: string; collectedFcfa: string; receivesPayments: boolean }[] }).accounts;
        expect(accounts.find((a) => a.id === accountId)).toMatchObject({ balanceFcfa: "25000", collectedFcfa: "20000", receivesPayments: true });
        expect(accounts.find((a) => a.id === secondId)).toMatchObject({ balanceFcfa: "1000", receivesPayments: false });

        // Mouvement saisi : le compte ne se supprime plus (historique)
        await prisma.walletTransaction.create({ data: { schoolId: g.schoolId, accountId: secondId, direction: "OUTFLOW", amountFcfa: BigInt(500) } });
        const blocked = await callRoute(walletAccountRoute.DELETE!, { method: "DELETE", path: `/api/wallet/accounts/${secondId}`, params: { id: secondId } });
        expect(blocked.status).toBe(409);

        const patched = await callRoute(walletAccountRoute.PATCH!, { method: "PATCH", path: `/api/wallet/accounts/${accountId}`, params: { id: accountId }, body: { name: "Caisse du secrétariat" } });
        expect(patched.status).toBe(200);
        // Un PATCH sans solde ne remet pas l'ouverture à zéro
        expect((await prisma.walletAccount.findUniqueOrThrow({ where: { id: accountId } })).balanceFcfa).toBe(BigInt(5000));
    });
});

describe("campagnes vocales et WhatsApp", () => {
    it("sans passerelle configurée : 503 explicite, rien n'est créé", async () => {
        delete process.env.VOICE_WEBHOOK_URL;
        delete process.env.WHATSAPP_PHONE_ID;
        admin();
        const voice = await callRoute(voiceRoute.POST!, { method: "POST", path: "/api/voice-notifs", body: { lang: "FR", text: "Réunion des parents jeudi" } });
        expect(voice.status).toBe(503);
        const wa = await callRoute(whatsappRoute.POST!, { method: "POST", path: "/api/whatsapp/broadcast", body: { message: "Réunion des parents jeudi" } });
        expect(wa.status).toBe(503);
        expect(await prisma.voiceCampaign.count({ where: { schoolId: g.schoolId } })).toBe(0);
    });

    it("campagne vocale en fon : traduction gardée, un appel en file par famille, compté atteint après envoi", async () => {
        process.env.VOICE_WEBHOOK_URL = "https://voix.example.bj/calls";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 202 })));
        admin();
        const res = await callRoute(voiceRoute.POST!, {
            method: "POST",
            path: "/api/voice-notifs",
            body: { lang: "FON", text: "Texte en fon", textFr: "Réunion des parents jeudi", templateKind: "CONVOCATION" },
        });
        expect(res.status).toBe(202);
        const { id, queued } = res.body as { id: string; queued: number };
        expect(queued).toBe(1);
        const campaign = await prisma.voiceCampaign.findUniqueOrThrow({ where: { id }, include: { translations: true } });
        expect(campaign).toMatchObject({ status: "DISPATCHED", audienceSize: 1, textFr: "Réunion des parents jeudi" });
        expect(campaign.translations.map((t) => t.lang)).toEqual(["FON"]);

        const job = await prisma.backgroundJob.findFirstOrThrow({ where: { type: "voice.send", schoolId: g.schoolId } });
        expect(job.payload).toMatchObject({ to: "2290197000001", lang: "FON", campaignId: id });

        await JOB_HANDLERS["voice.send"](job.payload as never);
        expect((await prisma.voiceCampaign.findUniqueOrThrow({ where: { id } })).reachedCount).toBe(1);
    });

    it("diffusion WhatsApp : une trace par famille, marquée envoyée après réponse de Meta", async () => {
        process.env.WHATSAPP_PHONE_ID = "123";
        process.env.WHATSAPP_ACCESS_TOKEN = "tok";
        process.env.WHATSAPP_TEMPLATE_NAME = "annonce_ecole";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.9" }] }), { status: 200 })));
        admin();
        const res = await callRoute(whatsappRoute.POST!, { method: "POST", path: "/api/whatsapp/broadcast", body: { message: "Réunion des parents jeudi 17 h" } });
        expect(res.status).toBe(202);
        expect((res.body as { queued: number }).queued).toBe(1);

        const log = await prisma.communicationLog.findFirstOrThrow({ where: { schoolId: g.schoolId, channel: "WHATSAPP" } });
        expect(log).toMatchObject({ status: "QUEUED", recipient: "2290197000001", userId: g.ids.parentUser });
        const job = await prisma.backgroundJob.findFirstOrThrow({ where: { type: "whatsapp.send", schoolId: g.schoolId } });
        await JOB_HANDLERS["whatsapp.send"](job.payload as never);
        expect((await prisma.communicationLog.findUniqueOrThrow({ where: { id: log.id } })).status).toBe("SENT");
    });
});

describe("badges par défaut", () => {
    it("un enseignant attribue un badge du catalogue par défaut (500 auparavant : catalogue vide)", async () => {
        actAs(sessionFor("TEACHER", g.schoolId, g.teacherUserId));
        const res = await callRoute(awardRoute.POST!, {
            method: "POST",
            path: "/api/gamification/achievements/award",
            body: { userId: g.ids.studentUser, achievementCode: "FELICITATIONS" },
        });
        expect(res.status).toBe(200);
        expect(await prisma.userAchievement.count({ where: { userId: g.ids.studentUser } })).toBe(1);
    });
});
