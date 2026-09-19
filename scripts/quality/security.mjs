// Vérifications de sécurité et de robustesse à l'exécution (non-régression de l'audit).
// Chaque contrôle exprime le comportement ATTENDU après correctif : PASS / FAIL.
// Le serveur doit tourner avec les limites de production (SANS RATE_LIMIT_RELAXED).
// Écrit dans la base (catégorie de test, modification inter-tenant) → base jetable obligatoire.
//
// Usage : QUALITY_DATABASE_URL=... QUALITY_DISPOSABLE_DB=1 [CRON_SECRET=...] node scripts/quality/security.mjs [checks...]
//   checks : xff bruteforce idor tenant health cron json   (défaut : tous)
import { BASE, login, ROLE_ACCOUNTS, DEMO_PASSWORD, prismaForDisposableDb } from "./lib.mjs";

const selected = new Set(process.argv.slice(2));
const want = (k) => selected.size === 0 || selected.has(k);
const results = [];
const check = (id, label, pass, detail) => {
  results.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"} [${id}] ${label} — ${detail}`);
};

async function statuses(n, headersFn, url = "/api/auth/csrf") {
  const st = {};
  for (let i = 0; i < n; i++) {
    const r = await fetch(`${BASE}${url}`, { headers: headersFn(i) });
    await r.arrayBuffer();
    st[r.status] = (st[r.status] || 0) + 1;
  }
  return st;
}

// H4 avant H3 : la rafale de H3 épuise volontairement le budget de l'adresse ;
// placée avant, elle faisait refuser (429) les jetons CSRF de H4, qui ne
// mesurait plus rien.

// H4 — la connexion réelle (/api/auth/callback/credentials) doit être limitée par IP.
if (want("bruteforce")) {
  const st = {};
  for (let i = 0; i < 12; i++) {
    const c = await fetch(`${BASE}/api/auth/csrf`, { headers: { "x-forwarded-for": "203.0.113.50" } });
    if (c.status !== 200) {
      st[`csrf-${c.status}`] = (st[`csrf-${c.status}`] || 0) + 1;
      continue;
    }
    const cookie = (c.headers.getSetCookie?.() ?? []).map((h) => h.split(";")[0]).join("; ");
    const { csrfToken } = await c.json();
    const r = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie, "x-forwarded-for": "203.0.113.50" },
      body: new URLSearchParams({ csrfToken, email: `nobody${i}@example.invalid`, password: "wrong", json: "true" }),
    });
    await r.arrayBuffer();
    st[r.status] = (st[r.status] || 0) + 1;
  }
  check("H4", "12 échecs de connexion depuis la même IP", (st[429] || 0) > 0, JSON.stringify(st));
}

// H3 — le rate-limit ne doit pas être contournable en faisant varier X-Forwarded-For.
if (want("xff")) {
  const st = await statuses(130, (i) => ({ "x-forwarded-for": `198.51.100.${i % 250}` }));
  check("H3", "rafale 130 req. avec XFF tournant", (st[429] || 0) > 0, JSON.stringify(st));
}

// H5 — IDOR inter-établissement sur subjects/categories/[id].
if (want("idor") || want("tenant")) {
  const prisma = prismaForDisposableDb();
  const adminA = await login(ROLE_ACCOUNTS.SCHOOL_ADMIN, DEMO_PASSWORD);
  const schoolA = adminA.session?.user?.schoolId;
  if (!schoolA) {
    check("SETUP", "connexion admin école A", false, "échec de connexion");
  } else {
    if (want("idor")) {
      const other = await prisma.school.findFirst({ where: { id: { not: schoolA } }, select: { id: true } });
      const cat = await prisma.subjectCategory.upsert({
        where: { id: "quality-idor-probe-category" },
        update: { description: null, schoolId: other.id, isActive: true },
        create: { id: "quality-idor-probe-category", schoolId: other.id, name: "QUALITY-IDOR", code: "QIDOR" },
      });
      const g = await fetch(`${BASE}/api/subjects/categories/${cat.id}`, { headers: { cookie: adminA.cookie } });
      check("H5", "GET catégorie d'une autre école", [403, 404].includes(g.status), `HTTP ${g.status}`);
      const p = await fetch(`${BASE}/api/subjects/categories/${cat.id}`, {
        method: "PATCH",
        headers: { cookie: adminA.cookie, "content-type": "application/json" },
        body: JSON.stringify({ description: "quality-idor-write" }),
      });
      const after = await prisma.subjectCategory.findUnique({ where: { id: cat.id } });
      check("H5", "PATCH catégorie d'une autre école", [403, 404].includes(p.status) && after?.description !== "quality-idor-write", `HTTP ${p.status}, persisté=${after?.description === "quality-idor-write"}`);
      const d = await fetch(`${BASE}/api/subjects/categories/${cat.id}`, { method: "DELETE", headers: { cookie: adminA.cookie } });
      // Le DELETE de cette route est une suppression logique (isActive=false).
      const still = await prisma.subjectCategory.findUnique({ where: { id: cat.id } });
      const deleted = !still || still.isActive === false;
      check("H5", "DELETE catégorie d'une autre école", [403, 404].includes(d.status) && !deleted, `HTTP ${d.status}, supprimée/désactivée=${deleted}`);
      if (still) await prisma.subjectCategory.delete({ where: { id: cat.id } });
    }
    if (want("tenant")) {
      const other = await prisma.school.findFirst({ where: { id: { not: schoolA } }, select: { id: true } });
      const r = await fetch(`${BASE}/api/students?schoolId=${other.id}`, { headers: { cookie: adminA.cookie } });
      check("TENANT", "?schoolId d'une autre école", r.status === 403, `HTTP ${r.status}`);
    }
  }
  await prisma.$disconnect();
}

// H1 — /api/health accessible sans session (healthcheck Docker).
if (want("health")) {
  const r = await fetch(`${BASE}/api/health`);
  const body = await r.text();
  check("H1", "GET /api/health anonyme", r.status === 200 || (r.status === 503 && body.includes("degraded")), `HTTP ${r.status} ${body.slice(0, 80)}`);
}

// H2 — les crons atteignent leur propre contrôle CRON_SECRET (et non le 401 du middleware).
if (want("cron")) {
  for (const route of ["/api/system/automation", "/api/system/retention"]) {
    const bad = await fetch(`${BASE}${route}`, { method: "POST", headers: { authorization: "Bearer wrong-secret" } });
    const badBody = await bad.text();
    check("H2", `${route} secret invalide`, bad.status === 401 && !badBody.includes("Non authentifié"), `HTTP ${bad.status} ${badBody.slice(0, 60)}`);
    if (process.env.CRON_SECRET) {
      const ok = await fetch(`${BASE}${route}`, { method: "POST", headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
      await ok.arrayBuffer();
      // Depuis N8 (Lot 3), la maintenance est acceptée puis exécutée après la
      // réponse : 202, ou 409 si une exécution est déjà en cours.
      const accepted = route === "/api/system/automation" ? [202, 409] : [200];
      check("H2", `${route} secret valide`, accepted.includes(ok.status), `HTTP ${ok.status}`);
    }
  }
}

// M3 — JSON invalide / corps vide → 400 (et non 500).
if (want("json")) {
  const admin = await login(ROLE_ACCOUNTS.SCHOOL_ADMIN, DEMO_PASSWORD);
  for (const [label, body] of [["corps vide {}", "{}"], ["JSON cassé", "{bad"]]) {
    const r = await fetch(`${BASE}/api/classes`, { method: "POST", headers: { cookie: admin.cookie, "content-type": "application/json" }, body });
    await r.arrayBuffer();
    check("M3", `POST /api/classes ${label}`, r.status === 400, `HTTP ${r.status}`);
  }
}

const failed = results.filter((r) => !r.pass).length;
console.log(`\nSÉCURITÉ: ${results.length - failed}/${results.length} PASS`);
process.exit(failed ? 1 : 0);
