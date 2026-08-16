import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeRequest } from "./test-helpers";

const {
  findUniqueMock,
  deleteManyMock,
  createMock,
  checkRateLimitMock,
  sendPasswordResetEmailMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  deleteManyMock: vi.fn(),
  createMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  sendPasswordResetEmailMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: findUniqueMock },
    passwordResetToken: { deleteMany: deleteManyMock, create: createMock },
  },
}));
vi.mock("@/lib/rate-limit", () => ({
  authLimiter: { name: "auth" },
  checkRateLimit: checkRateLimitMock,
}));
vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

import { POST } from "@/app/api/auth/forgot-password/route";

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimitMock.mockResolvedValue({ success: true, remaining: 3, reset: new Date() });
  });

  it("retourne 400 si l'email est invalide", async () => {
    const response = await POST(
      makeRequest("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        body: { email: "pas-un-email" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Email invalide");
  });

  it("retourne 429 quand la limite est dépassée", async () => {
    checkRateLimitMock.mockResolvedValue({ success: false, remaining: 0, reset: new Date() });

    const response = await POST(
      makeRequest("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        body: { email: "awa@example.com" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("Trop de tentatives");
  });

  it("répond succès sans énumération si l'utilisateur est absent", async () => {
    findUniqueMock.mockResolvedValue(null);

    const response = await POST(
      makeRequest("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        body: { email: "awa@example.com" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(createMock).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("crée un token et envoie le mail si l'utilisateur actif existe", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user_1",
      email: "awa@example.com",
      firstName: "Awa",
      isActive: true,
    });
    deleteManyMock.mockResolvedValue({ count: 1 });
    createMock.mockResolvedValue({ id: "token_1" });
    sendPasswordResetEmailMock.mockResolvedValue(true);
    process.env.NEXT_PUBLIC_APP_URL = "https://edupilot.test";

    const response = await POST(
      makeRequest("http://localhost:3000/api/auth/forgot-password", {
        method: "POST",
        body: { email: "Awa@Example.com" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(deleteManyMock).toHaveBeenCalledWith({ where: { email: "awa@example.com" } });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "awa@example.com",
          userId: "user_1",
          token: expect.any(String),
        }),
      }),
    );
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "awa@example.com",
        firstName: "Awa",
        resetUrl: expect.stringContaining("https://edupilot.test/reset-password?token="),
      }),
    );
  });
});
