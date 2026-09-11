// Smoke test : appelle chaque GET non paramétré de src/app/api pour un ou plusieurs rôles
// et relève statut / temps / taille. Seuils optionnels → code de sortie non nul si dépassés.
//
// Usage :
//   node scripts/quality/smoke.mjs [ROLE ...]            (défaut : SCHOOL_ADMIN TEACHER PARENT)
//   QUALITY_MAX_KB=1024 QUALITY_MAX_MS=1000 node scripts/quality/smoke.mjs ALL
//   QUALITY_OUT=dir  → écrit smoke-<ROLE>.json dans dir
import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";
import { BASE, login, fakeIp, pct, ROLE_ACCOUNTS, DEMO_PASSWORD } from "./lib.mjs";

const routes = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f === "route.ts" && !p.includes("[") && /export const GET/.test(readFileSync(p, "utf8"))) {
      routes.push("/" + path.dirname(p).split(path.sep).join("/").replace(/^src\/app\//, ""));
    }
  }
})("src/app/api");

// Flux longs (SSE), actions à effet de bord et export : exclus du smoke.
const SKIP = [/notifications\/stream/, /system\/backup/, /debug/, /export/];
const MAX_KB = Number(process.env.QUALITY_MAX_KB || 0);
const MAX_MS = Number(process.env.QUALITY_MAX_MS || 0);
const TIMEOUT_MS = Number(process.env.QUALITY_TIMEOUT_MS || 15000);
const OUT = process.env.QUALITY_OUT;

let roles = process.argv.slice(2);
if (roles.length === 0) roles = ["SCHOOL_ADMIN", "TEACHER", "PARENT"];
if (roles[0] === "ALL") roles = Object.keys(ROLE_ACCOUNTS).filter((r) => r !== "SCHOOL_ADMIN_OTHER");

let violations = 0;
for (const role of roles) {
  const email = ROLE_ACCOUNTS[role];
  const { cookie, session } = await login(email, DEMO_PASSWORD);
  if (!session?.user) {
    console.log(`[${role}] ÉCHEC de connexion (${email})`);
    violations++;
    continue;
  }
  const rows = [];
  const by = {};
  for (const r of routes.sort()) {
    if (SKIP.some((s) => s.test(r))) continue;
    const t0 = performance.now();
    let status = 0;
    let size = 0;
    try {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const x = await fetch(BASE + r, { headers: { cookie, "x-forwarded-for": fakeIp() }, signal: ctl.signal });
      size = (await x.arrayBuffer()).byteLength;
      status = x.status;
      clearTimeout(to);
    } catch {
      status = "TIMEOUT";
    }
    const ms = Math.round(performance.now() - t0);
    by[status] = (by[status] || 0) + 1;
    rows.push({ r, status, ms, kb: Math.round(size / 1024) });
  }
  if (OUT) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(path.join(OUT, `smoke-${role}.json`), JSON.stringify(rows, null, 1));
  }
  const ok = rows.filter((x) => x.status === 200).map((x) => x.ms);
  const errors = rows.filter((x) => String(x.status).startsWith("5") || x.status === "TIMEOUT");
  const heavy = rows.filter((x) => MAX_KB && x.kb > MAX_KB);
  const slow = rows.filter((x) => MAX_MS && x.ms > MAX_MS);
  console.log(`[${role}] ${rows.length} routes — statuts ${JSON.stringify(by)} — p50/p95 (200) ${pct(ok, 50)}/${pct(ok, 95)} ms`);
  console.log(`  5xx/timeout : ${errors.map((x) => `${x.r}(${x.status})`).join(" ") || "aucun"}`);
  console.log(`  > 500 ms    : ${rows.filter((x) => x.ms > 500).map((x) => `${x.r}(${x.ms}ms)`).join(" ") || "aucun"}`);
  console.log(`  > 500 Ko    : ${rows.filter((x) => x.kb > 500).map((x) => `${x.r}(${x.kb}Ko)`).join(" ") || "aucun"}`);
  violations += errors.length + heavy.length + slow.length;
}
console.log(violations ? `SMOKE: ${violations} violation(s)` : "SMOKE: OK");
process.exit(violations ? 1 : 0);
