import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir, readFile, appendFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const UPLOAD_MANIFEST_PATH = path.join(UPLOAD_DIR, ".upload-manifest.json");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

/**
 * Magic bytes signatures for server-side file type validation.
 * Prevents MIME spoofing attacks where client sends a fake Content-Type.
 */
const MAGIC_BYTES: Record<string, { offset: number; bytes: number[] }[]> = {
  "image/jpeg": [{ offset: 0, bytes: [0xFF, 0xD8, 0xFF] }],
  "image/png": [{ offset: 0, bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
  "image/gif": [{ offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8
  "image/webp": [
    { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
    { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] }, // WEBP
  ],
  "application/pdf": [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF
  // MS Office (old format) and OOXML (zip-based) share PK signature
  "application/msword": [{ offset: 0, bytes: [0xD0, 0xCF, 0x11, 0xE0] }],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [{ offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] }],
  "application/vnd.ms-excel": [{ offset: 0, bytes: [0xD0, 0xCF, 0x11, 0xE0] }],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [{ offset: 0, bytes: [0x50, 0x4B, 0x03, 0x04] }],
};

type UploadManifestEntry = {
  id: string;
  uploaderId: string;
  schoolId: string | null;
  type: string;
  originalFilename: string;
  storedFilename: string;
  url: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

function validateMagicBytes(buffer: Buffer, claimedType: string): boolean {
  const signatures = MAGIC_BYTES[claimedType];
  if (!signatures) return false;

  for (const sig of signatures) {
    if (buffer.length < sig.offset + sig.bytes.length) return false;
    const match = sig.bytes.every((byte, i) => buffer[sig.offset + i] === byte);
    if (!match) return false;
  }
  return true;
}

const UPLOAD_MANIFEST_PATH_JSONL = path.join(UPLOAD_DIR, ".upload-manifest.jsonl");

async function readUploadManifest(): Promise<UploadManifestEntry[]> {
  let entries: UploadManifestEntry[] = [];

  if (existsSync(UPLOAD_MANIFEST_PATH)) {
    try {
      const content = await readFile(UPLOAD_MANIFEST_PATH, "utf8");
      entries = JSON.parse(content) as UploadManifestEntry[];
    } catch { }
  }

  if (existsSync(UPLOAD_MANIFEST_PATH_JSONL)) {
    try {
      const content = await readFile(UPLOAD_MANIFEST_PATH_JSONL, "utf8");
      const lines = content.split('\n').filter(line => line.trim() !== '');
      entries = entries.concat(lines.map(line => JSON.parse(line)));
    } catch { }
  }

  return entries;
}

/**
 * POST /api/upload
 * Upload files (images, documents)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as string; // 'avatar' | 'document' | 'justification'

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux (max 5MB)" },
        { status: 400 }
      );
    }

    // Validate file type
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
    const isDocument = ALLOWED_DOCUMENT_TYPES.includes(file.type);

    if (!isImage && !isDocument) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé" },
        { status: 400 }
      );
    }

    // For avatar, must be image
    if (type === "avatar" && !isImage) {
      return NextResponse.json(
        { error: "L'avatar doit être une image" },
        { status: 400 }
      );
    }

    // Sanitize type parameter to prevent path traversal
    const ALLOWED_UPLOAD_TYPES = ["avatar", "document", "justification", "general"];
    const sanitizedType = type && ALLOWED_UPLOAD_TYPES.includes(type) ? type : "general";

    // Create upload directory if doesn't exist
    const typeDir = path.join(UPLOAD_DIR, sanitizedType);
    if (!existsSync(typeDir)) {
      await mkdir(typeDir, { recursive: true });
    }

    // Generate unique filename
    const ext = path.extname(file.name);
    const filename = `${nanoid()}_${Date.now()}${ext}`;
    const filepath = path.join(typeDir, filename);

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Server-side magic bytes validation (prevents MIME spoofing)
    if (!validateMagicBytes(buffer, file.type)) {
      return NextResponse.json(
        { error: "Le contenu du fichier ne correspond pas au type déclaré" },
        { status: 400 }
      );
    }

    // Write file
    await writeFile(filepath, buffer);

    // Return private URL (served via authenticated API route)
    const publicUrl = `/api/uploads/${sanitizedType}/${filename}`;

    // If avatar, update user profile
    if (type === "avatar") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { avatar: publicUrl },
      });
    }

    const entry: UploadManifestEntry = {
      id: nanoid(),
      uploaderId: session.user.id,
      schoolId: getActiveSchoolId(session) ?? null,
      type: sanitizedType,
      originalFilename: file.name,
      storedFilename: filename,
      url: publicUrl,
      mimeType: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
    };

    // Atomic append to prevent read-modify-write race conditions under high concurrency
    await appendFile(UPLOAD_MANIFEST_PATH_JSONL, JSON.stringify(entry) + '\n', "utf8");

    return NextResponse.json(
      {
        success: true,
        url: publicUrl,
        filename: file.name,
        size: file.size,
        type: file.type,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error(" uploading file:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors du téléchargement du fichier" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/upload
 * List user's uploaded files
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const manifestEntries = await readUploadManifest();
    const files = manifestEntries
      .filter((entry) => entry.uploaderId === session.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return NextResponse.json({
      files,
    });
  } catch (error) {
    logger.error(" fetching files:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des fichiers" },
      { status: 500 }
    );
  }
}
