// Charge sur la vue famille (« Mes notes » : /api/grades en élève) et effet sur
// les AUTRES utilisateurs : pendant la charge, une sonde mesure en continu la
// latence d'une route légère (administration). Révèle l'épuisement du pool de
// connexions Prisma (DATABASE_POOL_SIZE) par les calculs de classe parallèles.
// Usage : node scripts/quality/family-load.mjs [connexions…]   (défaut : 1 5 10)
//         QUALITY_DURATION=20 (s) · QUALITY_PROBE_PATH=/api/classes
import autocannon from "autocannon";
import { BASE, login, fakeIp, ROLE_ACCOUNTS, DEMO_PASSWORD, pct } from "./lib.mjs";

const levels = (process.argv.slice(2).length ? process.argv.slice(2) : ["1", "5", "10"]).map(Number);
const duration = Number(process.env.QUALITY_DURATION || 20);
const probePath = process.env.QUALITY_PROBE_PATH || "/api/classes";

const student = await login(ROLE_ACCOUNTS.STUDENT, DEMO_PASSWORD);
const admin = await login(ROLE_ACCOUNTS.SCHOOL_ADMIN, DEMO_PASSWORD);

async function probe(stopAt) {
  const samples = [];
  let errors = 0;
  while (Date.now() < stopAt) {
    const t0 = performance.now();
    const r = await fetch(`${BASE}${probePath}`, { headers: { cookie: admin.cookie, "x-forwarded-for": fakeIp() } });
    await r.arrayBuffer();
    if (r.status !== 200) errors++;
    samples.push(performance.now() - t0);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return { n: samples.length, p50: Math.round(pct(samples, 50)), p95: Math.round(pct(samples, 95)), max: Math.round(Math.max(...samples)), errors };
}

for (const connections of levels) {
  const stopAt = Date.now() + duration * 1000;
  const [load, other] = await Promise.all([
    autocannon({
      url: `${BASE}/api/grades?limit=500`,
      connections,
      duration,
      timeout: 60,
      requests: [{ setupRequest: (req) => ({ ...req, headers: { ...req.headers, cookie: student.cookie } }) }],
    }),
    probe(stopAt),
  ]);
  console.log(
    JSON.stringify({
      connections,
      family: { rps: load.requests.average, p50: load.latency.p50, p97_5: load.latency.p97_5, max: load.latency.max, non2xx: load.non2xx, errors: load.errors, timeouts: load.timeouts },
      [`others ${probePath}`]: other,
    }),
  );
}
