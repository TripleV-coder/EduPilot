#!/usr/bin/env node
/**
 * Crée ou met à jour le rôle PostgreSQL applicatif (audit M2 — RLS effective).
 * À exécuter par l'exploitant, après `prisma migrate deploy`, puis après
 * chaque migration (idempotent).
 *
 *   ADMIN_DATABASE_URL=postgresql://postgres:…@hôte:5432/edupilot \
 *   APP_DB_PASSWORD='<secret de 16 caractères ou plus>' \
 *   node scripts/db/setup-app-role.mjs [--app-role edupilot_app] [--owner-role edupilot]
 *
 * - ADMIN_DATABASE_URL : connexion superutilisateur (création de rôle, BYPASSRLS).
 * - APP_DB_PASSWORD    : lu dans l'environnement, jamais en argument (historique du shell).
 * - --owner-role       : propriétaire des tables ; par défaut, celui de la table "users".
 *
 * L'application utilise ensuite :
 *   DATABASE_URL=postgresql://edupilot_app:<APP_DB_PASSWORD>@hôte:5432/edupilot
 * Les migrations, sauvegardes et scripts de maintenance gardent le rôle propriétaire.
 */
import { PrismaClient } from "@prisma/client";
import { describeRole, setupAppRole } from "./app-role.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const adminUrl = process.env.ADMIN_DATABASE_URL;
const appPassword = process.env.APP_DB_PASSWORD;
const appRole = argument("--app-role") ?? "edupilot_app";

if (!adminUrl) {
  console.error("ADMIN_DATABASE_URL manquant (connexion superutilisateur).");
  process.exit(1);
}
if (!appPassword) {
  console.error("APP_DB_PASSWORD manquant (mot de passe du rôle applicatif).");
  process.exit(1);
}

const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
try {
  const ownerRole =
    argument("--owner-role") ??
    (await admin.$queryRawUnsafe(
      "SELECT tableowner AS owner FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users'",
    ))[0]?.owner;
  if (!ownerRole) {
    console.error("Table \"users\" introuvable : appliquez d'abord les migrations (prisma migrate deploy).");
    process.exit(1);
  }

  await setupAppRole(admin, { appRole, appPassword, ownerRole });
  const role = await describeRole(admin, appRole);
  const owner = await describeRole(admin, ownerRole);
  console.log(`Rôle applicatif « ${role.role} » : superutilisateur=${role.superuser}, BYPASSRLS=${role.bypassRls}.`);
  console.log(`Rôle propriétaire « ${owner.role} » : BYPASSRLS=${owner.bypassRls} (sauvegardes et maintenance).`);
  console.log(`DATABASE_URL de l'application : utilisateur « ${role.role} ».`);
} finally {
  await admin.$disconnect();
}
