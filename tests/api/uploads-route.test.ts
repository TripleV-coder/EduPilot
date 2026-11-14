import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "@/app/api/uploads/[type]/[filename]/route";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: { storedFile: { findUnique: vi.fn() } },
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  class MockNextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      return new MockNextResponse(JSON.stringify(body), { ...init, headers });
    }
  }
  return { ...actual, NextResponse: MockNextResponse };
});

const OWNER = makeSession("TEACHER", { id: cuid("user1") });
const ADMIN = makeSession("SCHOOL_ADMIN", { id: cuid("user2") });

/** Ligne `stored_files` telle que la renvoie Prisma (contenu compris). */
function makeStoredRow(overrides: Record<string, unknown> = {}) {
  return {
    type: "avatar",
    storedFilename: "abc123.png",
    originalFilename: "photo-de-profil.png",
    mimeType: "image/png",
    size: 4,
    uploaderId: cuid("user1"),
    schoolId: FIXTURES.schoolA,
    createdAt: new Date(),
    data: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    ...overrides,
  };
}

function stored(overrides: Record<string, unknown> = {}) {
  vi.mocked(prisma.storedFile.findUnique).mockResolvedValue(makeStoredRow(overrides) as never);
}

function makeUploadRequest(url: string) {
  return makeRequest(url) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  stored();
});

describe("GET /api/uploads/[type]/[filename]", () => {
  it("should return 401 without session", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(401);
  });

  it("should return 400 for a disallowed upload type", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/secret/abc123.png"), { params: Promise.resolve({ type: "secret", filename: "abc123.png" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Paramètres invalides");
  });

  it("should return 400 for an unsafe filename (path traversal)", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/../../etc/passwd"), { params: Promise.resolve({ type: "avatar", filename: "../../etc/passwd" }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Paramètres invalides");
  });

  it("should return 404 when the file does not exist", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    vi.mocked(prisma.storedFile.findUnique).mockResolvedValue(null);
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/ghost.png"), { params: Promise.resolve({ type: "avatar", filename: "ghost.png" }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Fichier introuvable");
  });

  it("should return 404 when the stored type does not match the URL", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    stored({ type: "justification" });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(404);
  });

  it("should serve the file to its owner with content headers", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Length")).toBe("4");
    // Audit MS-03 : un fichier privé n'est jamais conservé par le navigateur
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("Content-Disposition")).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0x89, 0x50, 0x4e, 0x47]));
  });

  it("should allow same-school admins and directors", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(200);
  });

  it("should deny same-school teachers for sensitive document types", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    stored({ type: "document", storedFilename: "doc1.pdf", mimeType: "application/pdf", originalFilename: "bulletin.pdf", uploaderId: cuid("user9") });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/document/doc1.pdf"), { params: Promise.resolve({ type: "document", filename: "doc1.pdf" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("should allow teachers to read non-sensitive files from the same school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("user3") }));
    stored({ type: "general", storedFilename: "doc1.txt", mimeType: "text/plain", originalFilename: "notes.txt" });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/general/doc1.txt"), { params: Promise.resolve({ type: "general", filename: "doc1.txt" }) });
    expect(res.status).toBe(200);
  });

  it("should add a Content-Disposition header for non-image downloads", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    stored({ type: "justification", storedFilename: "j1.pdf", mimeType: "application/pdf", originalFilename: "justificatif.pdf" });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/justification/j1.pdf"), { params: Promise.resolve({ type: "justification", filename: "j1.pdf" }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="justificatif.pdf"');
  });

  it("should deny files from another school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SCHOOL_ADMIN", { id: cuid("user2"), schoolId: FIXTURES.schoolB }));
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(403);
  });

  it("should allow SUPER_ADMIN to read any file", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("SUPER_ADMIN", { id: "root1", email: "root@edupilot.app" }));
    stored({ schoolId: null, uploaderId: cuid("other") });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(200);
  });

  it("should return 500 when reading the file fails", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(prisma.storedFile.findUnique).mockRejectedValue(new Error("connexion perdue"));
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération du fichier");
  });
});