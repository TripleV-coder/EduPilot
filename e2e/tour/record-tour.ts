/**
 * EduPilot — Enregistrement vidéo d'un parcours EXHAUSTIF par rôle.
 *
 * Pour chaque rôle : connexion réelle → parcours de TOUTES les pages visibles
 * dans la sidebar → tentative de CRUD générique non destructif (ouvrir les
 * dialogues de création, remplir les formulaires, soumettre) → suivi des pages
 * de détail (1re ligne de tableau). Chaque action est isolée (try/catch) : un
 * échec n'interrompt jamais le parcours, il est journalisé. Une vidéo .webm est
 * produite par rôle ; ffmpeg les convertit en .mp4 + une vidéo combinée.
 *
 * Lancement :  E2E_BASE_URL=http://localhost:3093 npx tsx e2e/tour/record-tour.ts
 *
 * NON DESTRUCTIF : aucun bouton supprimer/archiver/désactiver n'est cliqué.
 * Des enregistrements de test PEUVENT être créés (c'est le but du CRUD).
 */
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import prisma from "../../src/lib/prisma";

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3093";
const PASSWORD = "E2eTestPass!2026";
const OUT_DIR = path.resolve("e2e/tour/output");
const VIDEO_W = 1280;
const VIDEO_H = 720;

// Rôles à parcourir (un compte seedé par rôle distinct).
const ROLES: { key: string; label: string; email: string }[] = [
    { key: "super-admin", label: "Super Admin (réseau)", email: "admin@edupilot.bj" },
    { key: "school-admin", label: "Direction (école)", email: "admin@saintmichel.bj" },
    { key: "director", label: "Directrice", email: "directeur@saintmichel.bj" },
    { key: "accountant", label: "Comptabilité", email: "comptable@saintmichel.bj" },
    { key: "teacher", label: "Enseignant", email: "m.agbossou@saintmichel.bj" },
    { key: "student", label: "Élève", email: "kate.agbossou0@eleve.saintmichel.bj" },
    { key: "parent", label: "Parent", email: "fabrice.agbossou0@gmail.com" },
];

type LogEntry = { role: string; page: string; action: string; ok: boolean; detail?: string };
const log: LogEntry[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function safe(role: string, pageName: string, action: string, fn: () => Promise<void>) {
    try {
        await fn();
        log.push({ role, page: pageName, action, ok: true });
    } catch (e) {
        log.push({ role, page: pageName, action, ok: false, detail: (e as Error).message.split("\n")[0].slice(0, 160) });
    }
}

async function resetPasswords() {
    const hashed = await bcrypt.hash(PASSWORD, 12);
    for (const r of ROLES) {
        const user = await prisma.user.findUnique({ where: { email: r.email }, select: { id: true } });
        if (!user) {
            console.warn(`[tour] ⚠ compte introuvable: ${r.email} (rôle ${r.key} ignoré)`);
            continue;
        }
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashed,
                isActive: true,
                lockedUntil: null,
                failedLoginAttempts: 0,
                isTwoFactorEnabled: false,
                mustChangePassword: false,
            },
        });
    }
}

async function login(page: Page, email: string): Promise<boolean> {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
    await sleep(800);
    // Bannière cookies — l'accepter pour qu'elle n'intercepte pas les clics.
    await page.getByRole("button", { name: /j.accepte/i }).click({ timeout: 2500 }).catch(() => {});
    await sleep(300);
    await page.locator("#email").fill(email);
    await sleep(300);
    await page.locator("#password").fill(PASSWORD);
    await sleep(300);
    await page.getByRole("button", { name: /se connecter/i }).click();
    try {
        await page.waitForURL(/\/dashboard($|\/)/, { timeout: 30_000 });
        await sleep(1500);
        return true;
    } catch {
        return false;
    }
}

// Nav de repli affichée tant que la session (role) n'est pas hydratée.
const FALLBACK_NAV = new Set([
    "/dashboard",
    "/dashboard/students",
    "/dashboard/calendar",
    "/dashboard/announcements",
    "/dashboard/settings",
]);

function uniqueClean(hrefs: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const h of hrefs) {
        const clean = h.split("?")[0].split("#")[0];
        if (clean && !seen.has(clean)) {
            seen.add(clean);
            out.push(clean);
        }
    }
    return out;
}

/**
 * Récupère les hrefs uniques de la sidebar. Patiente jusqu'à ~15s que la nav du
 * rôle soit hydratée (au-delà du fallback à 5 entrées). Garde le plus grand jeu
 * observé — un STUDENT/PARENT peut légitimement avoir une nav réduite.
 */
async function collectNavLinks(page: Page): Promise<string[]> {
    let best: string[] = [];
    for (let i = 0; i < 20; i++) {
        const hrefs = await page.$$eval('nav a[href^="/dashboard"]', (els) =>
            els.map((e) => (e as HTMLAnchorElement).getAttribute("href") || ""),
        );
        const links = uniqueClean(hrefs);
        if (links.length > best.length) best = links;
        const isFallback = links.length <= FALLBACK_NAV.size && links.every((l) => FALLBACK_NAV.has(l));
        if (links.length > 0 && !isFallback) return links; // nav du rôle hydratée
        await sleep(750);
    }
    return best;
}

/** Tente de remplir tous les champs visibles d'un conteneur (form/dialog/page). */
async function fillVisibleFields(scope: Page, root = "body") {
    const today = new Date().toISOString().slice(0, 10);
    // Inputs texte / nombre / date / email / tel
    const inputs = scope.locator(`${root} input:visible`);
    const n = Math.min(await inputs.count(), 25);
    for (let i = 0; i < n; i++) {
        const inp = inputs.nth(i);
        try {
            const type = (await inp.getAttribute("type")) || "text";
            if (["checkbox", "radio", "file", "submit", "button", "hidden", "search"].includes(type)) continue;
            const val = await inp.inputValue().catch(() => "x");
            if (val) continue; // ne pas écraser un champ pré-rempli
            const ph = ((await inp.getAttribute("placeholder")) || "").toLowerCase();
            let v = "Test E2E EduPilot";
            if (type === "email" || ph.includes("mail")) v = "test.e2e@example.com";
            else if (type === "number" || ph.match(/montant|note|nombre|quantit/)) v = "10";
            else if (type === "date") v = today;
            else if (type === "tel" || ph.includes("phone") || ph.includes("téléph")) v = "+22990000000";
            else if (type === "password") v = "MotDePasse!2026";
            await inp.fill(v, { timeout: 1500 });
        } catch {
            /* champ non remplissable, on continue */
        }
    }
    // Selects natifs → 2e option
    const selects = scope.locator(`${root} select:visible`);
    const sn = Math.min(await selects.count(), 15);
    for (let i = 0; i < sn; i++) {
        try {
            const opts = await selects.nth(i).locator("option").count();
            if (opts > 1) await selects.nth(i).selectOption({ index: 1 }, { timeout: 1500 });
        } catch {
            /* ignore */
        }
    }
    // Textareas
    const tas = scope.locator(`${root} textarea:visible`);
    const tn = Math.min(await tas.count(), 8);
    for (let i = 0; i < tn; i++) {
        try {
            await tas.nth(i).fill("Contenu de test automatisé EduPilot.", { timeout: 1500 });
        } catch {
            /* ignore */
        }
    }
}

const SUBMIT_RX = /^(enregistrer|créer|valider|ajouter|envoyer|sauvegarder|confirmer|soumettre|créer le|enregistrer les)/i;
const CREATE_RX = /(nouveau|nouvelle|ajouter|créer|new\b|inviter)/i;
const DESTRUCTIVE_RX = /(supprimer|effacer|désactiver|archiver|révoquer|annuler|delete|remove|déconnexion|se déconnecter)/i;

/** Sur une page : onglets, puis tentative d'un flux de création non destructif. */
async function exercisePage(page: Page, role: string, pageName: string) {
    // 1) Onglets (role=tab) — cliquer chacun pour montrer le contenu.
    await safe(role, pageName, "onglets", async () => {
        const tabs = page.getByRole("tab");
        const tn = Math.min(await tabs.count(), 6);
        for (let i = 0; i < tn; i++) {
            await tabs.nth(i).click({ timeout: 2500 }).catch(() => {});
            await sleep(700);
        }
    });

    // 2) Suivre une page de détail : 1re ligne cliquable de tableau (lecture).
    await safe(role, pageName, "détail-ligne", async () => {
        const rowLink = page.locator('table tbody tr a, [role="row"] a').first();
        if (await rowLink.count()) {
            const href = await rowLink.getAttribute("href");
            if (href && href.startsWith("/dashboard")) {
                await rowLink.click({ timeout: 2500 });
                await page.waitForLoadState("domcontentloaded").catch(() => {});
                await sleep(1500);
                await page.goBack({ timeout: 5000 }).catch(() => {});
                await sleep(800);
            }
        }
    });

    // 3) CRUD : ouvrir un dialogue/formulaire de création puis soumettre.
    await safe(role, pageName, "crud-create", async () => {
        const btns = page.getByRole("button").filter({ hasText: CREATE_RX });
        const links = page.getByRole("link").filter({ hasText: CREATE_RX });
        let target = null as null | ReturnType<typeof page.getByRole>;
        if (await btns.count()) target = btns.first();
        else if (await links.count()) target = links.first();
        if (!target) return;

        const txt = (await target.textContent())?.trim() || "";
        if (DESTRUCTIVE_RX.test(txt)) return;
        await target.click({ timeout: 3000 });
        await sleep(1500);

        // Dialogue modal ?
        const dialog = page.locator('[role="dialog"]:visible').first();
        const inDialog = (await dialog.count()) > 0;
        const scopeSel = inDialog ? '[role="dialog"]' : "body";

        await fillVisibleFields(page, scopeSel);
        await sleep(900);

        // Soumettre (jamais un bouton destructif)
        const submit = page.getByRole("button").filter({ hasText: SUBMIT_RX }).last();
        if (await submit.count()) {
            await submit.click({ timeout: 3000 }).catch(() => {});
            await sleep(2000);
        }
        // Fermer un dialogue resté ouvert (Escape, non destructif)
        if (inDialog && (await page.locator('[role="dialog"]:visible').count())) {
            await page.keyboard.press("Escape").catch(() => {});
            await sleep(500);
        }
    });
}

async function tourRole(context: BrowserContext, role: { key: string; label: string; email: string }) {
    const page = await context.newPage();
    await page.setViewportSize({ width: VIDEO_W, height: VIDEO_H });

    const ok = await login(page, role.email);
    log.push({ role: role.key, page: "/login", action: "connexion", ok });
    if (!ok) {
        console.warn(`[tour] ✗ login échoué: ${role.email}`);
        await page.close();
        return;
    }
    console.log(`[tour] ▶ ${role.label} connecté`);

    const links = await collectNavLinks(page);
    console.log(`[tour]   ${links.length} entrées de nav`);

    for (const href of links) {
        const url = `${BASE_URL}${href}`;
        await safe(role.key, href, "navigation", async () => {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
            await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
            await sleep(1200);
        });
        // Ne pas exécuter de CRUD sur les pages réseau super-admin sensibles? On les
        // garde mais sans suppression (DESTRUCTIVE filtré). On exerce la page.
        await exercisePage(page, role.key, href);
    }

    // Retour dashboard pour clôturer proprement la vidéo.
    await safe(role.key, "/dashboard", "retour", async () => {
        await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });
        await sleep(1500);
    });

    await page.close();
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    console.log("[tour] reset mots de passe…");
    await resetPasswords();

    const execPath = process.env.PW_CHROMIUM_PATH || undefined;
    const browser = await chromium.launch({ headless: true, slowMo: 120, executablePath: execPath });

    for (const role of ROLES) {
        const exists = await prisma.user.findUnique({ where: { email: role.email }, select: { id: true } });
        if (!exists) continue;
        const videoDir = path.join(OUT_DIR, role.key);
        fs.mkdirSync(videoDir, { recursive: true });
        const context = await browser.newContext({
            viewport: { width: VIDEO_W, height: VIDEO_H },
            recordVideo: { dir: videoDir, size: { width: VIDEO_W, height: VIDEO_H } },
            locale: "fr-FR",
        });
        const t0 = Date.now();
        try {
            await tourRole(context, role);
        } catch (e) {
            console.error(`[tour] erreur rôle ${role.key}:`, (e as Error).message);
        }
        await context.close(); // finalise la vidéo
        console.log(`[tour] ✓ ${role.label} terminé en ${Math.round((Date.now() - t0) / 1000)}s`);
    }

    await browser.close();
    await prisma.$disconnect();

    // Écrit le rapport JSON.
    fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(log, null, 2));
    const total = log.length;
    const fails = log.filter((l) => !l.ok).length;
    console.log(`[tour] TERMINÉ — ${total} actions, ${fails} échecs. Rapport: e2e/tour/output/report.json`);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
