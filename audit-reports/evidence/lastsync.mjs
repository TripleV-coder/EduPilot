import { PrismaClient } from "@prisma/client";
const p = new PrismaClient({ datasources: { db: { url: process.env.U } } });
const r = await p.$queryRaw`SELECT max("updatedAt") AS last, count(*)::int AS n FROM student_analytics`;
console.log(JSON.stringify(r), new Date().toISOString());
await p.$disconnect();
