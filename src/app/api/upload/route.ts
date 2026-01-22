import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { logger } from "@/lib/utils/logger";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
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

    // Write file
    await writeFile(filepath, buffer);

    // Return public URL
    const publicUrl = `/uploads/${sanitizedType}/${filename}`;

    // If avatar, update user profile
    if (type === "avatar") {
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

    // In a real implementation, you'd track uploads in database
    // For now, return empty array
    return NextResponse.json({
      files: [],
      message: "Feature coming soon - file tracking in database",
    });
  } catch (error) {
    logger.error(" fetching files:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des fichiers" },
      { status: 500 }
    );
  }
}
