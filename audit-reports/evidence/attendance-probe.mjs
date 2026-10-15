// Présences réelles de l'élève de démonstration (base jetable, lecture seule)
import { prismaForDisposableDb, ROLE_ACCOUNTS } from "../../scripts/quality/lib.mjs";
const p = prismaForDisposableDb();
const u = await p.user.findUnique({ where: { email: ROLE_ACCOUNTS.STUDENT }, select: { studentProfile: { select: { id: true } } } });
const rows = await p.attendance.groupBy({ by: ["status"], where: { studentId: u.studentProfile.id }, _count: { _all: true } });
console.log(JSON.stringify(rows.map((r) => [r.status, r._count._all])));
await p.$disconnect();
