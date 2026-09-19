#!/usr/bin/env node
/**
 * Couverture consolidée : tests unitaires (coverage/unit) + intégration sur
 * PostgreSQL réel (coverage/integration), fusionnées fichier par fichier.
 *
 *   npm run test:coverage:all            # mesure les deux suites puis fusionne
 *   node scripts/quality/coverage-merge.mjs [--check]
 *
 * --check : échoue si la couverture des lignes est sous COVERAGE_MIN_LINES
 * (défaut 100) — c'est la garde de CI. Rapports : coverage/merged/.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import libCoverage from "istanbul-lib-coverage";
import libReport from "istanbul-lib-report";
import reports from "istanbul-reports";

const root = process.cwd();
const sources = ["coverage/unit/coverage-final.json", "coverage/integration/coverage-final.json"];
const map = libCoverage.createCoverageMap({});
let found = 0;
for (const rel of sources) {
    const file = path.join(root, rel);
    if (!existsSync(file)) {
        console.warn(`[coverage] absent : ${rel}`);
        continue;
    }
    map.merge(JSON.parse(readFileSync(file, "utf8")));
    found += 1;
}
if (found === 0) {
    console.error("[coverage] aucune couverture à fusionner");
    process.exit(1);
}

const outDir = path.join(root, "coverage/merged");
mkdirSync(outDir, { recursive: true });
const context = libReport.createContext({ dir: outDir, coverageMap: map });
for (const name of ["json-summary", "json", "lcov", "text-summary"]) {
    reports.create(name).execute(context);
}

const total = map.getCoverageSummary().toJSON();
const uncovered = map
    .files()
    .map((f) => ({ file: path.relative(root, f), lines: map.fileCoverageFor(f).toSummary().toJSON().lines }))
    .filter((f) => f.lines.pct < 100)
    .sort((a, b) => (b.lines.total - b.lines.covered) - (a.lines.total - a.lines.covered));
writeFileSync(path.join(outDir, "uncovered.json"), JSON.stringify(uncovered, null, 2));

if (process.argv.includes("--check")) {
    const min = Number(process.env.COVERAGE_MIN_LINES ?? 100);
    if (total.lines.pct < min) {
        console.error(`[coverage] lignes ${total.lines.pct} % < ${min} % — ${uncovered.length} fichiers incomplets (coverage/merged/uncovered.json)`);
        process.exit(1);
    }
    console.log(`[coverage] lignes ${total.lines.pct} % ≥ ${min} %`);
}
