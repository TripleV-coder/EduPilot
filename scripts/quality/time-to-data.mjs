#!/usr/bin/env node
/**
 * Temps jusqu'aux DONNÉES à l'écran, sur un vrai navigateur, réseau et
 * processeur bridés — ce que la personne attend réellement.
 *
 * Lighthouse mesure quand « quelque chose » s'affiche : souvent un squelette.
 * Ici on attend qu'un contenu réel remplace l'état de chargement.
 *
 *   QUALITY_BASE_URL=… QUALITY_PASSWORD=… node scripts/quality/time-to-data.mjs [RÔLE]
 */
import { chromium } from "@playwright/test";
import { BASE, login, ROLE_ACCOUNTS, DEMO_PASSWORD } from "./lib.mjs";

const role = process.argv[2] && ROLE_ACCOUNTS[process.argv[2]] ? process.argv[2] : "SCHOOL_ADMIN";

/** Pages mesurées. */
const PAGES = [
  "/dashboard",
  "/dashboard/students",
  "/dashboard/grades",
  "/dashboard/finance",
  "/dashboard/classes",
  "/dashboard/analytics",
];

const auth = await login(ROLE_ACCOUNTS[role], process.env.QUALITY_PASSWORD || DEMO_PASSWORD);
if (!auth.cookie) {
  console.error(`Connexion impossible pour ${role}.`);
  process.exit(1);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext();
await context.addCookies(
  auth.cookie.split("; ").map((pair) => {
    const [name, ...rest] = pair.split("=");
    return { name, value: rest.join("="), domain: "localhost", path: "/" };
  }),
);

const page = await context.newPage();
// Bridage : 4G lente (1,6 Mb/s, 150 ms de latence) et processeur ÷4.
const cdp = await context.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

console.log(`Cascade de chargement — rôle ${role} — 4G lente, CPU ÷4\n`);
console.log("HTML     1re donnée  dernière    appels  JS+CSS     page");
for (const path of PAGES) {
  let bytes = 0;
  const apiTimes = [];
  const t0 = Date.now();

  const onResponse = async (res) => {
    const type = res.request().resourceType();
    if (type === "script" || type === "stylesheet") {
      try {
        bytes += (await res.body()).length;
      } catch {
        /* réponse déjà libérée */
      }
    }
    if (res.url().includes("/api/") && !res.url().includes("/api/auth/")) {
      apiTimes.push(Date.now() - t0);
    }
  };
  page.on("response", onResponse);

  await page.goto(`${BASE}${path}`, { waitUntil: "commit" });
  const htmlMs = Date.now() - t0;
  // Laisser la page s'hydrater puis chercher ses données, jusqu'au silence réseau.
  try {
    await page.waitForLoadState("networkidle", { timeout: 30_000 });
  } catch {
    /* réseau jamais silencieux : on prend ce qu'on a */
  }
  page.off("response", onResponse);

  const first = apiTimes.length ? Math.min(...apiTimes) : -1;
  const last = apiTimes.length ? Math.max(...apiTimes) : -1;
  console.log(
    `${(htmlMs + " ms").padEnd(8)} ${(first < 0 ? "—" : first + " ms").padEnd(11)} ` +
    `${(last < 0 ? "—" : last + " ms").padEnd(11)} ${String(apiTimes.length).padEnd(7)} ` +
    `${(Math.round(bytes / 1024) + " Ko").padEnd(10)} ${path}`,
  );
}

await browser.close();
