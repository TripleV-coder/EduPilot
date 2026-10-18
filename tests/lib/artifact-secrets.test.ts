import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { stripStandaloneEnvFiles } from "../../scripts/build/strip-standalone-env.mjs";
import {
  collectKnownSecrets,
  isSecretName,
  parseEnvFile,
  scanArtifacts,
  DISTRIBUTED_TARGETS,
} from "../../scripts/build/check-artifact-secrets.mjs";

/**
 * Artefacts de build (2026-10-18) — `.next/standalone/.env` contenait les
 * secrets du poste : Next recopie `.env` et `.env.production` dans la sortie
 * standalone. Le build retire désormais ces fichiers, puis refuse l'artefact
 * s'il y reste un fichier d'environnement, une clé ou la valeur d'un secret.
 * Valeurs synthétiques uniquement.
 */
const FAKE_SECRET = "synthetique-secret-0123456789";
const FAKE_DB = "postgresql://app:synthetique-mdp-42@db:5432/app";
let root: string;

async function put(relative: string, content: string) {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, content);
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "artifact-secrets-"));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("stripStandaloneEnvFiles", () => {
  it("retire .env et .env.production de la sortie standalone, garde .env.example et la racine du projet", async () => {
    await put(".env", `NEXTAUTH_SECRET=${FAKE_SECRET}\n`);
    await put(".next/standalone/.env", `NEXTAUTH_SECRET=${FAKE_SECRET}\n`);
    await put(".next/standalone/.env.production", "X=1\n");
    await put(".next/standalone/.env.example", "NEXTAUTH_SECRET=\n");
    await put(".next/standalone/server.js", "// serveur\n");

    const removed = await stripStandaloneEnvFiles(root);

    expect(removed.sort()).toEqual([".next/standalone/.env", ".next/standalone/.env.production"].sort());
    expect((await readdir(path.join(root, ".next/standalone"))).sort()).toEqual([".env.example", "server.js"]);
    // La racine du projet n'est jamais touchée
    expect(await readdir(root)).toContain(".env");
  });

  it("sans sortie standalone : rien à faire", async () => {
    expect(await stripStandaloneEnvFiles(root)).toEqual([]);
  });
});

describe("check-artifact-secrets", () => {
  it("noms sensibles : secrets oui, variables publiques et paramètres non", () => {
    for (const name of ["NEXTAUTH_SECRET", "SMTP_PASS", "DATABASE_URL", "GOOGLE_AI_API_KEY", "TOTP_ENCRYPTION_KEY", "UPSTASH_REDIS_REST_TOKEN"]) {
      expect(isSecretName(name), name).toBe(true);
    }
    for (const name of ["NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL", "SMTP_HOST", "SMTP_PORT", "AI_ENABLED", "NEXT_PUBLIC_SENTRY_KEY"]) {
      expect(isSecretName(name), name).toBe(false);
    }
  });

  it("lit les fichiers .env (guillemets, export, espaces)", () => {
    expect(parseEnvFile(`# commentaire\nexport A="un"\nB='deux' \nC=trois\n`)).toEqual({ A: "un", B: "deux", C: "trois" });
  });

  it("secrets connus : processus + .env de la racine, valeurs courtes ignorées", async () => {
    await put(".env", `DATABASE_URL="${FAKE_DB}"\nSMTP_PASS=court\nNEXT_PUBLIC_APP_URL=https://exemple.test/public\n`);
    const secrets = await collectKnownSecrets(root, { NEXTAUTH_SECRET: FAKE_SECRET });
    expect(secrets.map(([name]) => name).sort()).toEqual(["DATABASE_URL", "NEXTAUTH_SECRET"]);
  });

  it("refuse : fichier .env, clé privée, valeur de secret dans un fichier JS livré — sans jamais renvoyer la valeur", async () => {
    await put(".next/standalone/.env", `NEXTAUTH_SECRET=${FAKE_SECRET}\n`);
    await put(".next/standalone/.next/server/chunks/a.js", `const k="${FAKE_SECRET}";`);
    await put(".next/static/chunks/b.js", `fetch("${FAKE_DB}")`);
    await put("public/certs/server.pem", "-----BEGIN RSA PRIVATE KEY-----\nAAAA\n-----END RSA PRIVATE KEY-----\n");

    const findings = await scanArtifacts(root, DISTRIBUTED_TARGETS, [
      ["NEXTAUTH_SECRET", FAKE_SECRET],
      ["DATABASE_URL", FAKE_DB],
    ]);
    const summary = findings.map((f) => `${f.file} | ${f.kind}`).sort();

    expect(summary).toEqual([
      ".next/standalone/.env | fichier d'environnement",
      ".next/standalone/.env | valeur du secret NEXTAUTH_SECRET",
      ".next/standalone/.next/server/chunks/a.js | valeur du secret NEXTAUTH_SECRET",
      ".next/static/chunks/b.js | valeur du secret DATABASE_URL",
      "public/certs/server.pem | bloc de clé privée",
      "public/certs/server.pem | fichier de clé",
    ].sort());
    expect(JSON.stringify(findings)).not.toContain(FAKE_SECRET);
    expect(JSON.stringify(findings)).not.toContain("synthetique-mdp-42");
  });

  it("accepte un artefact propre ; node_modules (fichiers tiers) n'est pas analysé", async () => {
    await put(".next/standalone/server.js", "// serveur\n");
    await put(".next/standalone/.env.example", "NEXTAUTH_SECRET=\n");
    await put(".next/standalone/node_modules/paquet/test/cert.pem", "-----BEGIN PRIVATE KEY-----\n");
    await put(".next/static/chunks/c.js", "console.log('ok')");
    expect(await scanArtifacts(root, DISTRIBUTED_TARGETS, [["NEXTAUTH_SECRET", FAKE_SECRET]])).toEqual([]);
  });

  it("enchaînement du build : après nettoyage, le même artefact est accepté", async () => {
    await put(".next/standalone/.env", `NEXTAUTH_SECRET=${FAKE_SECRET}\n`);
    await put(".next/standalone/server.js", "// serveur\n");
    const secrets: Array<[string, string]> = [["NEXTAUTH_SECRET", FAKE_SECRET]];
    expect((await scanArtifacts(root, DISTRIBUTED_TARGETS, secrets)).length).toBeGreaterThan(0);
    await stripStandaloneEnvFiles(root);
    expect(await scanArtifacts(root, DISTRIBUTED_TARGETS, secrets)).toEqual([]);
  });
});
