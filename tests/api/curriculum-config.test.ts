import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, PATCH, DELETE } from "@/app/api/admin/curriculum-config/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    classSubject: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    school: { findUnique: vi.fn() },
    subject: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    class: { findUnique: vi.fn() },
    grade: { findFirst: vi.fn() },
  },
}));

describe("GET /api/admin/curriculum-config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/admin/curriculum-config?classId=c1"));
    expect(res.status).toBe(401);
  });

  it("should forbid non-SUPER_ADMIN roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/admin/curriculum-config?classId=c1"));
    expect(res.status).toBe(403);
  });

  it("should return 400 when classId missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    const res = await GET(makeRequest("http://localhost/api/admin/curriculum-config"));
    expect(res.status).toBe(400);
  });

  it("should list class subjects with the total coefficient", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.classSubject.findMany).mockResolvedValue([
      { id: "cs1", coefficient: 3, subject: { id: "s1", name: "Maths" } },
      { id: "cs2", coefficient: 2, subject: { id: "s2", name: "Français" } },
    ] as never);

    const res = await GET(makeRequest("http://localhost/api/admin/curriculum-config?classId=c1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.totalCoefficients).toBe(5);
  });
});

describe("POST /api/admin/curriculum-config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 400 when action is missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    const res = await POST(makeRequest("http://localhost/api/admin/curriculum-config", { method: "POST", body: {} }));
    expect(res.status).toBe(400);
  });

  it("should create a subject (create-subject)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ id: "sc1" } as never);
    vi.mocked(prisma.subject.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.subject.create).mockResolvedValue({ id: "s1", code: "MAT" } as never);

    const res = await POST(makeRequest("http://localhost/api/admin/curriculum-config?action=create-subject", {
      method: "POST",
      body: { schoolId: "sc1", name: "Mathématiques", code: "mat" },
    }));
    expect(res.status).toBe(200);
    expect(prisma.subject.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: "MAT" }) })
    );
  });

  it("should return 404 when school not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.school.findUnique).mockResolvedValue(null);
    const res = await POST(makeRequest("http://localhost/api/admin/curriculum-config?action=create-subject", {
      method: "POST",
      body: { schoolId: "sc1", name: "Mathématiques", code: "mat" },
    }));
    expect(res.status).toBe(404);
  });

  it("should return 409 for a duplicate subject code", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.school.findUnique).mockResolvedValue({ id: "sc1" } as never);
    vi.mocked(prisma.subject.findFirst).mockResolvedValue({ id: "s1" } as never);
    const res = await POST(makeRequest("http://localhost/api/admin/curriculum-config?action=create-subject", {
      method: "POST",
      body: { schoolId: "sc1", name: "Mathématiques", code: "MAT" },
    }));
    expect(res.status).toBe(409);
  });

  it("should assign a subject to a class (assign-subject)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ id: "cl1" } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ id: "s1" } as never);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.classSubject.create).mockResolvedValue({ id: "cs1" } as never);

    const res = await POST(makeRequest("http://localhost/api/admin/curriculum-config?action=assign-subject", {
      method: "POST",
      body: { classId: "cl1", subjectId: "s1", coefficient: 4 },
    }));
    expect(res.status).toBe(200);
    expect(prisma.classSubject.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ coefficient: 4 }) })
    );
  });

  it("should return 400 for an invalid coefficient", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    const res = await POST(makeRequest("http://localhost/api/admin/curriculum-config?action=assign-subject", {
      method: "POST",
      body: { classId: "cl1", subjectId: "s1", coefficient: 12 },
    }));
    expect(res.status).toBe(400);
  });

  it("should return 409 when already assigned", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.class.findUnique).mockResolvedValue({ id: "cl1" } as never);
    vi.mocked(prisma.subject.findUnique).mockResolvedValue({ id: "s1" } as never);
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({ id: "cs1" } as never);

    const res = await POST(makeRequest("http://localhost/api/admin/curriculum-config?action=assign-subject", {
      method: "POST",
      body: { classId: "cl1", subjectId: "s1", coefficient: 4 },
    }));
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/admin/curriculum-config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should update a coefficient", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({ id: "cs1", coefficient: 2 } as never);
    vi.mocked(prisma.classSubject.update).mockResolvedValue({ id: "cs1", coefficient: 5 } as never);

    const res = await PATCH(makeRequest("http://localhost/api/admin/curriculum-config", { method: "PATCH", body: { classSubjectId: "cs1", coefficient: 5 } }));
    expect(res.status).toBe(200);
    expect(prisma.classSubject.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { coefficient: 5 } })
    );
  });

  it("should return 404 when assignment missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/admin/curriculum-config", { method: "PATCH", body: { classSubjectId: "cs1", coefficient: 5 } }));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/admin/curriculum-config", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 400 when classSubjectId missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    const res = await DELETE(makeRequest("http://localhost/api/admin/curriculum-config", { method: "DELETE" }));
    expect(res.status).toBe(400);
  });

  it("should return 409 when the class subject has grades", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({ id: "cs1" } as never);
    vi.mocked(prisma.grade.findFirst).mockResolvedValue({ id: "g1" } as never);

    const res = await DELETE(makeRequest("http://localhost/api/admin/curriculum-config?classSubjectId=cs1", { method: "DELETE" }));
    expect(res.status).toBe(409);
  });

  it("should delete the class subject", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN"));
    vi.mocked(prisma.classSubject.findUnique).mockResolvedValue({ id: "cs1" } as never);
    vi.mocked(prisma.grade.findFirst).mockResolvedValue(null);

    const res = await DELETE(makeRequest("http://localhost/api/admin/curriculum-config?classSubjectId=cs1", { method: "DELETE" }));
    expect(res.status).toBe(200);
    expect(prisma.classSubject.delete).toHaveBeenCalledWith({ where: { id: "cs1" } });
  });
});