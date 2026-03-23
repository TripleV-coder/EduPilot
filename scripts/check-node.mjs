#!/usr/bin/env node
/**
 * Vérifie que Node.js >= 20.9.0 (requis par Next.js 16).
 * Affiche un message clair si la version est trop ancienne.
 */
const [major, minor] = process.version.slice(1).split(".").map(Number);
const ok = major > 20 || (major === 20 && minor >= 9);

if (!ok) {
  console.error("\n\u274c Node.js " + process.version + " détecté.");
  console.error("   EduPilot nécessite Node.js >= 20.9.0 (Next.js 16).\n");
  console.error("   À faire :");
  console.error("     nvm use       # si vous utilisez nvm (recommandé)");
  console.error("     ou installez Node 20+ depuis https://nodejs.org\n");
  process.exit(1);
}
