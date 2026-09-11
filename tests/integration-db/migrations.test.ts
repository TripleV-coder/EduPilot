import { describe, expect, inject, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

/**
 * C1 — un clone neuf doit pouvoir créer la base avec `prisma migrate deploy`.
 * global-setup.ts vient d'appliquer les migrations sur une base vide : on
 * vérifie qu'elles sont versionnées et qu'elles produisent exactement le
 * schéma déclaré dans schema.prisma.
 */
describe("C1 — migrations Prisma", () => {
  const migrationFiles = readdirSync("prisma/migrations", { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `prisma/migrations/${entry.name}/migration.sql`);

  it("chaque migration SQL est versionnée (ni absente ni ignorée par git)", () => {
    expect(migrationFiles.length).toBeGreaterThan(0);

    const ignored = spawnSync("git", ["check-ignore", "--no-index", ...migrationFiles], {
      encoding: "utf8",
    });
    expect(ignored.stdout.trim()).toBe("");
  });

  it("la base migrée correspond exactement à schema.prisma (aucune dérive)", () => {
    const diff = spawnSync(
      "npx",
      [
        "prisma",
        "migrate",
        "diff",
        "--from-url",
        inject("databaseUrl"),
        "--to-schema-datamodel",
        "prisma/schema.prisma",
        "--script",
        "--exit-code",
      ],
      { encoding: "utf8" },
    );

    // --exit-code : 0 = aucune différence, 2 = dérive, 1 = erreur.
    expect(diff.status, `Dérive détectée :\n${diff.stdout}${diff.stderr}`).toBe(0);
  });
});
