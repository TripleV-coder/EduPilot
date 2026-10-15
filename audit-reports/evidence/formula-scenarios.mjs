// Scénarios dynamiques du moteur de formules, contre le serveur local (base jetable).
// Oracle : moyennes de matière recalculées ici, en fractions exactes, à partir des
// notes brutes renvoyées par GET /api/grades (aucun code de l'application réutilisé).
// Usage : QUALITY_BASE_URL=… QUALITY_DATABASE_URL=… QUALITY_DISPOSABLE_DB=1 QUALITY_PASSWORD=… node formula-scenarios.mjs
import { BASE, login, ROLE_ACCOUNTS, DEMO_PASSWORD, prismaForDisposableDb } from "../../scripts/quality/lib.mjs";

const results = [];
const record = (id, name, ok, detail) => {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} [${id}] ${name} — ${typeof detail === "string" ? detail : JSON.stringify(detail)}`);
};

// ── Fractions exactes (BigInt) ──
const gcd = (a, b) => (b === 0n ? (a < 0n ? -a : a) : gcd(b, a % b));
const Q = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return { n: n / g, d: d / g }; };
const add = (a, b) => Q(a.n * b.d + b.n * a.d, a.d * b.d);
const mean = (xs) => { if (!xs.length) return null; const s = xs.reduce(add, Q(0n)); return Q(s.n, s.d * BigInt(xs.length)); };
const cents = (x) => { const s = x.n * 100n; const b = s / x.d; return (s - b * x.d) * 2n >= x.d ? b + 1n : b; }; // demi vers le haut (x ≥ 0)

/** Moyenne de matière par l'oracle ; `compoWeight` = nombre de fois où chaque composition compte. */
function oracleSubject(grades, compoWeight) {
  const I = [], D = [], C = [];
  for (const g of grades) {
    if (!g.countsInAverage || g.isExcused) continue;
    const cat = g.evaluationType?.category;
    if (!cat) return { skip: "catégorie absente" };
    let v;
    if (g.isAbsent) v = Q(0n); // absence non justifiée = 0 (règle par défaut, vérifiée en F0)
    else if (g.value === null) continue; // case vide : « NC », exclue
    else v = Q(BigInt(Math.round(g.value * 100)) * 20n, BigInt(Math.round(g.maxValue * 100)));
    (cat === "INTERROGATION" ? I : cat === "DEVOIR" ? D : C).push(v);
  }
  if (!D.length && !C.length) return { skip: "aucun devoir compté (règle NC)" };
  const items = [];
  const mi = mean(I);
  if (mi) items.push(mi);
  items.push(...D);
  for (let k = 0; k < compoWeight; k++) items.push(...C);
  return { value: mean(items) };
}

async function getJson(path, cookie, init = {}) {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { cookie, "content-type": "application/json", ...(init.headers || {}) } });
  return { status: r.status, body: await r.json().catch(() => null) };
}

function compareAll(label, data, summary, frozenPeriods, compoWeight) {
  const groups = new Map();
  for (const g of data) {
    const k = `${g.period.id}|${g.classSubjectId}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(g);
  }
  const rows = [];
  for (const [k, gs] of groups) {
    const [periodId, csId] = k.split("|");
    const shown = summary?.periods?.[periodId]?.subjects?.[csId];
    if (shown === undefined) continue; // matière d'une autre classe (ancienne inscription)
    const o = oracleSubject(gs, frozenPeriods.has(periodId) ? 1 : compoWeight);
    if (o.skip) continue;
    const expected = Number(cents(o.value)) / 100;
    rows.push({ periodId: periodId.slice(-4), subject: gs[0].subject.name, frozen: frozenPeriods.has(periodId), expected, shown, absDiff: shown === null ? null : Math.abs(shown - expected) });
  }
  const mismatches = rows.filter((r) => r.shown === null || r.absDiff !== 0);
  return { label, compared: rows.length, mismatches, rows };
}

const admin = await login(ROLE_ACCOUNTS.SCHOOL_ADMIN, DEMO_PASSWORD);
const student = await login(ROLE_ACCOUNTS.STUDENT, DEMO_PASSWORD);
const otherAdmin = await login(ROLE_ACCOUNTS.SCHOOL_ADMIN_OTHER, DEMO_PASSWORD);
const prisma = prismaForDisposableDb();

const cfg0 = await getJson("/api/config/grading", admin.cookie);
const original = cfg0.body.settings;
const calc = original.calculation;
const defaults = cfg0.body.defaults.calculation;
const isDefault = JSON.stringify(calc) === JSON.stringify(defaults);
record("F0", "réglages de l'école lisibles, règles par défaut (prérequis de l'oracle)", cfg0.status === 200 && isDefault, { status: cfg0.status, subjectFormula: calc.subjectFormula, unjustifiedAbsence: calc.unjustifiedAbsence });

// Périodes figées (conseil validé) de la classe de l'élève
const studentId = (await prisma.user.findUnique({ where: { email: ROLE_ACCOUNTS.STUDENT }, select: { studentProfile: { select: { id: true } } } })).studentProfile.id;
const enr = await prisma.enrollment.findFirst({ where: { studentId, status: "ACTIVE" }, orderBy: { enrolledAt: "desc" }, select: { classId: true } });
const frozen = new Set((await prisma.classCouncil.findMany({ where: { classId: enr.classId }, select: { periodId: true } })).map((c) => c.periodId));

// S1 — formule par défaut vs oracle
const g1 = await getJson("/api/grades?limit=500", student.cookie);
const s1 = compareAll("S1 formule officielle", g1.body.data, g1.body.summary, frozen, 1);
record("S1", "formule par défaut : moyennes de matière = oracle exact", g1.status === 200 && s1.compared > 0 && s1.mismatches.length === 0, { compared: s1.compared, mismatches: s1.mismatches.slice(0, 5), frozenPeriods: frozen.size });

// S2/S3 — modification de la formule (composition comptée deux fois)
const modified = { ...original, calculation: { ...calc, subjectFormula: "moyenne(MI ; DEVOIRS ; COMPOS ; COMPOS)" } };
const put = await getJson("/api/config/grading", admin.cookie, { method: "PUT", body: JSON.stringify(modified) });
const reread = (await getJson("/api/config/grading", admin.cookie)).body.settings.calculation.subjectFormula;
record("S2", "formule modifiée enregistrée (PUT 200, relue par GET)", put.status === 200 && reread === modified.calculation.subjectFormula, { status: put.status, recalculation: put.body?.recalculation, reread });
const g2 = await getJson("/api/grades?limit=500", student.cookie);
const s2 = compareAll("S3 composition double", g2.body.data, g2.body.summary, frozen, 2);
const changed = s1.rows.some((r) => !r.frozen && s2.rows.find((x) => x.periodId === r.periodId && x.subject === r.subject && x.shown !== r.shown));
record("S3", "nouvelle formule appliquée immédiatement (oracle composition double ; périodes figées inchangées)", s2.compared > 0 && s2.mismatches.length === 0, { compared: s2.compared, mismatches: s2.mismatches.slice(0, 5), someValueChanged: changed });

// S5 — formule invalide : refusée, ne remplace pas la formule valide
const bad = await getJson("/api/config/grading", admin.cookie, { method: "PUT", body: JSON.stringify({ ...original, calculation: { ...calc, subjectFormula: "(MI + " } }) });
const after = (await getJson("/api/config/grading", admin.cookie)).body.settings.calculation.subjectFormula;
record("S5", "formule invalide refusée (400) et formule valide conservée", bad.status === 400 && after === modified.calculation.subjectFormula, { status: bad.status, error: bad.body?.error, kept: after });
const bad2 = await getJson("/api/config/grading", admin.cookie, { method: "PUT", body: JSON.stringify({ ...original, calculation: { ...calc, subjectFormula: "(MI + MD) / 3" } }) });
record("S5b", "formule mal pondérée (20 partout ≠ 20) refusée", bad2.status === 400, { status: bad2.status, error: bad2.body?.error });

// S9 — isolation : l'autre école n'est pas affectée ; un enseignant ne peut pas écrire
const other = await getJson("/api/config/grading", otherAdmin.cookie);
record("S9", "isolation : formule de l'autre école inchangée", other.status === 200 && other.body.settings.calculation.subjectFormula !== modified.calculation.subjectFormula, { otherFormula: other.body?.settings?.calculation?.subjectFormula });
const teacher = await login(ROLE_ACCOUNTS.TEACHER, DEMO_PASSWORD);
const tput = await getJson("/api/config/grading", teacher.cookie, { method: "PUT", body: JSON.stringify(modified) });
record("S9b", "un enseignant ne peut pas modifier les règles de l'école", tput.status === 403, { status: tput.status });

// Restauration de la formule d'origine
const restore = await getJson("/api/config/grading", admin.cookie, { method: "PUT", body: JSON.stringify(original) });
const g3 = await getJson("/api/grades?limit=500", student.cookie);
const s3 = compareAll("restauration", g3.body.data, g3.body.summary, frozen, 1);
record("S1bis", "formule d'origine restaurée : retour exact aux valeurs de S1", restore.status === 200 && s3.mismatches.length === 0 && JSON.stringify(s3.rows) === JSON.stringify(s1.rows), { status: restore.status, compared: s3.compared });

await prisma.$disconnect();
const pass = results.filter((r) => r.ok).length;
console.log(`FORMULES: ${pass}/${results.length} PASS`);
console.log("DETAIL_S1", JSON.stringify(s1.rows));
console.log("DETAIL_S3", JSON.stringify(s2.rows));
process.exit(pass === results.length ? 0 : 1);
