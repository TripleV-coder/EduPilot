#!/usr/bin/env node
/**
 * Captures d'écran avant/après, pour prouver qu'un changement technique ne
 * touche pas à l'apparence (règle 9 : design gelé).
 *
 *   QUALITY_BASE_URL=… QUALITY_PASSWORD=… node scripts/quality/screenshots.mjs <dossier> [RÔLE]
 *
 * Les animations d'entrée sont attendues terminées avant la capture : on
 * compare l'état final, pas une image prise au milieu du mouvement.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { BASE, login, ROLE_ACCOUNTS, DEMO_PASSWORD } from "./lib.mjs";

const outDir = path.resolve(process.argv[2] ?? ".quality-tmp/shots");
const role = process.argv[3] && ROLE_ACCOUNTS[process.argv[3]] ? process.argv[3] : "SCHOOL_ADMIN";
mkdirSync(outDir, { recursive: true });

const PAGES = [
  ["accueil", "/dashboard"],
  ["eleves", "/dashboard/students"],
  ["notes", "/dashboard/grades"],
  ["incidents", "/dashboard/incidents"],
  ["finance", "/dashboard/finance"],
  ["analyses", "/dashboard/analytics"],
  ["reglages", "/dashboard/settings"],
  ["connexion", "/login"],
];

const auth = await login(ROLE_ACCOUNTS[role], process.env.QUALITY_PASSWORD || DEMO_PASSWORD);
if (!auth.cookie) {
  console.error(`Connexion impossible pour ${role}.`);
  process.exit(1);
}

const browser = await chromium.launch({ args: ["--no-sandbox"] });
for (const [device, viewport] of [["bureau", { width: 1280, height: 900 }], ["mobile", { width: 375, height: 812 }]]) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addCookies(
    auth.cookie.split("; ").map((pair) => {
      const [name, ...rest] = pair.split("=");
      return { name, value: rest.join("="), domain: "localhost", path: "/" };
    }),
  );
  const page = await context.newPage();
  for (const [name, url] of PAGES) {
    await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" }).catch(() => {});
    // Laisser les animations d'entrée se terminer.
    await page.waitForTimeout(1200);
    const file = path.join(outDir, `${device}-${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log("capturé", path.relative(process.cwd(), file));
  }
  await context.close();
}
await browser.close();
