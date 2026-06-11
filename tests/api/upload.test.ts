import { describe, it, expect, vi, beforeEach } from "vitest";
import { auth } from "@/lib/auth";
import { makeSession } from "./test-helpers";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { update: vi.fn() },
  },
}));
vi.mock("fs/promises", () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue("[]"),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("fs", () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

import prisma from "@/lib/prisma";
import { writeFile } from "fs/promises";
import { POST } from "@/app/api/upload/route";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Fichier simulé : seul l'octet près, ce que la route lit réellement. */
function makeFile(options: {
  name: string;
  type: string;
  bytes: number[];
  size?: number;
}) {
  const buffer = Uint8Array.from(options.bytes);
  return {
    name: options.name,
    type: options.type,
    size: options.size ?? buffer.byteLength,
    arrayBuffer: async () => buffer.buffer,
  };
}

function makeUploadRequest(file: unknown, type = "document") {
  const formData = new Map<string, unknown>([
    ["file", file],
    ["type", type],
  ]);
  return {
    url: "http://localhost:3000/api/upload",
    formData: async () => formData,
     
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/upload — validation magic bytes", () => {
  it("retourne 401 sans session", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await POST(makeUploadRequest(null));
    expect(response.status).toBe(401);
  });

  it("retourne 400 sans fichier", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);

    const response = await POST(makeUploadRequest(null));
    expect(response.status).toBe(400);
  });

  it("rejette un fichier trop volumineux (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    const file = makeFile({
      name: "gros.png",
      type: "image/png",
      bytes: PNG_MAGIC,
      size: 6 * 1024 * 1024,
    });

    const response = await POST(makeUploadRequest(file));
    expect(response.status).toBe(400);
  });

  it("rejette un type MIME non autorisé (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    const file = makeFile({
      name: "script.svg",
      type: "image/svg+xml",
      bytes: [0x3c, 0x73, 0x76, 0x67],
    });

    const response = await POST(makeUploadRequest(file));
    expect(response.status).toBe(400);
  });

  it("anti-spoofing : rejette un exécutable déguisé en PNG (400, rien n'est écrit)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    // En-tête ELF, Content-Type menteur
    const file = makeFile({
      name: "innocent.png",
      type: "image/png",
      bytes: [0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00],
    });

    const response = await POST(makeUploadRequest(file));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("ne correspond pas au type déclaré");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("anti-spoofing : rejette un PDF déclaré JPEG (400)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    const file = makeFile({
      name: "photo.jpg",
      type: "image/jpeg",
      bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], // %PDF-
    });

    const response = await POST(makeUploadRequest(file));
    expect(response.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("exige une image pour un avatar (400 si PDF)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    const file = makeFile({
      name: "cv.pdf",
      type: "application/pdf",
      bytes: [0x25, 0x50, 0x44, 0x46, 0x2d],
    });

    const response = await POST(makeUploadRequest(file, "avatar"));
    expect(response.status).toBe(400);
  });

  it("accepte un vrai PNG en avatar (201) et met à jour le profil", async () => {
    const session = makeSession("TEACHER");
    vi.mocked(auth).mockResolvedValue(session as any);
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);
    const file = makeFile({ name: "avatar.png", type: "image/png", bytes: PNG_MAGIC });

    const response = await POST(makeUploadRequest(file, "avatar"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.url).toMatch(/^\/api\/uploads\/avatar\//);
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(vi.mocked(prisma.user.update).mock.calls[0][0]).toMatchObject({
      where: { id: session.user!.id },
      data: { avatar: expect.stringMatching(/^\/api\/uploads\/avatar\//) },
    });
  });

  it("neutralise un type d'upload inconnu vers 'general' (anti path traversal)", async () => {
    vi.mocked(auth).mockResolvedValue(makeSession("TEACHER") as any);
    const file = makeFile({ name: "doc.png", type: "image/png", bytes: PNG_MAGIC });

    const response = await POST(makeUploadRequest(file, "../../etc"));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.url).toMatch(/^\/api\/uploads\/general\//);
  });
});
