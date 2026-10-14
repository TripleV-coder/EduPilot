/**
 * Paramètres de l'établissement (/api/config/parameters) et seuils de lecture
 * à l'écran (/api/config/thresholds) : lecture par l'école, écriture par la
 * direction seule, validation partagée, trace avant / après, recalcul des
 * analyses seulement quand un seuil d'analyse change.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";
import { DEFAULT_SCHOOL_PARAMETERS, type SchoolParameters } from "@/lib/schools/school-parameters";
import { DEFAULT_SCHOOL_THRESHOLDS } from "@/lib/schools/school-thresholds";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/services/analytics-sync", () => ({
    syncAllStudentsForSchool: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/prisma", () => {
    const prismaMock: Record<string, unknown> = {
        configOption: { findFirst: vi.fn(), upsert: vi.fn() },
        auditLog: { create: vi.fn() },
        academicConfig: { findUnique: vi.fn() },
        academicYear: { findFirst: vi.fn() },
    };
    prismaMock.$transaction = vi.fn(async (arg: unknown) => (Array.isArray(arg) ? Promise.all(arg) : arg));
    return { default: prismaMock };
});

import prisma from "@/lib/prisma";
import { syncAllStudentsForSchool } from "@/lib/services/analytics-sync";
import { GET, PUT } from "@/app/api/config/parameters/route";
import { GET as GET_THRESHOLDS } from "@/app/api/config/thresholds/route";

const url = "http://localhost:3000/api/config/parameters";
const clone = (): SchoolParameters => JSON.parse(JSON.stringify(DEFAULT_SCHOOL_PARAMETERS));
const put = (body: unknown) => PUT(makeRequest(url, { method: "PUT", body: body as Record<string, unknown> }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.configOption.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.academicConfig.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.academicYear.findFirst).mockResolvedValue({ id: "year1" } as never);
});

describe("/api/config/parameters", () => {
    it("lecture : valeurs d'origine sans réglage, droit de modifier selon le rôle", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
        const res = await GET(makeRequest(url));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.parameters).toEqual(DEFAULT_SCHOOL_PARAMETERS);
        expect(body.defaults).toEqual(DEFAULT_SCHOOL_PARAMETERS);
        expect(body.canEdit).toBe(false);
    });

    it("refusé aux familles (403)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
        expect((await GET(makeRequest(url))).status).toBe(403);
    });

    it("écriture refusée à un enseignant (403)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
        expect((await put(clone())).status).toBe(403);
        expect(prisma.configOption.upsert).not.toHaveBeenCalled();
    });

    it("refuse des seuils incohérents avec un message clair (400)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
        const p = clone();
        p.followUp.attendanceCritical = 90;
        const res = await put(p);
        expect(res.status).toBe(400);
        expect((await res.json()).error).toContain("critique");
        expect(prisma.configOption.upsert).not.toHaveBeenCalled();
    });

    it("enregistre, trace avant / après et recalcule si un seuil de risque change", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
        const p = clone();
        p.followUp.attendanceWarning = 90;
        const res = await put(p);
        expect(res.status).toBe(200);
        expect((await res.json()).recalculation).toBe("started");
        expect(prisma.configOption.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ create: expect.objectContaining({ schoolId: FIXTURES.schoolA, category: "SCHOOL_PARAMETERS" }) }),
        );
        expect(prisma.auditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ action: "SCHOOL_PARAMETERS_UPDATED" }),
        });
        expect(syncAllStudentsForSchool).toHaveBeenCalledWith(FIXTURES.schoolA, "year1");
    });

    it("un délai ou le climat de l'école ne relancent aucun recalcul", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
        const p = clone();
        p.services.canteenTicketDays = 45;
        p.followUp.climateWatchFrom = 25;
        const res = await put(p);
        expect(res.status).toBe(200);
        expect((await res.json()).recalculation).toBe("none");
        expect(syncAllStudentsForSchool).not.toHaveBeenCalled();
    });
});

describe("/api/config/thresholds — seuils de lecture pour tous", () => {
    it("lisible par une famille : seuil de passage, niveaux, mentions, conseil", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
        vi.mocked(prisma.academicConfig.findUnique).mockResolvedValue({ passingGrade: 12 } as never);
        const res = await GET_THRESHOLDS(makeRequest("http://localhost:3000/api/config/thresholds"));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.passingGrade).toBe(12);
        expect(body.performance).toEqual(DEFAULT_SCHOOL_THRESHOLDS.performance);
        expect(body.mentions).toEqual(DEFAULT_SCHOOL_THRESHOLDS.mentions);
        expect(body.council).toEqual(DEFAULT_SCHOOL_THRESHOLDS.council);
    });
});
