import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { logger } from "@/lib/utils/logger";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const UPLOAD_MANIFEST_PATH = path.join(UPLOAD_DIR, ".upload-manifest.json");
const ALLOWED_UPLOAD_TYPES = ["avatar", "document", "justification", "general"];

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

function isSafeSegment(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

const UPLOAD_MANIFEST_PATH_JSONL = path.join(UPLOAD_DIR, ".upload-manifest.jsonl");

async function readUploadManifest(): Promise<UploadManifestEntry[]> {
  let entries: UploadManifestEntry[] = [];

  if (existsSync(UPLOAD_MANIFEST_PATH)) {
    try {
      const content = await readFile(UPLOAD_MANIFEST_PATH, "utf8");
      entries = JSON.parse(content) as UploadManifestEntry[];
    } catch (error) {
      // Manifeste illisible/corrompu : on continue avec la liste vide,
      // mais jamais silencieusement.
      logger.warn("Upload manifest JSON illisible — ignoré", {
        module: "api/upload",
        path: UPLOAD_MANIFEST_PATH,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (existsSync(UPLOAD_MANIFEST_PATH_JSONL)) {
    try {
      const content = await readFile(UPLOAD_MANIFEST_PATH_JSONL, "utf8");
      const lines = content.split('\n').filter(line => line.trim() !== '');
      entries = entries.concat(lines.map(line => JSON.parse(line)));
    } catch (error) {
      logger.warn("Upload manifest JSONL illisible — ignoré", {
        module: "api/upload",
        path: UPLOAD_MANIFEST_PATH_JSONL,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return entries;
}

export const GET = createApiHandler(async (request, context) => {
    try {
        const { type, filename } = await context.params;
        const session = context.session;

    if (!type || !filename) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    if (!ALLOWED_UPLOAD_TYPES.includes(type) || !isSafeSegment(filename)) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    }

    const manifestEntries = await readUploadManifest();
    const entry = manifestEntries.find(
      (item) => item.type === type && item.storedFilename === filename
    );

    if (!entry) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const isOwner = entry.uploaderId === session.user.id;
    const sameSchool = entry.schoolId && session.user.schoolId === entry.schoolId;

    // Type-based access control: restrict sensitive document types
    const SENSITIVE_TYPES = ["document", "justification"];
    const isAdmin = roleSatisfies(session.user.role, ["SCHOOL_ADMIN", "DIRECTOR"]);
    const isTeacher = session.user.role === "TEACHER";

    let hasAccess = false;
    if (isSuperAdmin) {
      hasAccess = true;
    } else if (isOwner) {
      hasAccess = true;
    } else if (isAdmin && sameSchool) {
      hasAccess = true; // Admins/directors can access all school files
    } else if (isTeacher && sameSchool && !SENSITIVE_TYPES.includes(entry.type)) {
      hasAccess = true; // Teachers can only access non-sensitive files (avatars, general)
    } else if (sameSchool && entry.type === "avatar") {
      hasAccess = true; // Any staff can view avatars from same school
    }

    if (!hasAccess) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const filePath = path.join(UPLOAD_DIR, type, filename);
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);

    const headers = new Headers({
      "Content-Type": entry.mimeType || "application/octet-stream",
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "private, max-age=3600",
    });

    if (!entry.mimeType?.startsWith("image/")) {
      const safeName = isSafeSegment(entry.originalFilename)
        ? entry.originalFilename
        : "document";
      headers.set("Content-Disposition", `attachment; filename=\"${safeName}\"`);
    }

    return new NextResponse(fileBuffer, { headers });
  
    } catch (error) {
    logger.error("Error serving upload", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du fichier" },
      { status: 500 }
    );
  }

});
