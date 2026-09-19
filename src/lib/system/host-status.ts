/**
 * État de la machine pour l'exploitant (Lot 7).
 *
 * L'application tourne sur une machine locale, sans hébergeur pour surveiller
 * à sa place : trois questions doivent trouver leur réponse depuis l'écran
 * d'administration, sans ouvrir un terminal. Reste-t-il de la place ? De la
 * mémoire ? La dernière sauvegarde a-t-elle réussi, et quand ?
 *
 * Aucun chemin du serveur n'est renvoyé (audit L5) : seuls des nombres.
 */
import { readdir, readFile, statfs } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/** Au-delà, la sauvegarde quotidienne a manqué au moins deux fois. */
const BACKUP_STALE_HOURS = 48;

export const DEFAULT_BACKUP_DIR = "/var/backups/edupilot/postgres";

export interface MemoryStatus {
    /** Empreinte du processus applicatif. */
    rssMb: number;
    heapUsedMb: number;
    /** Mémoire de la machine. */
    totalMb: number;
    freeMb: number;
    usedPercent: number;
}

export interface DiskStatus {
    totalGb: number;
    freeGb: number;
    usedPercent: number;
}

export type BackupHealth = "ok" | "stale" | "none" | "unavailable";

export interface BackupStatus {
    status: BackupHealth;
    /** Horodatage de la dernière sauvegarde vérifiée, ISO. */
    lastSuccessAt: string | null;
    ageHours: number | null;
    sizeBytes: number | null;
    /** Nombre d'archives conservées. */
    archives: number;
    /** Lignes recomptées dans la dernière archive (somme du manifeste). */
    rowCount: number | null;
}

export interface HostStatus {
    memory: MemoryStatus;
    disk: DiskStatus | null;
    backup: BackupStatus;
    uptimeSeconds: number;
    nodeVersion: string;
}

function mb(bytes: number): number {
    return Math.round(bytes / (1024 * 1024));
}

function gb(bytes: number): number {
    return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
}

export function memoryStatus(): MemoryStatus {
    const { rss, heapUsed } = process.memoryUsage();
    const total = os.totalmem();
    const free = os.freemem();
    return {
        rssMb: mb(rss),
        heapUsedMb: mb(heapUsed),
        totalMb: mb(total),
        freeMb: mb(free),
        usedPercent: total > 0 ? Math.round(((total - free) / total) * 100) : 0,
    };
}

/**
 * Place restante sur le système de fichiers qui porte `dir`.
 * `null` quand la mesure est impossible (chemin absent, système sans statfs) :
 * une page d'exploitation ne tombe pas parce qu'une métrique manque.
 */
export async function diskStatus(dir: string = process.cwd()): Promise<DiskStatus | null> {
    try {
        const fsStat = await statfs(dir);
        const total = Number(fsStat.blocks) * Number(fsStat.bsize);
        // `bavail` = blocs disponibles à un utilisateur non privilégié : c'est
        // la place réellement utilisable, pas celle réservée à root.
        const free = Number(fsStat.bavail) * Number(fsStat.bsize);
        if (!Number.isFinite(total) || total <= 0) return null;
        return {
            totalGb: gb(total),
            freeGb: gb(free),
            usedPercent: Math.round(((total - free) / total) * 100),
        };
    } catch {
        return null;
    }
}

interface BackupManifest {
    createdAt?: string;
    sizeBytes?: number;
    rowCounts?: Record<string, number>;
}

/**
 * Dernière sauvegarde **vérifiée** : `postgres-backup.sh` n'écrit son manifeste
 * qu'après avoir relu l'archive chiffrée. Un manifeste est donc la preuve
 * qu'une sauvegarde relisible existe, pas seulement qu'un fichier a été créé.
 */
export async function backupStatus(
    dir: string = process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR,
    now: Date = new Date(),
): Promise<BackupStatus> {
    const empty: BackupStatus = {
        status: "unavailable",
        lastSuccessAt: null,
        ageHours: null,
        sizeBytes: null,
        archives: 0,
        rowCount: null,
    };

    let entries: string[];
    try {
        entries = await readdir(dir);
    } catch {
        return empty;
    }

    const manifests = entries.filter((f) => f.endsWith(".meta.json"));
    const archives = entries.filter((f) => f.endsWith(".sql.gz.enc") || f.endsWith(".sql.gz"));
    if (manifests.length === 0) {
        return { ...empty, status: "none", archives: archives.length };
    }

    let latest: BackupManifest | null = null;
    let latestTime = -Infinity;
    for (const file of manifests) {
        try {
            const parsed = JSON.parse(await readFile(path.join(dir, file), "utf8")) as BackupManifest;
            const time = parsed.createdAt ? Date.parse(parsed.createdAt) : NaN;
            if (!Number.isFinite(time)) continue;
            if (time > latestTime) {
                latestTime = time;
                latest = parsed;
            }
        } catch {
            // Manifeste illisible : ignoré. Une archive abîmée ne doit pas
            // empêcher de voir les autres.
        }
    }

    if (!latest) return { ...empty, status: "none", archives: archives.length };

    const ageHours = Math.round(((now.getTime() - latestTime) / 3_600_000) * 10) / 10;
    const rowCounts = latest.rowCounts;
    return {
        status: ageHours > BACKUP_STALE_HOURS ? "stale" : "ok",
        lastSuccessAt: new Date(latestTime).toISOString(),
        ageHours,
        sizeBytes: typeof latest.sizeBytes === "number" ? latest.sizeBytes : null,
        archives: archives.length,
        rowCount: rowCounts ? Object.values(rowCounts).reduce((sum, n) => sum + (Number(n) || 0), 0) : null,
    };
}

export async function hostStatus(): Promise<HostStatus> {
    const backupDir = process.env.BACKUP_DIR || DEFAULT_BACKUP_DIR;
    const [disk, backup] = await Promise.all([diskStatus(), backupStatus(backupDir)]);
    return {
        memory: memoryStatus(),
        disk,
        backup,
        uptimeSeconds: Math.floor(process.uptime()),
        nodeVersion: process.version,
    };
}
