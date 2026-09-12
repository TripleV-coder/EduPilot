#!/usr/bin/env node
/**
 * Parcours séquentiels sur la base jetable — preuve pour (ou contre) l'ajout
 * d'index (Lot 3 : « n'ajoute que les index justifiés par EXPLAIN ANALYZE »).
 *
 *   node scripts/quality/pg-seq-scans.mjs reset    # remet les compteurs à zéro
 *   (… exécuter le smoke ou la charge …)
 *   node scripts/quality/pg-seq-scans.mjs report   # tables lues séquentiellement
 *
 * Signale les tables d'au moins QUALITY_SEQ_MIN_ROWS lignes (défaut 5 000)
 * parcourues séquentiellement : candidates à un EXPLAIN ANALYZE ciblé.
 * Base jetable uniquement (voir lib.mjs : QUALITY_DATABASE_URL, port ≠ 5432).
 */
import { prismaForDisposableDb } from "./lib.mjs";

const mode = process.argv[2] || "report";
const minRows = Number(process.env.QUALITY_SEQ_MIN_ROWS || 5000);
const prisma = prismaForDisposableDb();

try {
  if (mode === "reset") {
    // pg_stat_reset() renvoie void : $executeRaw (aucune colonne à désérialiser).
    await prisma.$executeRawUnsafe("SELECT pg_stat_reset()");
    console.log("Compteurs pg_stat remis à zéro.");
  } else {
    // Les statistiques sont publiées en fin de transaction, avec un léger différé.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const rows = await prisma.$queryRawUnsafe(`
      SELECT relname AS "table", n_live_tup::int AS "rows", seq_scan::int AS "seqScans",
             seq_tup_read::bigint AS "seqRowsRead", COALESCE(idx_scan, 0)::int AS "indexScans"
      FROM pg_stat_user_tables
      WHERE seq_scan > 0
      ORDER BY seq_tup_read DESC
      LIMIT 25`);
    console.log("table".padEnd(32), "lignes".padStart(9), "parcours seq".padStart(13), "lignes lues".padStart(13), "parcours index".padStart(15));
    for (const r of rows) {
      const flag = r.rows >= minRows ? "  ← à examiner" : "";
      console.log(String(r.table).padEnd(32), String(r.rows).padStart(9), String(r.seqScans).padStart(13), String(r.seqRowsRead).padStart(13), String(r.indexScans).padStart(15) + flag);
    }
  }
} finally {
  await prisma.$disconnect();
}
