import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Démarrage à vide (Lot 5, N38) — JSX n'interprète pas les séquences
 * d'échappement JavaScript : « Nouvelle P\u00e9riode » écrit dans du texte
 * JSX ou dans un attribut s'affiche tel quel, séquence comprise, au lieu de
 * « Nouvelle Période ». L'écran des périodes en affichait huit. Les caractères
 * accentués s'écrivent directement (fichiers UTF-8), y compris dans les
 * chaînes JavaScript.
 */
const ROOT = path.resolve(__dirname, "../../../src");
const ESCAPE = /\\u00[0-9a-fA-F]{2}/;
const COMMENT = /^\s*(\*|\/\/|\/\*)/;

function tsxFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return tsxFiles(full);
        return full.endsWith(".tsx") ? [full] : [];
    });
}

describe("N38 — aucune séquence \\u00XX affichée littéralement", () => {
    it("aucun fichier .tsx n'écrit un caractère accentué sous forme \\u00XX (hors commentaires)", () => {
        const offenders = tsxFiles(ROOT).flatMap((file) =>
            readFileSync(file, "utf8")
                .split("\n")
                .map((line, index) => ({ line, index }))
                .filter(({ line }) => ESCAPE.test(line) && !COMMENT.test(line))
                .map(({ line, index }) => `${path.relative(ROOT, file)}:${index + 1}: ${line.trim().slice(0, 80)}`),
        );
        expect(offenders).toEqual([]);
    });
});
