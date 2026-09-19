import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    documentSignature: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    user: { findUnique: vi.fn() },
    studentProfile: { findFirst: vi.fn() },
    certificate: { findFirst: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, POST } from "@/app/api/signatures/route";

const url = "http://localhost/api/signatures";
const body = (over: Record<string, unknown> = {}) => ({ docType: "REPORT_CARD", docId: "stu-1", method: "TYPED", payload: { studentId: "stu-1" }, ...over });
const post = (b: unknown) => POST(makeRequest(url, { method: "POST", body: b }));

describe("GET /api/signatures", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exige docType et docId valides (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA }));
    expect((await GET(makeRequest(`${url}?docType=HACK&docId=x`))).status).toBe(400);
    expect((await GET(makeRequest(`${url}?docType=REPORT_CARD`))).status).toBe(400);
  });

  it("ne lit que les signatures de l'école active", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { schoolId: FIXTURES.schoolA }));
    vi.mocked(prisma.documentSignature.findMany).mockResolvedValueOnce([] as never);
    const res = await GET(makeRequest(`${url}?docType=REPORT_CARD&docId=stu-1`));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.documentSignature.findMany).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { schoolId: FIXTURES.schoolA, docType: "REPORT_CARD", docId: "stu-1" } })
    );
  });

  it("refuse un élève (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("STUDENT", { schoolId: FIXTURES.schoolA }));
    expect((await GET(makeRequest(`${url}?docType=REPORT_CARD&docId=stu-1`))).status).toBe(403);
  });
});

describe("POST /api/signatures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue(makeSession("DIRECTOR", { schoolId: FIXTURES.schoolA, id: "u-dir" }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ firstName: "Ada", lastName: "Direction" } as never);
    vi.mocked(prisma.documentSignature.findFirst).mockResolvedValue(null as never);
    vi.mocked(prisma.documentSignature.create).mockResolvedValue({ id: "sig-1", signedAt: new Date() } as never);
  });

  it("un parent ne signe pas un bulletin (403)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { schoolId: FIXTURES.schoolA }));
    expect((await post(body())).status).toBe(403);
    expect(prisma.documentSignature.create).not.toHaveBeenCalled();
  });

  it("refuse le bulletin d'un élève d'une autre école (404)", async () => {
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValueOnce(null as never);
    const res = await post(body({ docId: "stu-other" }));
    expect(res.status).toBe(404);
    expect(vi.mocked(prisma.studentProfile.findFirst).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: expect.objectContaining({ id: "stu-other", schoolId: FIXTURES.schoolA }) })
    );
    expect(prisma.documentSignature.create).not.toHaveBeenCalled();
  });

  it("refuse un certificat d'une autre école (404)", async () => {
    vi.mocked(prisma.certificate.findFirst).mockResolvedValueOnce(null as never);
    const res = await post(body({ docType: "CERTIFICATE", docId: "cert-x" }));
    expect(res.status).toBe(404);
    expect(vi.mocked(prisma.certificate.findFirst).mock.calls[0][0]).toEqual(
      expect.objectContaining({ where: { id: "cert-x", student: { schoolId: FIXTURES.schoolA } } })
    );
  });

  it("refuse une seconde signature du même signataire (409)", async () => {
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValueOnce({ id: "stu-1" } as never);
    vi.mocked(prisma.documentSignature.findFirst).mockResolvedValueOnce({ id: "sig-0" } as never);
    expect((await post(body())).status).toBe(409);
  });

  it("rejette une méthode inconnue (400)", async () => {
    expect((await post(body({ method: "FORGED" }))).status).toBe(400);
  });

  it("signe le bulletin d'un élève de l'école, scellé et horodaté", async () => {
    vi.mocked(prisma.studentProfile.findFirst).mockResolvedValueOnce({ id: "stu-1" } as never);
    const res = await post(body());
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.documentSignature.create).mock.calls[0][0].data;
    expect(data).toEqual(expect.objectContaining({ schoolId: FIXTURES.schoolA, signerId: "u-dir", signerName: "Ada Direction", signerRole: "DIRECTOR" }));
    expect(data.contentHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
