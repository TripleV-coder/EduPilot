#!/usr/bin/env node
/**
 * Recopie l'instrumentation dans la sortie standalone (Lot 7).
 *
 * `next build` (Turbopack) écrit `.next/server/instrumentation.js` mais ne
 * l'inclut pas dans `.next/standalone`. Or c'est exactement le serveur que
 * lance l'image de production. Résultat, constaté à l'exécution : le hook
 * `register()` n'était jamais appelé, donc **rien** de ce qu'il fait ne
 * s'exécutait en production —
 *
 *   - validation des variables d'environnement au démarrage ;
 *   - garde RLS (audit M2) qui refuse un rôle PostgreSQL trop puissant ;
 *   - initialisation de Sentry côté serveur ;
 *   - préchauffage du cache ;
 *   - fermeture de Prisma et de Redis à l'arrêt (« Arrêt terminé … tasks: 0 »).
 *
 * Ce script copie l'entrée et **uniquement** les morceaux qu'elle atteint,
 * déterminés en suivant les références `server/chunks/<nom>.js` de proche en
 * proche : la sortie standalone reste minimale.
 *
 * Lancé par `npm run build` ; sans sortie standalone, il ne fait rien.
 */
import { access, copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CHUNK_REFERENCE = /(?:server\/chunks\/|\.\/chunks\/)([^"')]+\.js)/g;

async function exists(target) {
    try {
        await access(target);
        return true;
    } catch {
        return false;
    }
}

/**
 * @param {string} projectRoot racine du projet (contient `.next`)
 * @returns {Promise<{status: "copied" | "no-standalone", files: string[]}>}
 */
export async function copyInstrumentationIntoStandalone(projectRoot = process.cwd()) {
    const serverDir = path.join(projectRoot, ".next", "server");
    const standaloneServerDir = path.join(projectRoot, ".next", "standalone", ".next", "server");

    if (!(await exists(path.join(projectRoot, ".next", "standalone")))) {
        return { status: "no-standalone", files: [] };
    }

    const entry = path.join(serverDir, "instrumentation.js");
    if (!(await exists(entry))) {
        throw new Error(
            "instrumentation.js est absent de .next/server : le hook d'instrumentation n'a pas été compilé. " +
                "Vérifiez que instrumentation.ts est à la racine du projet.",
        );
    }

    // Fermeture transitive : on part de l'entrée et on suit les références.
    const chunksDir = path.join(serverDir, "chunks");
    const available = new Set(await readdir(chunksDir).catch(() => []));
    const needed = new Set();
    const queue = [entry];

    while (queue.length > 0) {
        const file = queue.pop();
        let content;
        try {
            content = await readFile(file, "utf8");
        } catch {
            continue;
        }
        for (const match of content.matchAll(CHUNK_REFERENCE)) {
            const name = match[1];
            if (needed.has(name) || !available.has(name)) continue;
            needed.add(name);
            queue.push(path.join(chunksDir, name));
        }
    }

    await mkdir(path.join(standaloneServerDir, "chunks"), { recursive: true });
    const copied = [];

    await copyFile(entry, path.join(standaloneServerDir, "instrumentation.js"));
    copied.push("instrumentation.js");

    for (const name of needed) {
        const destination = path.join(standaloneServerDir, "chunks", name);
        if (await exists(destination)) continue;
        await copyFile(path.join(chunksDir, name), destination);
        copied.push(path.join("chunks", name));
    }

    return { status: "copied", files: copied };
}

// Exécution directe (npm run build). `pathToFileURL` et non `file://` + chemin :
// un chemin contenant un espace ne se compare pas autrement.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const result = await copyInstrumentationIntoStandalone();
    if (result.status === "no-standalone") {
        console.log("[instrumentation] sortie non standalone — rien à faire.");
    } else {
        console.log(`[instrumentation] ${result.files.length} fichier(s) recopié(s) dans .next/standalone.`);
    }
}
