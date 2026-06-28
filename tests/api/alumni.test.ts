import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
    default: {
        alumni: {
            findMany: vi.fn(),
            groupBy: vi.fn(),
            count: vi.fn(),
            create: vi.fn(),
        },
        auditLog: { create: vi.fn() },
        systemSetting: { findMany: vi.fn().mockResolvedValue([]) },
    },
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/alumni/route";

const SCHOOL = FIXTURES.schoolA;

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([] as never);
});

function get() {
    return GET(makeRequest("http://localhost:3000/api/alumni"));
}
function post(body: Record<string, unknown>) {
    return POST(makeRequest("http://localhost:3000/api/alumni", { method: "POST", body }));
}

describe("GET /api/alumni", () => {
    it("renvoie l'annuaire + promotions agrégées", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
        vi.mocked(prisma.alumni.findMany).mockResolvedValue([
            { id: "a1", firstName: "Aïssatou", lastName: "Bocco", graduationYear: 2008, field: "Médecine", isMentor: true },
        ] as never);
        vi.mocked(prisma.alumni.groupBy).mockResolvedValue([
            { graduationYear: 2010, _count: { _all: 3 } },
            { graduationYear: 2008, _count: { _all: 1 } },
        ] as never);
        vi.mocked(prisma.alumni.count).mockResolvedValueOnce(1 as never).mockResolvedValueOnce(4 as never);

        const res = await get();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.promotions).toEqual([
            { year: 2010, members: 3 },
            { year: 2008, members: 1 },
        ]);
        expect(body.total).toBe(4);
    });

    it("refuse un rôle non autorisé (403)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { schoolId: SCHOOL }) as never);
        expect((await get()).status).toBe(403);
    });
});

describe("POST /api/alumni", () => {
    it("crée un ancien élève (201)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: SCHOOL }) as never);
        vi.mocked(prisma.alumni.create).mockResolvedValue({ id: "new1" } as never);

        const res = await post({ firstName: "Patrick", lastName: "Tossou", graduationYear: 2010, field: "Tech", isMentor: true });
        expect(res.status).toBe(201);
        expect(prisma.alumni.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ schoolId: SCHOOL, graduationYear: 2010 }) })
        );
    });

    it("refuse un corps invalide (400)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
        // firstName manquant → ZodError → 400 via handlePrismaError? non : createApiHandler relaie l'exception
        const res = await post({ lastName: "X", graduationYear: 2010 });
        expect(res.status).toBe(400);
    });

    it("refuse un rôle enseignant (403)", async () => {
        vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: SCHOOL }) as never);
        expect((await post({ firstName: "A", lastName: "B", graduationYear: 2010 })).status).toBe(403);
    });
});
