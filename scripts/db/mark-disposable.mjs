#!/usr/bin/env node
/**
 * Marque une base PostgreSQL comme JETABLE (règle 6, constat N17) : seules les
 * bases marquées acceptent les seeds de démonstration, les réinitialisations
 * de comptes et la préparation des E2E (scripts/lib/disposable-guard.mjs).
 *
 *   DATABASE_URL=postgresql://…/edupilot_e2e node scripts/db/mark-disposable.mjs [--allow-non-empty]
 *
 * À n'utiliser QUE sur une base de test. Une base qui contient déjà des comptes
 * est refusée, sauf --allow-non-empty (base de test déjà peuplée, déclarée
 * comme telle). Ne jamais lancer ce script sur une base réelle.
 */
import { PrismaClient } from "@prisma/client";
import { markDatabaseDisposable } from "../lib/disposable-guard.mjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant.");
  process.exit(1);
}

const client = new PrismaClient({ datasources: { db: { url } } });
try {
  const name = await markDatabaseDisposable(client, { allowNonEmpty: process.argv.includes("--allow-non-empty") });
  console.log(`Base « ${name} » marquée jetable : seeds et réinitialisations autorisés sur cette base uniquement.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.$disconnect();
}
