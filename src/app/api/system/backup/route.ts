import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { logger } from "@/lib/utils/logger";
import { appEnv } from "@/lib/env";
import { createApiHandler } from "@/lib/api/api-helpers";
import { checkBackupPrerequisites } from "@/lib/system/backup-prerequisites";

// execFile : le script est lancé sans shell (chemin issu de l'environnement)
const execFileAsync = promisify(execFile);

function isBackupApiAllowed(): boolean {
  if (!appEnv.allowBackupApi) return false;
  if (appEnv.isProduction && !appEnv.allowBackupApiInProduction) return false;
  return true;
}

/**
 * POST /api/system/backup
 * Déclencher une sauvegarde manuelle de la base de données
 */
export const POST = createApiHandler(async (request, context) => {
    try {


    // Garde-fou supplémentaire : cette API peut être entièrement désactivée par configuration
    if (!isBackupApiAllowed()) {
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

    // Prérequis vérifiés AVANT de lancer quoi que ce soit (2026-10-18) : script,
    // outils PostgreSQL, phrase secrète, répertoire, connexion propriétaire.
    // Le conteneur web ne les a pas, volontairement : la sauvegarde de
    // production est la tâche planifiée de l'hôte (scripts/cron/edupilot.cron).
    const missing = await checkBackupPrerequisites(backupScript);
    if (missing.length > 0) {
      // L5 (audit) : jamais le chemin. L'exploitant retrouve le détail dans le
      // journal du serveur, pas dans une réponse HTTP.
      logger.error("Sauvegarde indisponible sur ce serveur", undefined, { module: "system/backup", missing });
      return NextResponse.json(
        {
          error: "Sauvegarde indisponible sur ce serveur : elle s'exécute par la tâche planifiée de l'hôte. Détail dans le journal du serveur.",
          code: "BACKUP_UNAVAILABLE",
        },
        { status: 503 }
      );
    }

    // Exécuter le script de sauvegarde
    const { stdout } = await execFileAsync(backupScript);

    // Parser la sortie pour extraire les informations
    const sizeMatch = stdout.match(/Taille de la sauvegarde: (.*)/);
    const checksumMatch = stdout.match(/Checksum SHA256: (.*)/);

    // L5 (audit) : `stdout` n'est jamais renvoyé — la sortie d'un script de
    // sauvegarde cite des chemins, des noms de base et parfois une chaîne de
    // connexion complète. Seuls la taille et l'empreinte sortent d'ici.
    return NextResponse.json({
      success: true,
      message: "Sauvegarde créée avec succès",
      size: sizeMatch ? sizeMatch[1] : "N/A",
      checksum: checksumMatch ? checksumMatch[1] : "N/A",
      timestamp: new Date().toISOString(),
    });
  
    } catch (error) {
    // L5 (audit) : le détail reste dans le journal du serveur.
    logger.error("Sauvegarde impossible", error as Error, { module: "system/backup" });
    return NextResponse.json(
      { error: "Erreur lors de la création de la sauvegarde. Consultez le journal du serveur." },
      { status: 500 }
    );
  }

}, { allowedRoles: ["SUPER_ADMIN"] });

/**
 * GET /api/system/backup
 * Lister les sauvegardes disponibles
 */
export const GET = createApiHandler(async (request, context) => {
    try {


    // Même garde-fou que pour POST : possibilité de désactiver totalement la surface backup via config
    if (!isBackupApiAllowed()) {
      return NextResponse.json(
        { error: "Listing des sauvegardes désactivé par la configuration de la plateforme" },
        { status: 403 }
      );
    }

    // Même répertoire que scripts/backup/postgres-backup.sh.
    const backupDir = process.env.BACKUP_DIR || "/var/backups/edupilot/postgres";

    // Données d'exécution hors du projet : `turbopackIgnore` empêche le traçage
    // de ces accès dynamiques, qui incluait TOUT le projet (sources, docs,
    // rapports d'audit, .env) dans .next/standalone.
    try {
      const files = await fs.readdir(/* turbopackIgnore: true */ backupDir);
      // Sauvegardes chiffrées (Lot 7) ; les .sql.gz d'avant restent listées.
      const backups = files.filter((f) => f.endsWith(".sql.gz.enc") || f.endsWith(".sql.gz"));

      const backupDetails = await Promise.all(
        backups.map(async (file) => {
          const filePath = path.join(/* turbopackIgnore: true */ backupDir, file);
          const stats = await fs.stat(/* turbopackIgnore: true */ filePath);
          const checksumPath = `${filePath}.sha256`;

          let checksum = null;
          try {
            checksum = (await fs.readFile(/* turbopackIgnore: true */ checksumPath, "utf-8")).trim();
          } catch (_e) {
            // Pas de checksum disponible
          }

          return {
            // L5 (audit) : pas de `path` — le nom du fichier suffit à
            // l'écran, et l'arborescence du serveur ne regarde personne.
            filename: file,
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
    logger.error("Listing des sauvegardes impossible", error as Error, { module: "system/backup" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }

}, { allowedRoles: ["SUPER_ADMIN"] });
