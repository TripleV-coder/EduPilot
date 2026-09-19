// Compte les lignes des tables principales d'une base JETABLE (contrôle du seed / des restaurations).
import { prismaForDisposableDb } from "./lib.mjs";

const prisma = prismaForDisposableDb();
const models = ["school", "user", "studentProfile", "grade", "evaluation", "attendance", "payment", "medicalRecord", "auditLog"];
const out = {};
for (const m of models) out[m] = await prisma[m].count();
console.log(JSON.stringify(out));
await prisma.$disconnect();
