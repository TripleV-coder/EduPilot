#!/usr/bin/env node
/**
 * Affiche les secrets techniques dérivés de NEXTAUTH_SECRET
 * (même calcul que src/lib/security/derived-secrets.ts, vérifié par
 * tests/lib/derived-secrets.test.ts).
 *
 * Usage, AVANT de changer NEXTAUTH_SECRET :
 *   NEXTAUTH_SECRET='<secret actuel>' node scripts/secrets/print-derived.mjs
 * puis copier les lignes affichées dans l'environnement de production : les
 * secrets 2FA et les clés des comptes marchands restent lisibles après la
 * rotation. Les variables déjà définies ne sont pas affichées (elles priment).
 *
 * Le secret est lu dans l'environnement, jamais en argument (historique du shell).
 */
import { hkdfSync } from "node:crypto";

const OVERRIDES = {
    "totp-encryption": "TOTP_ENCRYPTION_KEY",
    "signature-salt": "SIGNATURE_SALT",
    "payment-secrets": "PAYMENT_SECRETS_KEY",
    cron: "CRON_SECRET",
};

const master = (process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET)?.trim();
if (!master || master.length < 32) {
    console.error("NEXTAUTH_SECRET absent ou trop court (32 caractères au moins).");
    process.exit(1);
}

for (const [purpose, name] of Object.entries(OVERRIDES)) {
    if (process.env[name]?.trim()) continue;
    const value = Buffer.from(hkdfSync("sha256", master, "edupilot:derived-secrets:v1", `edupilot:${purpose}`, 32)).toString("hex");
    console.log(`${name}=${value}`);
}
