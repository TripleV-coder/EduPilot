import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findUnique: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET } from "@/app/api/classes/[id]/route";

const classId = cuid("class6a");

function classDetail(schoolId = FIXTURES.schoolA) {
  return {
    id: classId,
    name: "6e A",
    schoolId,
    classLevel: { id: cuid("level1"), name: "Sixième" },
    mainTeacher: null,
    classSubjects: [],
    enrollments: [],
    schedules: [],
    _count: { enrollments: 0, classSubjects: 0 },
  };
}

const params = { params: Promise.resolve({ id: classId }) };

beforeEach(() => vi.clearAllMocks());

describe("GET /api/classes/[id]", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest(`http://localhost:3000/api/classes/${classId}`), params);
    expect(res.status).toBe(401);
  });

  it("retourne 404 si la classe n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest(`http://localhost:3000/api/classes/${classId}`), params);
    expect(res.status).toBe(404);
  });

  it("refuse l'accès cross-tenant (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(classDetail(FIXTURES.schoolB) as never);

    const res = await GET(makeRequest(`http://localhost:3000/api/classes/${classId}`), params);
    expect(res.status).toBe(403);
  });

  it("retourne le détail de la classe pour un DIRECTOR", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue(classDetail() as never);

    const res = await GET(makeRequest(`http://localhost:3000/api/classes/${classId}`), params);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(classId);
    expect(body.name).toBe("6e A");
    expect(body.classLevel.name).toBe("Sixième");
  });
});
