#!/usr/bin/env node
/**
 * Contrôle des secrets dans les artefacts distribuables (2026-10-18).
 *
 * Constaté : `.next/standalone/.env` contenait les secrets du poste de
 * développement (Next recopie `.env` et `.env.production` dans la sortie
 * standalone), et un accès dynamique au système de fichiers faisait tracer
 * tout le projet dans cette sortie. Ce contrôle refuse l'artefact si l'on y
 * trouve :
 *   - un fichier d'environnement (`.env`, `.env.production`, ... sauf
 *     `.env.example`) ou un fichier de clé (`*.pem`, `*.key`, `id_rsa`...) ;
 *   - un bloc de clé privée (`-----BEGIN ... PRIVATE KEY-----`) ;
 *   - la valeur d'un secret connu : variables sensibles de l'environnement
 *     du processus et des fichiers `.env*` de la racine.
 *
 * Il n'imprime JAMAIS une valeur : seulement le chemin et le type (nom de la
 * variable pour une valeur retrouvée). `node_modules` est exclu : les paquets
 * tiers y livrent leurs propres fichiers de test (certificats, exemples).
 *
 * Lancé par `npm run build` après le nettoyage de la sortie standalone.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Noms de variables sensibles (jamais les variables publiques NEXT_PUBLIC_). */
const SECRET_NAME = /(SECRET|PASSWORD|PASSWD|_PASS$|TOKEN|API_KEY|_KEY$|PRIVATE|CREDENTIAL|DATABASE_URL|_DSN$|ENCRYPTION)/;
/** En dessous, une valeur est trop banale pour être recherchée sans faux positif. */
const MIN_SECRET_LENGTH = 8;
const ENV_FILE = /^\.env(\..+)?$/;
const KEY_FILE = /(\.pem|\.key|\.p12|\.pfx|^id_(rsa|dsa|ecdsa|ed25519))$/;
const PRIVATE_KEY_BLOCK = /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/;
const MAX_SCANNED_BYTES = 25 * 1024 * 1024;

/** Analyse minimale d'un fichier .env (clé=valeur, guillemets retirés). */
export function parseEnvFile(content) {
    const values = {};
    for (const line of content.split(/\r?\n/)) {
        const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (!match) continue;
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        values[match[1]] = value;
    }
    return values;
}

export function isSecretName(name) {
    return !name.startsWith("NEXT_PUBLIC_") && SECRET_NAME.test(name);
}

/**
 * Secrets à rechercher : variables sensibles du processus et des fichiers
 * d'environnement de la racine. Renvoie [nom, valeur] (valeurs dédoublonnées).
 */
export async function collectKnownSecrets(projectRoot, env = process.env) {
    const sources = [env];
    for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
        try {
            sources.push(parseEnvFile(await readFile(path.join(projectRoot, file), "utf8")));
        } catch {
            // fichier absent
        }
    }
    const byValue = new Map();
    for (const source of sources) {
        for (const [name, value] of Object.entries(source)) {
            if (!value || value.length < MIN_SECRET_LENGTH || !isSecretName(name)) continue;
            if (!byValue.has(value)) byValue.set(value, name);
        }
    }
    return [...byValue].map(([value, name]) => [name, value]);
}

async function* walk(dir) {
    let entries;
    try {
        entries = await readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules") continue;
            yield* walk(full);
        } else if (entry.isFile()) {
            yield full;
        }
    }
}

/**
 * Analyse les répertoires `targets` (relatifs à `projectRoot`). Renvoie les
 * constats `{ file, kind }` — jamais de valeur.
 */
export async function scanArtifacts(projectRoot, targets, secrets) {
    const findings = [];
    const needles = secrets.map(([name, value]) => [name, Buffer.from(value)]);
    for (const target of targets) {
        for await (const file of walk(path.join(projectRoot, target))) {
            const relative = path.relative(projectRoot, file);
            const name = path.basename(file);
            if (ENV_FILE.test(name) && name !== ".env.example") {
                findings.push({ file: relative, kind: "fichier d'environnement" });
            }
            if (KEY_FILE.test(name)) findings.push({ file: relative, kind: "fichier de clé" });

            if ((await stat(file)).size > MAX_SCANNED_BYTES) continue;
            const content = await readFile(file);
            if (PRIVATE_KEY_BLOCK.test(content.toString("latin1"))) {
                findings.push({ file: relative, kind: "bloc de clé privée" });
            }
            for (const [secretName, needle] of needles) {
                if (content.includes(needle)) findings.push({ file: relative, kind: `valeur du secret ${secretName}` });
            }
        }
    }
    return findings;
}

/** Répertoires livrés par l'image de production (voir Dockerfile). */
export const DISTRIBUTED_TARGETS = [".next/standalone", ".next/static", "public"];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const root = process.cwd();
    const secrets = await collectKnownSecrets(root);
    const findings = await scanArtifacts(root, DISTRIBUTED_TARGETS, secrets);
    if (findings.length > 0) {
        console.error(`[secrets] ARTEFACT REFUSÉ : ${findings.length} constat(s).`);
        for (const finding of findings) console.error(`  - ${finding.file} : ${finding.kind}`);
        process.exit(1);
    }
    console.log(`[secrets] artefact vérifié : aucun secret (${secrets.length} valeur(s) recherchée(s)).`);
}
