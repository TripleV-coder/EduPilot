#!/usr/bin/env node
/**
 * Mesure le coût RÉEL des pages, pas seulement celui des routes d'API :
 * temps du HTML (TTFB et total), poids du HTML, puis poids et nombre des
 * fichiers JS et CSS que la page demande ensuite.
 *
 *   QUALITY_BASE_URL=http://localhost:3100 QUALITY_PASSWORD=… \
 *   node scripts/quality/pages.mjs [RÔLE] [chemins…]
 *
 * Un `smoke.mjs` vert ne dit rien de ce que ressent la personne : il mesure
 * des réponses JSON. Ici on mesure ce que le navigateur doit télécharger et
 * attendre avant de voir la page.
 */
import { BASE, login, ROLE_ACCOUNTS, DEMO_PASSWORD } from "./lib.mjs";

const role = process.argv[2] && ROLE_ACCOUNTS[process.argv[2]] ? process.argv[2] : "SCHOOL_ADMIN";
const argPaths = process.argv.slice(3).filter((a) => a.startsWith("/"));

const DEFAULT_PAGES = [
  "/dashboard",
  "/dashboard/students",
  "/dashboard/teachers",
  "/dashboard/classes",
  "/dashboard/grades",
  "/dashboard/attendance",
  "/dashboard/finance",
  "/dashboard/analytics",
  "/dashboard/schedule",
  "/dashboard/messages",
  "/dashboard/settings",
];

const pages = argPaths.length > 0 ? argPaths : DEFAULT_PAGES;

/** Fichiers référencés par le HTML (scripts et feuilles de style). */
function assetsOf(html) {
  const urls = new Set();
  for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) urls.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) urls.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+href="([^"]+)"[^>]+rel="stylesheet"/g)) urls.add(m[1]);
  // Chunks annoncés dans le flux RSC (chargés dès l'hydratation).
  for (const m of html.matchAll(/"(\/_next\/static\/chunks\/[^"]+\.js)"/g)) urls.add(m[1]);
  return [...urls].filter((u) => u.startsWith("/_next/") || u.startsWith("/"));
}

async function measure(path, cookie) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: "manual" });
  const ttfb = Date.now() - t0;
  const html = await res.text();
  const total = Date.now() - t0;

  let assetBytes = 0;
  let assetCount = 0;
  const seen = new Set();
  for (const url of assetsOf(html)) {
    if (seen.has(url)) continue;
    seen.add(url);
    const r = await fetch(`${BASE}${url}`, { headers: { cookie } });
    if (!r.ok) continue;
    assetBytes += (await r.arrayBuffer()).byteLength;
    assetCount += 1;
  }

  return {
    path,
    status: res.status,
    ttfb,
    total,
    htmlKb: Math.round(html.length / 1024),
    assetCount,
    assetKb: Math.round(assetBytes / 1024),
  };
}

const account = ROLE_ACCOUNTS[role];
const auth = await login(account, process.env.QUALITY_PASSWORD || DEMO_PASSWORD);
if (!auth.cookie) {
  console.error(`Connexion impossible pour ${role} (${account}).`);
  process.exit(1);
}

console.log(`Pages — rôle ${role} — ${BASE}\n`);
console.log("statut  TTFB    total   HTML    fichiers  JS+CSS   page");
const rows = [];
for (const path of pages) {
  const row = await measure(path, auth.cookie);
  rows.push(row);
  console.log(
    `${String(row.status).padEnd(7)} ${(row.ttfb + " ms").padEnd(7)} ${(row.total + " ms").padEnd(7)} ` +
    `${(row.htmlKb + " Ko").padEnd(7)} ${String(row.assetCount).padEnd(9)} ${(row.assetKb + " Ko").padEnd(8)} ${row.path}`,
  );
}

const ok = rows.filter((r) => r.status === 200);
const p = (arr, q) => arr.length ? arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * q))] : 0;
console.log(`\np50/p95 TTFB : ${p(ok.map((r) => r.ttfb), 0.5)} / ${p(ok.map((r) => r.ttfb), 0.95)} ms`);
console.log(`Poids max : HTML ${Math.max(...ok.map((r) => r.htmlKb))} Ko, JS+CSS ${Math.max(...ok.map((r) => r.assetKb))} Ko`);
