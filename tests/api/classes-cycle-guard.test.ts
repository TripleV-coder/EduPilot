import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    school: { findUnique: vi.fn() },
    classLevel: { findUnique: vi.fn() },
    class: { findFirst: vi.fn(), create: vi.fn() },
    teacherProfile: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/api/cache-helpers", () => ({
  invalidateByPath: vi.fn(),
  CACHE_PATHS: { classes: "classes" },
  CACHE_TTL_MEDIUM: 60,
  generateCacheKey: vi.fn(() => "k"),
  withCache: vi.fn((_k: unknown, fn: () => unknown) => fn()),
}));
vi.mock("@/lib/api/cache-http", () => ({ withHttpCache: vi.fn((_r: unknown, res: unknown) => res) }));

import prisma from "@/lib/prisma";
import { POST } from "@/app/api/classes/route";

const SCHOOL = FIXTURES.schoolA;
const LEVEL_ID = cuid("classlevel1");

function post(body: Record<string, unknown>) {
  return POST(
    makeRequest("http://localhost:3000/api/classes", { method: "POST", body }),
    { params: Promise.resolve({}) } as never
  );
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/classes — garde-fou cycle offert", () => {
  it("refuse (403) un niveau d'un cycle non offert par l'établissement", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValue({ schoolId: SCHOOL, level: "PRIMARY" } as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ offeredLevels: ["SECONDARY_COLLEGE", "SECONDARY_LYCEE"] } as never);

    const res = await post({ name: "CI A", classLevelId: LEVEL_ID });
    expect(res.status).toBe(403);
    expect(prisma.class.create).not.toHaveBeenCalled();
  });

  it("accepte (201) un niveau d'un cycle offert", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValue({ schoolId: SCHOOL, level: "SECONDARY_COLLEGE" } as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ offeredLevels: ["SECONDARY_COLLEGE", "SECONDARY_LYCEE"] } as never);
    vi.mocked(prisma.class.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.class.create).mockResolvedValue({ id: cuid("class1"), name: "6e A" } as never);

    const res = await post({ name: "6e A", classLevelId: LEVEL_ID });
    expect(res.status).toBe(201);
    expect(prisma.class.create).toHaveBeenCalled();
  });

  it("défaut sûr : n'impose rien si offeredLevels est vide", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
    vi.mocked(prisma.classLevel.findUnique).mockResolvedValue({ schoolId: SCHOOL, level: "PRIMARY" } as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ offeredLevels: [] } as never);
    vi.mocked(prisma.class.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.class.create).mockResolvedValue({ id: cuid("class2"), name: "CM2" } as never);

    const res = await post({ name: "CM2", classLevelId: LEVEL_ID });
    expect(res.status).toBe(201);
    expect(prisma.class.create).toHaveBeenCalled();
  });
});
