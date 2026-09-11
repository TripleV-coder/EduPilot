import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    class: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    classLevel: { findUnique: vi.fn() },
    school: { findUnique: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/teachers/school-assignments", () => ({
  isTeacherAssignedToSchool: vi.fn().mockResolvedValue(true),
}));
vi.mock("@/lib/api/cache-helpers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/cache-helpers")>();
  return {
    ...actual,
    withCache: vi.fn(async (handler: () => unknown) => await handler()),
    generateCacheKey: vi.fn(() => "cache-key"),
    invalidateByPath: vi.fn(),
  };
});
vi.mock("@/lib/api/cache-http", () => ({
  withHttpCache: vi.fn((response: unknown) => response),
}));

import prisma from "@/lib/prisma";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";
import { GET, POST } from "@/app/api/classes/route";

const classLevelId = cuid("classlevel1");

function classRow() {
  return {
    id: cuid("class6a"),
    name: "6e A",
    capacity: 40,
    classLevel: { id: classLevelId, name: "Sixième", level: "SECONDARY_COLLEGE", sequence: 1 },
    mainTeacher: null,
    _count: { enrollments: 32, classSubjects: 8 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(true);
});

describe("GET /api/classes", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/classes"));
    expect(res.status).toBe(401);
  });

  it("refuse un PARENT sans permission CLASS_READ (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await GET(makeRequest("http://localhost:3000/api/classes"));
    expect(res.status).toBe(403);
    expect(prisma.class.findMany).not.toHaveBeenCalled();
  });

  it("retourne 403 sans école active pour un DIRECTOR", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: null }));
    const res = await GET(makeRequest("http://localhost:3000/api/classes"));
    expect(res.status).toBe(403);
  });

  it("bloque un schoolId hors périmètre (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(
      makeRequest(`http://localhost:3000/api/classes?schoolId=${FIXTURES.schoolB}`)
    );
    expect(res.status).toBe(403);
  });

  it("liste les classes avec pagination et filtre école", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.class.findMany).mockResolvedValue([classRow()] as never);
    vi.mocked(prisma.class.count).mockResolvedValue(1);

    const res = await GET(
      makeRequest(
        `http://localhost:3000/api/classes?classLevelId=${classLevelId}&search=6e&page=1&limit=10`
      )
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("6e A");
    expect(body.pagination.total).toBe(1);

    const where = vi.mocked(prisma.class.findMany).mock.calls[0][0]?.where;
    expect(where).toMatchObject({
      schoolId: FIXTURES.schoolA,
      classLevelId,
      name: { contains: "6e", mode: "insensitive" },
    });
  });
});

describe("POST /api/classes", () => {
  const validBody = {
    name: "6e B",
    classLevelId,
    capacity: 35,
  };

  function mockHappyPath() {
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValue({
      schoolId: FIXTURES.schoolA,
      level: "SECONDARY_COLLEGE",
    } as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ offeredLevels: [] } as never);
    vi.mocked(prisma.class.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.class.create).mockResolvedValue({
      id: cuid("classnew"),
      name: "6e B",
      classLevel: { name: "Sixième" },
      mainTeacher: null,
    } as never);
  }

  it("refuse un TEACHER sans CLASS_CREATE (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", { method: "POST", body: validBody })
    );
    expect(res.status).toBe(403);
  });

  it("refuse un niveau d'une autre école (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValue({
      schoolId: FIXTURES.schoolB,
      level: "SECONDARY_COLLEGE",
    } as never);

    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", { method: "POST", body: validBody })
    );
    expect(res.status).toBe(403);
    expect(prisma.class.create).not.toHaveBeenCalled();
  });

  it("refuse un doublon de nom dans le même niveau (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValue({
      schoolId: FIXTURES.schoolA,
      level: "SECONDARY_COLLEGE",
    } as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ offeredLevels: [] } as never);
    vi.mocked(prisma.class.findFirst).mockResolvedValue({ id: cuid("existing") } as never);

    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", { method: "POST", body: validBody })
    );
    expect(res.status).toBe(400);
  });

  it("refuse un enseignant principal non assigné à l'école (403)", async () => {
    const teacherId = cuid("teacher1");
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    mockHappyPath();
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: teacherId,
      schoolId: FIXTURES.schoolA,
    } as never);
    vi.mocked(isTeacherAssignedToSchool).mockResolvedValue(false);

    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", {
        method: "POST",
        body: { ...validBody, mainTeacherId: teacherId },
      })
    );
    expect(res.status).toBe(403);
  });

  it("crée la classe (201)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    mockHappyPath();

    const res = await POST(
      makeRequest("http://localhost:3000/api/classes", { method: "POST", body: validBody })
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("6e B");
    expect(prisma.class.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: FIXTURES.schoolA,
          classLevelId,
          name: "6e B",
          capacity: 35,
        }),
      })
    );
  });
});
