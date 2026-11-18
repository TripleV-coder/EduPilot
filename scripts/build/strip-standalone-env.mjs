#!/usr/bin/env node
/**
 * Retire les fichiers d'environnement de la sortie standalone (2026-10-18).
 *
 * `next build` recopie `.env` et `.env.production` dans `.next/standalone`
 * lorsqu'il les a chargés (Next 16, `writeStandaloneDirectory`). Construite sur
 * un poste de développement, la sortie embarquait donc ses secrets. Les
 * secrets se fournissent à l'exécution (variables d'environnement du
 * conteneur ou du service), jamais par un fichier livré avec le code.
 *
 * Seul le répertoire de build est touché : les fichiers `.env*` de la racine
 * du projet ne sont ni lus ni modifiés. `.env.example` (sans secret) est
 * conservé.
 *
 * Lancé par `npm run build` ; sans sortie standalone, il ne fait rien.
 */
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ENV_FILE = /^\.env(\..+)?$/;

/**
 * @param {string} projectRoot racine du projet (contient `.next`)
 * @returns {Promise<string[]>} fichiers retirés, relatifs à la racine
 */
export async function stripStandaloneEnvFiles(projectRoot = process.cwd()) {
    const standalone = path.join(projectRoot, ".next", "standalone");
    const removed = [];

    async function visit(dir) {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== "node_modules") await visit(full);
            } else if (ENV_FILE.test(entry.name) && entry.name !== ".env.example") {
                await rm(full, { force: true });
                removed.push(path.relative(projectRoot, full));
            }
        }
    }

    await visit(standalone);
    return removed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const removed = await stripStandaloneEnvFiles();
    console.log(
        removed.length > 0
            ? `[standalone] ${removed.length} fichier(s) d'environnement retiré(s) : ${removed.join(", ")}`
            : "[standalone] aucun fichier d'environnement à retirer.",
    );
}
