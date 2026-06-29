import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
    default: {
        scanPoint: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
        scanLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
        studentProfile: { findFirst: vi.fn() },
        badge: { findUnique: vi.fn(), upsert: vi.fn() },
        class: { findUnique: vi.fn() },
        enrollment: { findMany: vi.fn() },
        auditLog: { create: vi.fn() },
        systemSetting: { findMany: vi.fn().mockResolvedValue([]) },
    },
}));

import prisma from "@/lib/prisma";
import { POST as scan } from "@/app/api/access-control/scan/route";
import { GET as listPoints, POST as createPoint } from "@/app/api/access-control/scan-points/route";
import { GET as getLogs } from "@/app/api/access-control/logs/route";
import { POST as regenerate } from "@/app/api/access-control/badges/regenerate/route";

const SCHOOL = FIXTURES.schoolA;
const STUDENT = FIXTURES.studentA;

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([] as never);
    vi.mocked(auth).mockResolvedValue(makeSession("STAFF", { schoolId: SCHOOL }) as never);
});

describe("scan-points", () => {
    it("crée un point de scan (201)", async () => {
        vi.mocked(prisma.scanPoint.create).mockResolvedValue({ id: "sp1" } as never);
        const res = await createPoint(makeRequest("http://localhost/api/access-control/scan-points", {
            method: "POST", body: { name: "Portail", type: "GATE" },
        }));
        expect(res.status).toBe(201);
    });
    it("liste les points", async () => {
        vi.mocked(prisma.scanPoint.findMany).mockResolvedValue([{ id: "sp1", name: "Portail" }] as never);
        const res = await listPoints(makeRequest("http://localhost/api/access-control/scan-points"));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.scanPoints).toHaveLength(1);
    });
    it("refuse un corps vide (400)", async () => {
        const res = await createPoint(makeRequest("http://localhost/api/access-control/scan-points", { method: "POST", body: {} }));
        expect(res.status).toBe(400);
    });
});

describe("scan — résolution badge", () => {
    it("OK quand le matricule est reconnu (QR prefix)", async () => {
        vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue({
            id: STUDENT, matricule: "BJ-2026-A0142", user: { firstName: "Awa", lastName: "Koné" },
        } as never);
        vi.mocked(prisma.scanLog.create).mockResolvedValue({ id: "log1" } as never);

        const res = await scan(makeRequest("http://localhost/api/access-control/scan", {
            method: "POST", body: { code: "EDUPILOT:STUDENT:BJ-2026-A0142" },
        }));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.result).toBe("OK");
        expect(body.student.matricule).toBe("BJ-2026-A0142");
        expect(prisma.scanLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ result: "OK", studentId: STUDENT }) })
        );
    });

    it("REFUSED quand le matricule est inconnu", async () => {
        vi.mocked(prisma.studentProfile.findFirst).mockResolvedValue(null as never);
        vi.mocked(prisma.scanLog.create).mockResolvedValue({ id: "log2" } as never);
        const res = await scan(makeRequest("http://localhost/api/access-control/scan", {
            method: "POST", body: { code: "BJ-9999-ZZ" },
        }));
        const body = await res.json();
        expect(body.result).toBe("REFUSED");
        expect(body.student).toBeNull();
    });
});

describe("logs", () => {
    it("renvoie journal + métriques", async () => {
        vi.mocked(prisma.scanLog.findMany).mockResolvedValue([
            { id: "l1", createdAt: new Date(), action: "ENTRY", result: "OK", matricule: "BJ-1", scanPoint: { name: "Portail" }, student: { matricule: "BJ-1", user: { firstName: "A", lastName: "B" } } },
        ] as never);
        vi.mocked(prisma.scanLog.count).mockResolvedValueOnce(10 as never).mockResolvedValueOnce(2 as never);
        const res = await getLogs(makeRequest("http://localhost/api/access-control/logs"));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.metrics).toEqual({ todayTotal: 10, todayRefused: 2, todayOk: 8 });
        expect(body.logs[0].refused).toBe(false);
    });
});

describe("badges/regenerate", () => {
    it("régénère un badge par élève actif de la classe", async () => {
        vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: SCHOOL } as never);
        vi.mocked(prisma.enrollment.findMany).mockResolvedValue([
            { studentId: "s1" }, { studentId: "s2" }, { studentId: "s1" },
        ] as never);
        vi.mocked(prisma.badge.upsert).mockResolvedValue({} as never);

        const res = await regenerate(makeRequest("http://localhost/api/access-control/badges/regenerate", {
            method: "POST", body: { classId: cuid("classa") },
        }));
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.regenerated).toBe(2); // dédupliqué
        expect(prisma.badge.upsert).toHaveBeenCalledTimes(2);
    });

    it("404 pour une classe d'une autre école", async () => {
        vi.mocked(prisma.class.findUnique).mockResolvedValue({ schoolId: FIXTURES.schoolB } as never);
        const res = await regenerate(makeRequest("http://localhost/api/access-control/badges/regenerate", {
            method: "POST", body: { classId: cuid("classb") },
        }));
        expect(res.status).toBe(404);
    });
});
