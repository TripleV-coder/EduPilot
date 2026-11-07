import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import path from "path";
import { nanoid } from "nanoid";
import { listUploadsBy, saveUploadedFile, UPLOAD_TYPES, type UploadType } from "@/lib/storage/stored-files";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

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

/**
 * POST /api/upload
 * Upload files (images, documents)
 */
export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

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

    // Type limité à une liste fermée (jamais utilisé tel quel)
    const sanitizedType: UploadType = (UPLOAD_TYPES as readonly string[]).includes(type) ? (type as UploadType) : "general";

    // Nom unique ; l'extension est réduite à des caractères sûrs
    const ext = path.extname(file.name).replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10);
    const filename = `${nanoid()}_${Date.now()}${ext}`;

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

    const saved = await saveUploadedFile({
      type: sanitizedType,
      storedFilename: filename,
      originalFilename: file.name,
      mimeType: file.type,
      data: buffer,
      uploaderId: session.user.id,
      schoolId: getActiveSchoolId(session) ?? null,
    });
    const publicUrl = saved.url;

    // Avatar : rattaché au profil
    if (sanitizedType === "avatar") {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { avatar: publicUrl },
      });
    }

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

  // Fichier de 5 Mo + enveloppe multipart (champs, en-têtes de parties).
}, { maxBodyBytes: MAX_FILE_SIZE + 256 * 1024 });

/**
 * GET /api/upload
 * List user's uploaded files
 */
export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

    const files = await listUploadsBy(session.user.id);

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

});

