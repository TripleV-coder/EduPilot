import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import { GET } from "@/app/api/uploads/[type]/[filename]/route";
import { auth } from "@/lib/auth";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { makeRequest, makeSession, FIXTURES, cuid } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
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
vi.mock("fs/promises", () => ({
  readFile: vi.fn(),
}));
vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

const OWNER = makeSession("TEACHER", { id: cuid("user1") });
const ADMIN = makeSession("SCHOOL_ADMIN", { id: cuid("user2") });

function makeManifestEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: cuid("file1"),
    uploaderId: cuid("user1"),
    schoolId: FIXTURES.schoolA,
    type: "avatar",
    originalFilename: "photo-de-profil.png",
    storedFilename: "abc123.png",
    url: "/api/uploads/avatar/abc123.png",
    mimeType: "image/png",
    size: 1024,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeUploadRequest(url: string) {
  return makeRequest(url) as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readFile).mockImplementation(async (p: unknown) => {
    const filePath = String(p);
    if (filePath.endsWith(".upload-manifest.json")) {
      return JSON.stringify([makeManifestEntry()]);
    }
    if (filePath.endsWith(".upload-manifest.jsonl")) {
      return "";
    }
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
  });
  vi.mocked(existsSync).mockImplementation((p: unknown) => {
    const filePath = String(p);
    return filePath.includes(".upload-manifest");
  });
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

  it("should return 404 when the file is not in the manifest", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    vi.mocked(readFile).mockResolvedValue("[]");
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/ghost.png"), { params: Promise.resolve({ type: "avatar", filename: "ghost.png" }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Fichier introuvable");
  });

  it("should return 404 when the file is missing on disk", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(404);
  });

  it("should serve the file to its owner with content headers", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const filePath = String(p);
      return filePath.includes(".upload-manifest") || filePath.endsWith("abc123.png");
    });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(res.headers.get("Content-Disposition")).toBeNull();
    expect(readFile).toHaveBeenCalled();
  });

  it("should allow same-school admins and directors", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const filePath = String(p);
      return filePath.includes(".upload-manifest") || filePath.endsWith("abc123.png");
    });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(200);
  });

  it("should deny same-school teachers for sensitive document types", async () => {
    vi.mocked(auth).mockResolvedValue(OWNER);
    vi.mocked(readFile).mockImplementation(async (p: unknown) => {
      const filePath = String(p);
      if (filePath.endsWith(".upload-manifest.json")) {
        return JSON.stringify([makeManifestEntry({ type: "document", storedFilename: "doc1.pdf", mimeType: "application/pdf", originalFilename: "bulletin.pdf", uploaderId: cuid("user9") })]);
      }
      if (filePath.endsWith(".upload-manifest.jsonl")) {
        return "";
      }
      return new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
    });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/document/doc1.pdf"), { params: Promise.resolve({ type: "document", filename: "doc1.pdf" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Accès refusé");
  });

  it("should allow teachers to read non-sensitive files from the same school", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER", { id: cuid("user3") }));
    vi.mocked(readFile).mockImplementation(async (p: unknown) => {
      const filePath = String(p);
      if (filePath.endsWith(".upload-manifest.json")) {
        return JSON.stringify([makeManifestEntry({ type: "general", storedFilename: "doc1.txt", mimeType: "text/plain", originalFilename: "notes.txt" })]);
      }
      if (filePath.endsWith(".upload-manifest.jsonl")) {
        return "";
      }
      return new Uint8Array([0x61]).buffer;
    });
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const filePath = String(p);
      return filePath.includes(".upload-manifest") || filePath.endsWith("doc1.txt");
    });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/general/doc1.txt"), { params: Promise.resolve({ type: "general", filename: "doc1.txt" }) });
    expect(res.status).toBe(200);
  });

  it("should add a Content-Disposition header for non-image downloads", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(readFile).mockImplementation(async (p: unknown) => {
      const filePath = String(p);
      if (filePath.endsWith(".upload-manifest.json")) {
        return JSON.stringify([makeManifestEntry({ type: "justification", storedFilename: "j1.pdf", mimeType: "application/pdf", originalFilename: "justificatif.pdf" })]);
      }
      if (filePath.endsWith(".upload-manifest.jsonl")) {
        return "";
      }
      return new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer;
    });
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const filePath = String(p);
      return filePath.includes(".upload-manifest") || filePath.endsWith("j1.pdf");
    });
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
    vi.mocked(readFile).mockImplementation(async (p: unknown) => {
      const filePath = String(p);
      if (filePath.endsWith(".upload-manifest.json")) {
        return JSON.stringify([makeManifestEntry({ schoolId: null, uploaderId: cuid("other") })]);
      }
      if (filePath.endsWith(".upload-manifest.jsonl")) {
        return "";
      }
      return new Uint8Array([0x89]).buffer;
    });
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const filePath = String(p);
      return filePath.includes(".upload-manifest") || filePath.endsWith("abc123.png");
    });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(200);
  });

  it("should return 500 when reading the file fails", async () => {
    vi.mocked(auth).mockResolvedValue(ADMIN);
    vi.mocked(readFile).mockImplementation(async (p: unknown) => {
      const filePath = String(p);
      if (filePath.endsWith(".upload-manifest.json")) {
        return JSON.stringify([makeManifestEntry()]);
      }
      if (filePath.endsWith(".upload-manifest.jsonl")) {
        return "";
      }
      throw new Error("EACCES");
    });
    vi.mocked(existsSync).mockImplementation((p: unknown) => {
      const filePath = String(p);
      return filePath.includes(".upload-manifest") || filePath.endsWith("abc123.png");
    });
    const res = await GET(makeUploadRequest("http://localhost/api/uploads/avatar/abc123.png"), { params: Promise.resolve({ type: "avatar", filename: "abc123.png" }) });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Erreur lors de la récupération du fichier");
  });
});