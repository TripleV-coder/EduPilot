import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as POST_RECS } from "@/app/api/orientation/[id]/recommendations/route";
import { POST as POST_VALIDATE } from "@/app/api/orientation/[id]/validate/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    studentOrientation: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    orientationRecommendation: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

const ORIENTATION_ID = cuid("orient1");
const RECOMMENDATION_ID = cuid("reco1");

function makeOrientation(overrides: Record<string, unknown> = {}) {
  return {
    id: ORIENTATION_ID,
    status: "PENDING",
    student: { schoolId: FIXTURES.schoolA },
    ...overrides,
  } as never;
}

function makeRecommendation(overrides: Record<string, unknown> = {}) {
  return {
    id: RECOMMENDATION_ID,
    orientationId: ORIENTATION_ID,
    isValidated: false,
    orientation: {
      student: { user: { schoolId: FIXTURES.schoolA } },
    },
    ...overrides,
  } as never;
}

const VALID_REC_BODY = {
  recommendedSeries: "SERIE_C",
  rank: 1,
  score: 85,
  justification: "Bon profil scientifique",
  strengths: ["Maths"],
  warnings: [],
};

describe("POST /api/orientation/[id]/recommendations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_RECS(makeRequest("http://localhost/api/orientation/o1/recommendations", { method: "POST", body: VALID_REC_BODY }), { session: null, params: Promise.resolve({ id: ORIENTATION_ID }) });
    expect(res.status).toBe(401);
  });

  it("should forbid PARENT", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT"));
    const res = await POST_RECS(makeRequest("http://localhost/api/orientation/o1/recommendations", { method: "POST", body: VALID_REC_BODY }), { session: makeSession("PARENT"), params: Promise.resolve({ id: ORIENTATION_ID }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST_RECS(makeRequest("http://localhost/api/orientation/o1/recommendations", {
      method: "POST",
      body: { recommendedSeries: "SERIE_X", score: 85, justification: "j" },
    }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: ORIENTATION_ID }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Données invalides");
    expect(body.details).toBeDefined();
  });

  it("should return 404 when orientation not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.findFirst).mockResolvedValue(null);
    const res = await POST_RECS(makeRequest("http://localhost/api/orientation/o1/recommendations", { method: "POST", body: VALID_REC_BODY }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: ORIENTATION_ID }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Dossier d'orientation introuvable");
  });

  // Audit M2 : le dossier est cherché dans l'établissement de la session.
  // Celui d'une autre école n'est pas trouvé (404 ; la base ne renvoie rien,
  // d'où le double qui renvoie null) au lieu d'être lu puis refusé (403) :
  // sous RLS, son élève est masqué et la lecture échouait (500).
  it("should not find an orientation of another school (404)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.findFirst).mockResolvedValue(null);
    const res = await POST_RECS(makeRequest("http://localhost/api/orientation/o1/recommendations", { method: "POST", body: VALID_REC_BODY }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: ORIENTATION_ID }) });
    expect(res.status).toBe(404);
    expect(vi.mocked(prisma.studentOrientation.findFirst).mock.calls[0][0]).toMatchObject({
      where: { id: ORIENTATION_ID, student: { schoolId: FIXTURES.schoolA } },
    });
    expect(prisma.orientationRecommendation.create).not.toHaveBeenCalled();
  });

  it("should create the recommendation and promote a PENDING orientation", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.findFirst).mockResolvedValue(makeOrientation({ status: "PENDING" }));
    vi.mocked(prisma.orientationRecommendation.create).mockResolvedValue({
      id: RECOMMENDATION_ID,
      orientationId: ORIENTATION_ID,
      recommendedSeries: "SERIE_C",
      rank: 1,
      score: 85,
      justification: "Bon profil scientifique",
      strengths: ["Maths"],
      warnings: [],
      isValidated: false,
    } as never);
    vi.mocked(prisma.studentOrientation.update).mockResolvedValue(makeOrientation({ status: "RECOMMENDED" }));
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "al1" } as never);

    const res = await POST_RECS(makeRequest("http://localhost/api/orientation/o1/recommendations", { method: "POST", body: VALID_REC_BODY }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: ORIENTATION_ID }) });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.isValidated).toBe(false);
    expect(body.recommendedSeries).toBe("SERIE_C");
    expect(prisma.orientationRecommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orientationId: ORIENTATION_ID,
          recommendedSeries: "SERIE_C",
          rank: 1,
          score: 85,
          justification: "Bon profil scientifique",
          strengths: ["Maths"],
          warnings: [],
          isValidated: false,
        }),
      })
    );
    expect(prisma.studentOrientation.update).toHaveBeenCalledWith({ where: { id: ORIENTATION_ID }, data: { status: "RECOMMENDED" } });
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "ADD_RECOMMENDATION" }) })
    );
  });

  it("should promote an ANALYZED orientation as well", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.findFirst).mockResolvedValue(makeOrientation({ status: "ANALYZED" }));
    vi.mocked(prisma.orientationRecommendation.create).mockResolvedValue({ id: RECOMMENDATION_ID } as never);
    vi.mocked(prisma.studentOrientation.update).mockResolvedValue(makeOrientation({ status: "RECOMMENDED" }));
    const res = await POST_RECS(makeRequest("http://localhost/api/orientation/o1/recommendations", { method: "POST", body: VALID_REC_BODY }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: ORIENTATION_ID }) });
    expect(res.status).toBe(201);
    expect(prisma.studentOrientation.update).toHaveBeenCalled();
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.studentOrientation.findFirst).mockResolvedValue(makeOrientation({ status: "PENDING" }));
    vi.mocked(prisma.orientationRecommendation.create).mockRejectedValue(new Error("db down"));
    const res = await POST_RECS(makeRequest("http://localhost/api/orientation/o1/recommendations", { method: "POST", body: VALID_REC_BODY }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: ORIENTATION_ID }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur serveur");
  });
});

describe("POST /api/orientation/[id]/validate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 when unauthenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await POST_VALIDATE(makeRequest("http://localhost/api/orientation/o1/validate", { method: "POST", body: { isValidated: true } }), { session: null, params: Promise.resolve({ id: RECOMMENDATION_ID }) });
    expect(res.status).toBe(401);
  });

  it("should forbid TEACHER", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST_VALIDATE(makeRequest("http://localhost/api/orientation/o1/validate", { method: "POST", body: { isValidated: true } }), { session: makeSession("TEACHER"), params: Promise.resolve({ id: RECOMMENDATION_ID }) });
    expect(res.status).toBe(403);
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    const res = await POST_VALIDATE(makeRequest("http://localhost/api/orientation/o1/validate", { method: "POST", body: { isValidated: "yes" } }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: RECOMMENDATION_ID }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Données invalides");
    expect(body.details).toBeDefined();
  });

  it("should return 404 when recommendation not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.orientationRecommendation.findUnique).mockResolvedValue(null);
    const res = await POST_VALIDATE(makeRequest("http://localhost/api/orientation/o1/validate", { method: "POST", body: { isValidated: true } }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: RECOMMENDATION_ID }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Recommandation non trouvée");
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.orientationRecommendation.findUnique).mockResolvedValue(makeRecommendation({
      orientation: { student: { user: { schoolId: FIXTURES.schoolB } } },
    }));
    const res = await POST_VALIDATE(makeRequest("http://localhost/api/orientation/o1/validate", { method: "POST", body: { isValidated: true } }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: RECOMMENDATION_ID }) });
    expect(res.status).toBe(403);
  });

  it("should validate the recommendation and the orientation", async () => {
    const director = makeSession("DIRECTOR");
    vi.mocked(auth).mockResolvedValue(director);
    vi.mocked(prisma.orientationRecommendation.findUnique).mockResolvedValue(makeRecommendation());
    vi.mocked(prisma.orientationRecommendation.update).mockResolvedValue(makeRecommendation({ isValidated: true }) as never);
    vi.mocked(prisma.studentOrientation.update).mockResolvedValue({ id: ORIENTATION_ID, status: "VALIDATED" } as never);

    const res = await POST_VALIDATE(makeRequest("http://localhost/api/orientation/o1/validate", { method: "POST", body: { isValidated: true } }), { session: director, params: Promise.resolve({ id: RECOMMENDATION_ID }) });
    expect(res.status).toBe(200);
    expect(prisma.orientationRecommendation.update).toHaveBeenCalledWith({
      where: { id: RECOMMENDATION_ID },
      data: expect.objectContaining({ isValidated: true, validatedById: director.user.id, validatedAt: expect.any(Date) }),
    });
    expect(prisma.studentOrientation.update).toHaveBeenCalledWith({ where: { id: ORIENTATION_ID }, data: { status: "VALIDATED" } });
  });

  it("should reject without touching the orientation status", async () => {
    const director = makeSession("DIRECTOR");
    vi.mocked(auth).mockResolvedValue(director);
    vi.mocked(prisma.orientationRecommendation.findUnique).mockResolvedValue(makeRecommendation());
    vi.mocked(prisma.orientationRecommendation.update).mockResolvedValue(makeRecommendation({ isValidated: false }) as never);

    const res = await POST_VALIDATE(makeRequest("http://localhost/api/orientation/o1/validate", { method: "POST", body: { isValidated: false } }), { session: director, params: Promise.resolve({ id: RECOMMENDATION_ID }) });
    expect(res.status).toBe(200);
    expect(prisma.studentOrientation.update).not.toHaveBeenCalled();
  });

  it("should return 500 on prisma error", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR"));
    vi.mocked(prisma.orientationRecommendation.findUnique).mockResolvedValue(makeRecommendation());
    vi.mocked(prisma.orientationRecommendation.update).mockRejectedValue(new Error("db down"));
    const res = await POST_VALIDATE(makeRequest("http://localhost/api/orientation/o1/validate", { method: "POST", body: { isValidated: true } }), { session: makeSession("DIRECTOR"), params: Promise.resolve({ id: RECOMMENDATION_ID }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur serveur");
  });
});