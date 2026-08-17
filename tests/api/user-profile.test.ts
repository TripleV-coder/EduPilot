import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
import { auth } from "@/lib/auth";
import { makeRequest, makeSession, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import prisma from "@/lib/prisma";
import { GET, PATCH } from "@/app/api/user/profile/route";

const USER_ID = cuid("userprofile");

function user(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    email: "awa@school.bj",
    firstName: "Awa",
    lastName: "Dossou",
    phone: "0199001122",
    role: "PARENT",
    isActive: true,
    isTwoFactorEnabled: false,
    preferences: {},
    avatar: null,
    createdAt: new Date(),
    ...overrides,
  } as unknown as User;
}

function patchRequest(body: Record<string, unknown>) {
  return PATCH(
    makeRequest("http://localhost:3000/api/user/profile", { method: "PATCH", body })
  );
}

describe("GET /api/user/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeRequest("http://localhost:3000/api/user/profile"));
    expect(res.status).toBe(401);
  });

  it("retourne 404 si l'utilisateur n'existe pas", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const res = await GET(makeRequest("http://localhost:3000/api/user/profile"));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Utilisateur introuvable");
  });

  it("retourne le profil du user connecté", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.findUnique).mockResolvedValue(user({ studentProfile: null }) as never);

    const res = await GET(makeRequest("http://localhost:3000/api/user/profile"));
    expect(res.status).toBe(200);
    expect((await res.json()).email).toBe("awa@school.bj");
  });

  it("retourne 500 si la lecture échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error("db down"));

    const res = await GET(makeRequest("http://localhost:3000/api/user/profile"));
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/user/profile", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await patchRequest({ firstName: "Awa" });
    expect(res.status).toBe(401);
  });

  it("retourne 400 sur un prénom trop court après trim", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    const res = await patchRequest({ firstName: "A" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Donnees invalides");
  });

  it("neutralise le HTML dans les champs texte (anti-XSS)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.update).mockResolvedValue(user({ firstName: "Paul" }) as never);

    const res = await patchRequest({ firstName: "Paul<script>alert(1)</script>" });
    expect(res.status).toBe(200);
    const updateArgs = vi.mocked(prisma.user.update).mock.calls[0][0];
    // sanitizePlainText retire les balises (le texte JS reste, sans <script>)
    expect(updateArgs.data.firstName).toBe("Paulalert(1)");
    expect(updateArgs.data.firstName).not.toContain("<script>");
  });

  it("met à jour le profil avec les champs fournis", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.update).mockResolvedValue(user({ phone: "0606060606" }) as never);

    const res = await patchRequest({ firstName: "Awa", lastName: "Dossou", phone: "0606060606" });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.user.update)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: USER_ID },
        data: expect.objectContaining({ firstName: "Awa", lastName: "Dossou", phone: "0606060606" }),
      })
    );
  });

  it("accepte un téléphone null (retrait)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.update).mockResolvedValue(user({ phone: null }) as never);

    const res = await patchRequest({ phone: null });
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.user.update).mock.calls[0][0].data.phone).toBeNull();
  });

  it("retourne 500 si la mise à jour échoue", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("PARENT", { id: USER_ID }));
    vi.mocked(prisma.user.update).mockRejectedValue(new Error("db down"));

    const res = await patchRequest({ firstName: "Awa" });
    expect(res.status).toBe(500);
  });
});