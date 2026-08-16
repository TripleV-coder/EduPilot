import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/events/route";
import { GET as GET_ONE, PATCH, DELETE } from "@/app/api/events/[id]/route";
import { POST as POST_PARTICIPATE } from "@/app/api/events/[id]/participate/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    schoolEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn(), create: vi.fn() },
    studentProfile: { findUnique: vi.fn() },
    parentProfile: { findUnique: vi.fn() },
    parentStudent: { findUnique: vi.fn() },
    eventParticipation: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

describe("GET /api/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost/api/events"));
    expect(res.status).toBe(401);
  });

  it("should list published events with pagination", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findMany).mockResolvedValue([{ id: "e1" }] as never);
    vi.mocked(prisma.schoolEvent.count).mockResolvedValue(1);

    const res = await GET(makeRequest("http://localhost/api/events?page=1&limit=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.pagination.totalPages).toBe(1);
  });

  it("should filter by type and upcoming", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.schoolEvent.count).mockResolvedValue(0);

    await GET(makeRequest("http://localhost/api/events?type=SPORT&upcoming=true"));
    const call = vi.mocked(prisma.schoolEvent.findMany).mock.calls[0][0] as {
      where: { type?: string; startDate?: object };
    };
    expect(call.where.type).toBe("SPORT");
    expect(call.where.startDate).toBeDefined();
  });
});

describe("POST /api/events", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await POST(makeRequest("http://localhost/api/events", { method: "POST", body: {} }));
    expect(res.status).toBe(403);
  });

  it("should create an event and notify users when published", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.schoolEvent.create).mockResolvedValue({ id: "e1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ id: "u1" }] as never);

    const res = await POST(makeRequest("http://localhost/api/events", {
      method: "POST",
      body: {
        title: "Sortie scolaire",
        description: "Sortie au musée",
        type: "FIELD_TRIP",
        startDate: "2026-09-01T09:00:00Z",
        endDate: "2026-09-01T17:00:00Z",
        location: "Musée",
        maxParticipants: 30,
        fee: 0,
        requiresPermission: false,
        isPublished: true,
      },
    }));
    expect(res.status).toBe(201);
    expect(prisma.notification.createMany).toHaveBeenCalled();
  });

  it("should return 400 on invalid body", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    const res = await POST(makeRequest("http://localhost/api/events", {
      method: "POST",
      body: { title: "" },
    }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/events/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 404 when event not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue(null);
    const res = await GET_ONE(makeRequest("http://localhost/api/events/e1"), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school access", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue({ id: "e1", schoolId: FIXTURES.schoolB } as never);
    const res = await GET_ONE(makeRequest("http://localhost/api/events/e1"), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(403);
  });

  it("should return the event for an authorized user", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue({ id: "e1", schoolId: FIXTURES.schoolA } as never);
    const res = await GET_ONE(makeRequest("http://localhost/api/events/e1"), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/events/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should forbid non-admin roles", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    const res = await PATCH(makeRequest("http://localhost/api/events/e1", { method: "PATCH", body: { title: "T" } }), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(403);
  });

  it("should update an event", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue({ id: "e1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.schoolEvent.update).mockResolvedValue({ id: "e1", title: "Nouveau" } as never);

    const res = await PATCH(makeRequest("http://localhost/api/events/e1", { method: "PATCH", body: { title: "Nouveau" } }), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(200);
  });

  it("should return 404 when event missing", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue(null);
    const res = await PATCH(makeRequest("http://localhost/api/events/e1", { method: "PATCH", body: { title: "Nouveau" } }), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/events/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should unpublish the event", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue({ id: "e1", schoolId: FIXTURES.schoolA } as never);
    vi.mocked(prisma.schoolEvent.update).mockResolvedValue({ id: "e1", isPublished: false } as never);

    const res = await DELETE(makeRequest("http://localhost/api/events/e1", { method: "DELETE" }), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(200);
    expect(prisma.schoolEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPublished: false } })
    );
  });
});

describe("POST /api/events/[id]/participate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return 404 when event not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue(null);
    const res = await POST_PARTICIPATE(makeRequest("http://localhost/api/events/e1/participate", { method: "POST", body: { studentId: FIXTURES.studentA } }), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });

  it("should return 404 when student not found", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue({ id: "e1", schoolId: FIXTURES.schoolA, maxParticipants: 30, fee: null } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue(null);
    const res = await POST_PARTICIPATE(makeRequest("http://localhost/api/events/e1/participate", { method: "POST", body: { studentId: FIXTURES.studentA } }), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(404);
  });

  it("should forbid cross-school student", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue({ id: "e1", schoolId: FIXTURES.schoolA, maxParticipants: 30, fee: null } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "s1", schoolId: FIXTURES.schoolB, userId: "u2" } as never);
    const res = await POST_PARTICIPATE(makeRequest("http://localhost/api/events/e1/participate", { method: "POST", body: { studentId: FIXTURES.studentA } }), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(403);
  });

  it("should prevent double registration", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue({ id: "e1", schoolId: FIXTURES.schoolA, maxParticipants: 30, fee: null } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "s1", schoolId: FIXTURES.schoolA, userId: "u2" } as never);
    vi.mocked(prisma.eventParticipation.findUnique).mockResolvedValue({ id: "p1" } as never);
    const res = await POST_PARTICIPATE(makeRequest("http://localhost/api/events/e1/participate", { method: "POST", body: { studentId: FIXTURES.studentA } }), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(400);
  });

  it("should register the student and notify them", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER"));
    vi.mocked(prisma.schoolEvent.findUnique).mockResolvedValue({ id: "e1", schoolId: FIXTURES.schoolA, maxParticipants: 30, fee: null, title: "Sortie" } as never);
    vi.mocked(prisma.studentProfile.findUnique).mockResolvedValue({ id: "s1", schoolId: FIXTURES.schoolA, userId: "u2" } as never);
    vi.mocked(prisma.eventParticipation.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => {
      const tx = {
        eventParticipation: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue({ id: "p1", student: { user: { id: "u2", firstName: "A", lastName: "B" } } }),
        },
      };
      return (fn as (t: typeof tx) => Promise<unknown>)(tx);
    });

    const res = await POST_PARTICIPATE(makeRequest("http://localhost/api/events/e1/participate", { method: "POST", body: { studentId: FIXTURES.studentA } }), { params: Promise.resolve({ id: "e1" }) });
    expect(res.status).toBe(201);
    expect(prisma.notification.create).toHaveBeenCalled();
  });
});