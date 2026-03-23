import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/homework/route";
import { auth } from "@/lib/auth";

// Mock dependencies (explicit factory so route gets same mock)
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    homework: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    classSubject: {
      findUnique: vi.fn(),
    },
    teacherProfile: {
      findUnique: vi.fn(),
    },
    studentProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    parentProfile: {
      findUnique: vi.fn(),
    },
    enrollment: {
      findMany: vi.fn(),
    },
    notification: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api/cache-helpers", () => ({
  invalidateByPath: vi.fn(),
  CACHE_PATHS: { homework: "homework" },
}));

/** Helper to build a mock request with searchParams and json() for vitest */
function makeMockRequest(url: string, init?: { method?: string; body?: unknown }) {
  const parsedUrl = new URL(url);
  return {
    url,
    method: init?.method || "GET",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: init?.body ? () => Promise.resolve(init.body) : undefined,
    nextUrl: parsedUrl,
  } as any;
}

describe("GET /api/homework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = makeMockRequest("http://localhost:3000/api/homework");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("should return homework list for authenticated user", async () => {
    const { default: prisma } = await import("@/lib/prisma");
    const mockSession = {
      user: {
        id: "user1",
        role: "TEACHER",
        schoolId: "school1",
      },
    };

    vi.mocked(auth).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.teacherProfile.findUnique).mockResolvedValue({
      id: "tp1",
      classSubjects: [{ id: "cs1" }],
    } as any);
    vi.mocked(prisma.homework.findMany).mockResolvedValue([
      {
        id: "hw1",
        title: "Devoir 1",
        isPublished: true,
      },
    ] as any);
    vi.mocked(prisma.homework.count).mockResolvedValue(1);

    const request = makeMockRequest("http://localhost:3000/api/homework");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.homeworks).toBeDefined();
  });
});

describe("POST /api/homework", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = makeMockRequest("http://localhost:3000/api/homework", {
      method: "POST",
      body: {
        classSubjectId: "cs1",
        title: "Test",
        description: "Test description",
        dueDate: new Date().toISOString(),
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("should return 403 if user is not TEACHER or ADMIN", async () => {
    const mockSession = {
      user: {
        id: "user1",
        role: "STUDENT",
      },
    };

    vi.mocked(auth).mockResolvedValue(mockSession as any);

    const request = makeMockRequest("http://localhost:3000/api/homework", {
      method: "POST",
      body: {
        classSubjectId: "cs1",
        title: "Test",
        description: "Test description",
        dueDate: new Date().toISOString(),
      },
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBeDefined();
  });
});
