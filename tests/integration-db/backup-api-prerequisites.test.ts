import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// API de sauvegarde activée pour ce test (lue au chargement de @/lib/env)
vi.hoisted(() => {
    process.env.ALLOW_BACKUP_API = "true";
});

import { actAs, callRoute, createSchool, sessionFor, uniqueCode } from "./helpers";
import prisma from "./owner-db";
import { POST as backup } from "@/app/api/system/backup/route";

/**
 * Sauvegarde déclenchée par l'API (2026-10-18), sur un vrai PostgreSQL : le
 * serveur web se connecte avec `edupilot_app`, soumis à la RLS. Une sauvegarde
 * par ce rôle ne verrait pas les tables protégées : la route refuse (503) au
 * lieu de lancer pg_dump, et n'écrit rien. La sauvegarde de production est la
 * tâche planifiée de l'hôte, avec la connexion propriétaire.
 */
let backupDir: string;
let rootId: string;

beforeAll(async () => {
    backupDir = await mkdtemp(path.join(tmpdir(), "backup-api-"));
    process.env.BACKUP_DIR = backupDir;
    rootId = (await prisma.user.create({
        data: { email: `${uniqueCode("backup-root")}@integration.test`, password: "x", firstName: "Root", lastName: "Backup", role: "SUPER_ADMIN" },
    })).id;
});
afterAll(async () => {
    await rm(backupDir, { recursive: true, force: true });
});

describe("POST /api/system/backup", () => {
    it("super-admin, connexion applicative soumise à la RLS : 503 BACKUP_UNAVAILABLE, aucune archive écrite", async () => {
        actAs(sessionFor("SUPER_ADMIN", null, rootId));
        const res = await callRoute(backup, { method: "POST", path: "/api/system/backup" });
        expect(res.status).toBe(503);
        expect(res.body).toMatchObject({ code: "BACKUP_UNAVAILABLE" });
        expect(JSON.stringify(res.body)).not.toContain(backupDir);
        expect(await readdir(backupDir)).toEqual([]);
    });

    it("administrateur d'école : 403 (réservé au super-admin), aucune archive écrite", async () => {
        actAs(sessionFor("SCHOOL_ADMIN", (await createSchool("BACKUP")).id));
        const res = await callRoute(backup, { method: "POST", path: "/api/system/backup" });
        expect(res.status).toBe(403);
        expect(await readdir(backupDir)).toEqual([]);
    });
});
