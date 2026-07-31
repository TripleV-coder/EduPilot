import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    school: { findUnique: vi.fn(), update: vi.fn() },
    classLevel: { count: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, PATCH } from "@/app/api/schools/[id]/levels/route";

const SCHOOL = FIXTURES.schoolA;
const ctx = { params: Promise.resolve({ id: SCHOOL }) };

function patch(body: Record<string, unknown>) {
  return PATCH(
    makeRequest(`http://localhost:3000/api/schools/${SCHOOL}/levels`, { method: "PATCH", body }),
    ctx
  );
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/schools/[id]/levels", () => {
  it("renvoie les cycles offerts + le référentiel", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({
      id: SCHOOL, name: "X", level: "SECONDARY_COLLEGE", offeredLevels: ["SECONDARY_COLLEGE", "SECONDARY_LYCEE"],
    } as never);

    const res = await GET(makeRequest(`http://localhost:3000/api/schools/${SCHOOL}/levels`), ctx);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.offeredLevels).toEqual(["SECONDARY_COLLEGE", "SECONDARY_LYCEE"]);
    expect(body.cycles).toHaveLength(3);
  });
});

describe("PATCH /api/schools/[id]/levels", () => {
  it("refuse un rôle sans SCHOOL_UPDATE (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { schoolId: SCHOOL }) as never);
    expect((await patch({ offeredLevels: ["PRIMARY"] })).status).toBe(403);
  });

  it("refuse un corps vide (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
    expect((await patch({ offeredLevels: [] })).status).toBe(400);
  });

  it("met à jour les cycles offerts + level legacy", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ offeredLevels: ["PRIMARY"] } as never);
    vi.mocked(prisma.school.update).mockResolvedValue({ offeredLevels: ["PRIMARY", "SECONDARY_COLLEGE"], level: "MIXED" } as never);

    const res = await patch({ offeredLevels: ["SECONDARY_COLLEGE", "PRIMARY"] });
    expect(res.status).toBe(200);
    const arg = vi.mocked(prisma.school.update).mock.calls[0][0] as { data: { offeredLevels: string[]; level: string } };
    expect(arg.data.offeredLevels).toEqual(["PRIMARY", "SECONDARY_COLLEGE"]); // normalisé/ordonné
    expect(arg.data.level).toBe("MIXED");
  });

  it("bloque le retrait d'un cycle qui a des classes (409)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { schoolId: SCHOOL }) as never);
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ offeredLevels: ["PRIMARY", "SECONDARY_COLLEGE"] } as never);
    vi.mocked(prisma.classLevel.count).mockResolvedValue(4 as never);

    const res = await patch({ offeredLevels: ["PRIMARY"] }); // retire COLLEGE
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CYCLE_HAS_CLASSES");
    expect(prisma.school.update).not.toHaveBeenCalled();
  });
});
