import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { copyInstrumentationIntoStandalone } from "../../scripts/build/copy-instrumentation.mjs";

/**
 * Lot 7 — `next build` (Turbopack) ne recopie PAS `instrumentation.js` ni ses
 * morceaux dans la sortie standalone. Le serveur du conteneur ne l'exécutait
 * donc jamais : ni validation de l'environnement, ni garde RLS au démarrage,
 * ni initialisation Sentry, ni fermeture de Prisma et Redis à l'arrêt.
 * Constaté à l'exécution : « Arrêt terminé … tasks: 0 ».
 */
let root: string;

async function fixture(options: { entry?: boolean } = {}) {
  const server = path.join(root, ".next", "server");
  const chunks = path.join(server, "chunks");
  const standaloneChunks = path.join(root, ".next", "standalone", ".next", "server", "chunks");
  await mkdir(chunks, { recursive: true });
  await mkdir(standaloneChunks, { recursive: true });

  if (options.entry !== false) {
    await writeFile(
      path.join(server, "instrumentation.js"),
      'var R=require("./chunks/[turbopack]_runtime.js")("server/instrumentation.js")\nR.c("server/chunks/entree._.js")\n',
    );
  }
  // entree → dependance → feuille ; « autre » n'est pas atteignable.
  await writeFile(path.join(chunks, "entree._.js"), 'require("server/chunks/dependance._.js")');
  await writeFile(path.join(chunks, "dependance._.js"), 'require("server/chunks/feuille._.js")');
  await writeFile(path.join(chunks, "feuille._.js"), "// rien");
  await writeFile(path.join(chunks, "autre._.js"), "// sans rapport");
  await writeFile(path.join(chunks, "[turbopack]_runtime.js"), "// runtime");
  // Déjà présent côté standalone : ne doit pas être recopié inutilement.
  await writeFile(path.join(standaloneChunks, "[turbopack]_runtime.js"), "// runtime");
}

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "edupilot-instrumentation-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("recopie de l'instrumentation dans la sortie standalone", () => {
  it("copie l'entrée et ses morceaux, sans embarquer le reste du build", async () => {
    await fixture();

    const result = await copyInstrumentationIntoStandalone(root);

    expect(result.status).toBe("copied");
    const server = path.join(root, ".next", "standalone", ".next", "server");
    expect(await readdir(server)).toContain("instrumentation.js");
    const copied = await readdir(path.join(server, "chunks"));
    expect(copied).toContain("entree._.js");
    expect(copied).toContain("dependance._.js");
    expect(copied).toContain("feuille._.js");
    expect(copied).not.toContain("autre._.js");
  });

  it("copie un contenu identique à l'original", async () => {
    await fixture();
    await copyInstrumentationIntoStandalone(root);

    const original = await readFile(path.join(root, ".next", "server", "chunks", "dependance._.js"), "utf8");
    const copie = await readFile(
      path.join(root, ".next", "standalone", ".next", "server", "chunks", "dependance._.js"),
      "utf8",
    );
    expect(copie).toBe(original);
  });

  it("ne fait rien quand la sortie n'est pas standalone", async () => {
    await mkdir(path.join(root, ".next", "server"), { recursive: true });
    const result = await copyInstrumentationIntoStandalone(root);
    expect(result.status).toBe("no-standalone");
  });

  it("échoue bruyamment si l'instrumentation n'a pas été compilée", async () => {
    await fixture({ entry: false });
    await expect(copyInstrumentationIntoStandalone(root)).rejects.toThrow(/instrumentation/i);
  });
});
