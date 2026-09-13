// Latences p50/p95 (N requêtes séquentielles, première exclue) sur les endpoints principaux.
// Usage : node scripts/quality/latency.mjs [ROLE] [N]
//   QUALITY_PATHS="/api/a,/api/b"  pour surcharger la liste ; "__CLASS__" est remplacé par une classe de l'école.
//   QUALITY_SERVER_PID=<pid>        pour relever la RSS du serveur avant/après.
import { readFileSync } from "fs";
import { BASE, login, fakeIp, pct, ROLE_ACCOUNTS, DEMO_PASSWORD, prismaForDisposableDb, retryAfterMs, sleep } from "./lib.mjs";

const role = process.argv[2] || "SCHOOL_ADMIN";
const n = Number(process.argv[3] || 30);
const PID = process.env.QUALITY_SERVER_PID;
const rss = () => (PID ? readFileSync(`/proc/${PID}/status`, "utf8").match(/VmRSS:\s+(\d+)/)?.[1] / 1024 : null);

const DEFAULT_PATHS = [
  "/api/health",
  "/api/students?limit=20",
  "/api/classes",
  "/api/grades?classId=__CLASS__",
  "/api/payments?limit=20",
  "/api/analytics/dashboard",
  "/api/notifications",
  "/api/finance/stats",
  "/api/users?limit=20",
  "/api/evaluations",
  "/api/grades/statistics",
];

const { cookie, session } = await login(ROLE_ACCOUNTS[role], DEMO_PASSWORD);
if (!session?.user) {
  console.error(`Connexion impossible pour ${role}`);
  process.exit(1);
}
let paths = (process.env.QUALITY_PATHS || DEFAULT_PATHS.join(",")).split(",");
if (paths.some((p) => p.includes("__CLASS__"))) {
  const prisma = prismaForDisposableDb();
  const cls = await prisma.class.findFirst({ where: { schoolId: session.user.schoolId ?? undefined }, select: { id: true } });
  await prisma.$disconnect();
  paths = paths.map((p) => p.replace("__CLASS__", cls?.id ?? "none"));
}

console.log(`rôle ${role}, ${n} requêtes/endpoint, RSS avant : ${rss() ?? "n/d"} Mo`);
for (const p of paths) {
  const times = [];
  const statuses = {};
  let bytes = 0;
  for (let i = 0; i < n; i++) {
    let t0 = performance.now();
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 20000);
    try {
      let r = await fetch(`${BASE}${p}`, { headers: { cookie, "x-forwarded-for": fakeIp() }, signal: ctl.signal });
      // Un 429 (rate-limit : une seule adresse depuis H3) ne mesure pas la route :
      // attente Retry-After puis nouvel essai, seul le dernier essai est chronométré.
      for (let retry = 0; r.status === 429 && retry < 5; retry++) {
        const wait = retryAfterMs(r);
        await r.arrayBuffer();
        console.log(`  (429 sur ${p} : attente ${wait / 1000} s)`);
        await sleep(wait);
        t0 = performance.now();
        r = await fetch(`${BASE}${p}`, { headers: { cookie, "x-forwarded-for": fakeIp() }, signal: ctl.signal });
      }
      bytes = (await r.arrayBuffer()).byteLength;
      statuses[r.status] = (statuses[r.status] || 0) + 1;
    } catch {
      statuses.TIMEOUT = (statuses.TIMEOUT || 0) + 1;
    }
    clearTimeout(to);
    times.push(performance.now() - t0);
    if (statuses.TIMEOUT >= 2) break; // inutile d'insister sur un endpoint qui dépasse le délai
  }
  const warm = times.length > 1 ? times.slice(1) : times;
  console.log(
    JSON.stringify({ path: p, first: Math.round(times[0]), p50: Math.round(pct(warm, 50)), p95: Math.round(pct(warm, 95)), statuses, kb: Math.round(bytes / 1024) }),
  );
}
console.log(`RSS après : ${rss() ?? "n/d"} Mo`);
