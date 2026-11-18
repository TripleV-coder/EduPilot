/**
 * Fichiers envoyés (avatars, justificatifs, documents) — stockés en base.
 *
 * Pourquoi en base : aucun disque persistant n'est requis (hébergement sans
 * serveur), les fichiers sont sauvegardés et restaurés avec la base, et
 * l'école reste propriétaire de ses données sans service de stockage tiers.
 * Limite : 5 Mo par fichier (route /api/upload), adaptée aux justificatifs et
 * photos d'identité.
 *
 * Aucun accès disque ici, volontairement : un chemin calculé depuis
 * `process.cwd()` fait embarquer tout le projet dans le paquet de production
 * (traçage des fichiers de Next). L'ancien dossier `uploads/` n'est plus lu
 * (décision du 2026-11-07 : fichiers existants remplaçables).
 */
import prisma from "@/lib/prisma";

export const UPLOAD_TYPES = ["avatar", "document", "justification", "general"] as const;
export type UploadType = (typeof UPLOAD_TYPES)[number];

export interface StoredFileEntry {
    type: string;
    storedFilename: string;
    originalFilename: string;
    mimeType: string;
    size: number;
    uploaderId: string;
    schoolId: string | null;
    createdAt: string;
    url: string;
}

export const fileUrl = (type: string, storedFilename: string) => `/api/uploads/${type}/${storedFilename}`;

const META_SELECT = {
    type: true,
    storedFilename: true,
    originalFilename: true,
    mimeType: true,
    size: true,
    uploaderId: true,
    schoolId: true,
    createdAt: true,
} as const;

export async function saveUploadedFile(input: {
    type: UploadType;
    storedFilename: string;
    originalFilename: string;
    mimeType: string;
    data: Buffer;
    uploaderId: string;
    schoolId: string | null;
}): Promise<StoredFileEntry> {
    const row = await prisma.storedFile.create({
        data: {
            type: input.type,
            storedFilename: input.storedFilename,
            originalFilename: input.originalFilename,
            mimeType: input.mimeType,
            size: input.data.length,
            data: new Uint8Array(input.data),
            uploaderId: input.uploaderId,
            schoolId: input.schoolId,
        },
        select: META_SELECT,
    });
    return { ...row, createdAt: row.createdAt.toISOString(), url: fileUrl(row.type, row.storedFilename) };
}

/** Métadonnées et contenu d'un fichier, ou null s'il n'existe pas (ou pas sous ce type). */
export async function findStoredFile(type: string, storedFilename: string): Promise<{ entry: StoredFileEntry; data: Buffer } | null> {
    const row = await prisma.storedFile.findUnique({ where: { storedFilename }, select: { ...META_SELECT, data: true } });
    if (!row || row.type !== type) return null;
    const { data, createdAt, ...meta } = row;
    return {
        entry: { ...meta, createdAt: createdAt.toISOString(), url: fileUrl(row.type, row.storedFilename) },
        data: Buffer.from(data),
    };
}

/** Fichiers envoyés par une personne, du plus récent au plus ancien. */
export async function listUploadsBy(uploaderId: string): Promise<StoredFileEntry[]> {
    const rows = await prisma.storedFile.findMany({ where: { uploaderId }, orderBy: { createdAt: "desc" }, select: META_SELECT });
    return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), url: fileUrl(row.type, row.storedFilename) }));
}
