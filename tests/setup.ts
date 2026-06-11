import { beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mocks globaux pour éviter le chargement de next-auth (dépend de next/server)
vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn().mockResolvedValue(null),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
  getToken: vi.fn(),
}));
vi.mock("next-auth/react", () => ({ signIn: vi.fn(), signOut: vi.fn(), useSession: vi.fn() }));

// Mock PrismaClient since schema.prisma may not be generated
vi.mock("@prisma/client", () => {
  const mockPrisma = {
    $disconnect: vi.fn(),
    $connect: vi.fn(),
    $transaction: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn(), count: vi.fn() },
    school: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    class: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    classSubject: { findMany: vi.fn(), create: vi.fn() },
    studentProfile: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
    teacherProfile: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    parentProfile: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    enrollment: { findMany: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn(), findMany: vi.fn() },
    payment: { aggregate: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    attendance: { groupBy: vi.fn(), findMany: vi.fn() },
    academicYear: { findFirst: vi.fn(), findUnique: vi.fn() },
    period: { findMany: vi.fn() },
    organizationMembership: { findMany: vi.fn().mockResolvedValue([]), upsert: vi.fn() },
    organization: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  };

  // Classes d'erreur minimales pour que les `instanceof Prisma.PrismaClient*Error`
  // des routes et de createApiHandler fonctionnent en test.
  class PrismaClientKnownRequestError extends Error {
    code: string;
    meta?: Record<string, unknown>;
    constructor(message: string, options?: { code?: string; meta?: Record<string, unknown> }) {
      super(message);
      this.name = "PrismaClientKnownRequestError";
      this.code = options?.code ?? "P2000";
      this.meta = options?.meta;
    }
  }
  class PrismaClientValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "PrismaClientValidationError";
    }
  }

  return {
    PrismaClient: vi.fn(function() { return mockPrisma; }),
    Prisma: {
      PrismaClientKnownRequestError,
      PrismaClientValidationError,
    },
    UserRole: {
      SUPER_ADMIN: "SUPER_ADMIN",
      SCHOOL_ADMIN: "SCHOOL_ADMIN",
      DIRECTOR: "DIRECTOR",
      TEACHER: "TEACHER",
      STUDENT: "STUDENT",
      PARENT: "PARENT",
      ACCOUNTANT: "ACCOUNTANT",
      STAFF: "STAFF",
    },
    SiteType: {
      MAIN: "MAIN",
      ANNEXE: "ANNEXE",
    },
  };
});

// Mock next/server for NextResponse
// Le mock expose json/text/clone/headers pour supporter les middlewares de
// cache (withHttpCache lit response.clone().text(), withCache lit headers.entries()).
vi.mock("next/server", () => {
  function makeResponse(body: any, init?: any) {
    const headers = new Map<string, string>(
      init?.headers ? Object.entries(init.headers as Record<string, string>) : []
    );
    const response = {
      status: init?.status || 200,
      json: async () => body,
      text: async () => JSON.stringify(body ?? null),
      clone: () => response,
      headers,
    };
    return response;
  }

  return {
    NextResponse: {
      json: (body: any, init?: any) => makeResponse(body, init),
      next: () => makeResponse(null),
      redirect: (url: string) => makeResponse(null, { status: 302, headers: { location: url } }),
    },
    NextRequest: vi.fn(),
  };
});

beforeAll(async () => {
  // Setup test environment if needed
});

afterAll(async () => {
  // Cleanup
});

beforeEach(async () => {
  // Reset mocks between tests
});
