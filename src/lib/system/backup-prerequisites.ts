import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import prisma from "@/lib/prisma";
import { inspectRlsRole } from "@/lib/db/rls-guard";

/**
 * Prérequis d'une sauvegarde déclenchée par l'API (2026-10-18).
 *
 * La sauvegarde de production est une tâche de l'HÔTE (scripts/cron/edupilot.cron) :
 * connexion propriétaire, phrase secrète dans /etc/edupilot, outils PostgreSQL
 * installés. Le conteneur web n'a rien de cela, volontairement (moindre
 * privilège) : ni le script, ni bash, ni pg_dump, ni la phrase secrète, et son
 * rôle `edupilot_app` est soumis à la RLS — `pg_dump` y échouerait (ou, forcé,
 * produirait une sauvegarde privée des tables protégées). La route vérifie donc
 * ces prérequis AVANT de lancer quoi que ce soit, au lieu d'échouer en
 * « script introuvable » ou en erreur interne.
 *
 * Renvoie la liste des prérequis manquants (vide : la sauvegarde peut partir).
 * Les noms ne contiennent ni chemin ni secret : ils vont au journal.
 */
export const BACKUP_TOOLS = ["bash", "pg_dump", "psql", "openssl", "gzip", "sha256sum", "node"] as const;

function hasCommand(tool: string): Promise<boolean> {
    // Liste fixe d'outils, aucune donnée externe dans la commande
    return new Promise((resolve) => {
        execFile("sh", ["-c", `command -v ${tool}`], (error) => resolve(!error));
    });
}

async function canAccess(target: string, mode: number): Promise<boolean> {
    try {
        await fs.access(/* turbopackIgnore: true */ target, mode);
        return true;
    } catch {
        return false;
    }
}

export async function checkBackupPrerequisites(scriptPath: string): Promise<string[]> {
    const missing: string[] = [];

    if (!(await canAccess(scriptPath, fsConstants.X_OK))) missing.push("script de sauvegarde exécutable");

    for (const tool of BACKUP_TOOLS) {
        if (!(await hasCommand(tool))) missing.push(`outil ${tool}`);
    }

    const passphraseFile = process.env.BACKUP_PASSPHRASE_FILE;
    if (!passphraseFile) missing.push("BACKUP_PASSPHRASE_FILE non définie");
    else if (!(await canAccess(passphraseFile, fsConstants.R_OK))) missing.push("phrase secrète illisible");

    const backupDir = process.env.BACKUP_DIR || "/var/backups/edupilot/postgres";
    const writable =
        (await canAccess(backupDir, fsConstants.W_OK)) ||
        (!(await canAccess(backupDir, fsConstants.F_OK)) && (await canAccess(path.dirname(/* turbopackIgnore: true */ backupDir), fsConstants.W_OK)));
    if (!writable) missing.push("répertoire de sauvegarde non accessible en écriture");

    // Une sauvegarde doit voir TOUTES les lignes : un rôle soumis à la RLS
    // (edupilot_app) ne le peut pas. Seule la connexion propriétaire convient.
    const role = await inspectRlsRole(prisma);
    if (role.status !== "bypassed") missing.push("rôle PostgreSQL soumis à la RLS (connexion propriétaire requise)");

    return missing;
}
