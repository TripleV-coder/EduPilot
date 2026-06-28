/**
 * Backfill idempotent de School.offeredLevels.
 * Déduit les cycles offerts depuis School.level (si ≠ MIXED) + les ClassLevel
 * réels de l'école. Ne touche pas aux écoles déjà renseignées.
 */
import { PrismaClient, type SchoolLevel } from "@prisma/client";
import { normalizeOfferedLevels } from "../src/lib/benin/levels";

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    select: {
      id: true,
      name: true,
      level: true,
      offeredLevels: true,
      classLevels: { select: { level: true } },
    },
  });

  let updated = 0;
  for (const s of schools) {
    if (s.offeredLevels.length > 0) continue; // déjà configuré → on ne touche pas

    const candidates: SchoolLevel[] = [
      s.level,
      ...s.classLevels.map((c) => c.level),
    ];
    let offered = normalizeOfferedLevels(candidates);

    // École MIXED sans ClassLevel exploitable → fallback prudent : collège+lycée
    if (offered.length === 0) {
      offered = ["SECONDARY_COLLEGE", "SECONDARY_LYCEE"];
    }

    await prisma.school.update({
      where: { id: s.id },
      data: { offeredLevels: offered },
    });
    updated++;
    console.log(`  ${s.name} → [${offered.join(", ")}]`);
  }

  console.log(`\nBackfill terminé : ${updated}/${schools.length} école(s) mise(s) à jour.`);
}

main()
  .catch((e) => {
    console.error("Backfill error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
