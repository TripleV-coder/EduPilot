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
vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    $disconnect: vi.fn(),
    $connect: vi.fn(),
    $transaction: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
    auditLog: { create: vi.fn() },
  })),
  UserRole: {
    SUPER_ADMIN: "SUPER_ADMIN",
    SCHOOL_ADMIN: "SCHOOL_ADMIN",
    DIRECTOR: "DIRECTOR",
    TEACHER: "TEACHER",
    STUDENT: "STUDENT",
    PARENT: "PARENT",
    ACCOUNTANT: "ACCOUNTANT",
  },
}));

// Mock next/server for NextResponse
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({
      status: init?.status || 200,
      json: async () => body,
      headers: new Map(),
    }),
    next: () => ({
      status: 200,
      headers: new Map(),
    }),
    redirect: (url: string) => ({
      status: 302,
      headers: new Map([["location", url]]),
    }),
  },
  NextRequest: vi.fn(),
}));

beforeAll(async () => {
  // Setup test environment if needed
});

afterAll(async () => {
  // Cleanup
});

beforeEach(async () => {
  // Reset mocks between tests
});
