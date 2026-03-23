import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { logger } from "@/lib/utils/logger";
import { appEnv } from "@/lib/config/env";

const execAsync = promisify(exec);

/**
 * POST /api/system/backup
 * Déclencher une sauvegarde manuelle de la base de données
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Seuls les super admins peuvent déclencher des sauvegardes
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Garde-fou supplémentaire : cette API peut être entièrement désactivée par configuration
    if (!appEnv.allowBackupApi) {
      return NextResponse.json(
        { error: "Endpoint de sauvegarde désactivé par la configuration de la plateforme" },
        { status: 403 }
      );
    }

    const backupScript = path.join(
      process.cwd(),
      "scripts",
      "backup",
      "postgres-backup.sh"
    );

    // Vérifier que le script existe
    try {
      await fs.access(backupScript);
    } catch (_error) {
      return NextResponse.json(
        {
          error: "Script de sauvegarde non trouvé",
          path: backupScript,
        },
        { status: 404 }
      );
    }

    // Exécuter le script de sauvegarde
    const { stdout } = await execAsync(backupScript);

    // Parser la sortie pour extraire les informations
    const sizeMatch = stdout.match(/Taille de la sauvegarde: (.*)/);
    const checksumMatch = stdout.match(/Checksum SHA256: (.*)/);

    return NextResponse.json({
      success: true,
      message: "Sauvegarde créée avec succès",
      size: sizeMatch ? sizeMatch[1] : "N/A",
      checksum: checksumMatch ? checksumMatch[1] : "N/A",
      timestamp: new Date().toISOString(),
      logs: stdout,
    });
  } catch (error) {
    logger.error(" creating backup:", error as Error);
    return NextResponse.json(
      {
        error: "Erreur lors de la création de la sauvegarde",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/system/backup
 * Lister les sauvegardes disponibles
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Seuls les super admins peuvent voir les sauvegardes
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Même garde-fou que pour POST : possibilité de désactiver totalement la surface backup via config
    if (!appEnv.allowBackupApi) {
      return NextResponse.json(
        { error: "Listing des sauvegardes désactivé par la configuration de la plateforme" },
        { status: 403 }
      );
    }

    const backupDir = "/var/backups/edupilot/postgres";

    try {
      const files = await fs.readdir(backupDir);
      const backups = files.filter((f) => f.endsWith(".sql.gz"));

      const backupDetails = await Promise.all(
        backups.map(async (file) => {
          const filePath = path.join(backupDir, file);
          const stats = await fs.stat(filePath);
          const checksumPath = `${filePath}.sha256`;

          let checksum = null;
          try {
            checksum = (await fs.readFile(checksumPath, "utf-8")).trim();
          } catch (_e) {
            // Pas de checksum disponible
          }

          return {
            filename: file,
            path: filePath,
            size: stats.size,
            sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime,
            checksum,
          };
        })
      );

      // Trier par date décroissante
      backupDetails.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      return NextResponse.json({
        backups: backupDetails,
        count: backupDetails.length,
        totalSize: backupDetails.reduce((sum, b) => sum + b.size, 0),
        totalSizeFormatted: `${(backupDetails.reduce((sum, b) => sum + b.size, 0) / (1024 * 1024)).toFixed(2)} MB`,
      });
    } catch (_error) {
      // Répertoire n'existe pas encore
      return NextResponse.json({
        backups: [],
        count: 0,
        message: "Aucune sauvegarde trouvée",
      });
    }
  } catch (error) {
    logger.error(" listing backups:", error as Error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
