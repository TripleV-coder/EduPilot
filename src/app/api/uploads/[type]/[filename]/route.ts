import { NextResponse } from "next/server";
import { findStoredFile, UPLOAD_TYPES } from "@/lib/storage/stored-files";
import { logger } from "@/lib/utils/logger";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";

function isSafeSegment(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

export const GET = createApiHandler(async (request, context) => {
    try {
        const { type, filename } = await context.params;
        const session = context.session;

    if (!type || !filename) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    if (!(UPLOAD_TYPES as readonly string[]).includes(type) || !isSafeSegment(filename)) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    }

    const found = await findStoredFile(type, filename);
    if (!found) {
      return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
    }
    const { entry, data: fileBuffer } = found;

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

    const headers = new Headers({
      "Content-Type": entry.mimeType || "application/octet-stream",
      "Content-Length": String(fileBuffer.length),
      // Fichier d'un élève ou d'un membre du personnel : jamais conservé par
      // le navigateur ni par le service worker (audit MS-03)
      "Cache-Control": "private, no-store",
    });

    if (!entry.mimeType?.startsWith("image/")) {
      const safeName = isSafeSegment(entry.originalFilename)
        ? entry.originalFilename
        : "document";
      headers.set("Content-Disposition", `attachment; filename=\"${safeName}\"`);
    }

    return new NextResponse(new Uint8Array(fileBuffer), { headers });
  
    } catch (error) {
    logger.error("Error serving upload", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du fichier" },
      { status: 500 }
    );
  }

});
