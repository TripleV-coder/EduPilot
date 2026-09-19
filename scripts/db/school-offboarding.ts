/**
 * Fin de conservation d'un établissement (Lot 6).
 *
 * Rend à une école toutes ses données, puis les efface, et prouve
 * l'effacement. À exécuter par l'exploitant, sur la base réelle (règle 5) :
 * ce script n'efface JAMAIS sans confirmation explicite.
 *
 *   # 1. Export seul (aucune suppression) — à faire d'abord, et à vérifier
 *   npx tsx scripts/db/school-offboarding.ts --school CESM --out ./sortie
 *
 *   # 2. Export puis effacement définitif, confirmé par le code de l'école
 *   npx tsx scripts/db/school-offboarding.ts --school CESM --out ./sortie \
 *       --purge --confirm CESM
 *
 * Le rapport de vérification (nombre de lignes restantes par table) est
 * affiché et écrit dans <out>/rapport-verification.json.
 */
import { writeFile } from "fs/promises";
import path from "path";
import prisma from "../../src/lib/prisma";
import {
    collectSchoolScope,
    exportSchoolData,
    purgeSchool,
    verifySchoolRemoval,
} from "../../src/lib/security/school-offboarding";

function arg(name: string): string | undefined {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
    const code = arg("school");
    const outDir = arg("out");
    const wantsPurge = has("purge");
    const confirmation = arg("confirm");

    if (!code || !outDir) {
        console.error("Usage : --school <code> --out <répertoire> [--purge --confirm <code>]");
        process.exit(2);
    }

    const school = await prisma.school.findUnique({
        where: { code },
        select: { id: true, name: true, code: true },
    });
    if (!school) {
        console.error(`Aucun établissement de code « ${code} ».`);
        process.exit(1);
    }

    console.log(`Établissement : ${school.name} (${school.code})`);

    const scope = await collectSchoolScope(school.id);
    console.log(`  ${scope.userIds.length} compte(s), ${scope.studentIds.length} élève(s).`);

    const target = path.resolve(outDir, `${school.code}-${new Date().toISOString().slice(0, 10)}`);
    console.log(`\nExport vers ${target} …`);
    const exported = await exportSchoolData(scope, target);
    for (const { table, rows } of exported.tables) {
        console.log(`  ${table.padEnd(34)} ${String(rows).padStart(8)} ligne(s)`);
    }
    if (exported.tables.length === 0) console.log("  (aucune donnée)");

    if (!wantsPurge) {
        console.log("\nExport terminé. Aucune suppression : relancez avec --purge --confirm <code>.");
        return;
    }

    if (confirmation !== school.code) {
        console.error(
            `\nSuppression REFUSÉE : ajoutez « --confirm ${school.code} » pour confirmer l'effacement ` +
            `définitif et irréversible de cet établissement.`,
        );
        process.exit(1);
    }

    console.log("\nEffacement définitif …");
    await purgeSchool(scope);

    const remaining = await verifySchoolRemoval(scope);
    const report = {
        school: { id: school.id, code: school.code, name: school.name },
        purgedAt: new Date().toISOString(),
        accounts: scope.userIds.length,
        students: scope.studentIds.length,
        exported: exported.tables,
        remaining,
        clean: remaining.length === 0,
    };
    await writeFile(path.join(target, "rapport-verification.json"), JSON.stringify(report, null, 2), "utf-8");

    console.log("\nRapport de vérification — lignes restantes par table :");
    if (remaining.length === 0) {
        console.log("  aucune. L'établissement n'a plus aucune donnée dans la base.");
    } else {
        for (const { table, rows } of remaining) {
            console.log(`  ${table.padEnd(34)} ${String(rows).padStart(8)} ligne(s) RESTANTE(S)`);
        }
        console.log("\nDes données subsistent : ne considérez pas la sortie comme terminée.");
    }
    console.log(`\nRapport écrit dans ${path.join(target, "rapport-verification.json")}.`);
    if (!report.clean) process.exit(1);
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
