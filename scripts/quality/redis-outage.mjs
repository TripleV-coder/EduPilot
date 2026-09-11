// H6 — Latence API quand Redis (Upstash) est injoignable.
// Démarrer le serveur avec UPSTASH_REDIS_REST_URL pointant vers un port fermé (ex. http://127.0.0.1:1)
// et un token quelconque, puis lancer ce script. Attendu : HTTP 200 et < 300 ms.
import { BASE, pct } from "./lib.mjs";

const times = [];
const st = {};
for (let i = 0; i < 10; i++) {
  const t0 = performance.now();
  const r = await fetch(`${BASE}/api/auth/csrf`);
  await r.arrayBuffer();
  times.push(performance.now() - t0);
  st[r.status] = (st[r.status] || 0) + 1;
}
const p95 = pct(times.slice(1), 95);
const pass = (st[200] || 0) === 10 && p95 < 300;
console.log(`${pass ? "PASS" : "FAIL"} [H6] /api/auth/csrf Redis injoignable — statuts ${JSON.stringify(st)}, p50 ${Math.round(pct(times.slice(1), 50))} ms, p95 ${Math.round(p95)} ms`);
process.exit(pass ? 0 : 1);
