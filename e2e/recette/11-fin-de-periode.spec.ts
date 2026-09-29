/**
 * Étape 11 — Fin de période (1er trimestre) : conseil de classe au collège
 * (moyennes, mentions selon les seuils configurés, avis, clôture), bulletins
 * individuels et de classe (impression / PDF), bulletin du primaire,
 * consultation par l'élève et par le parent, documents authentifiés.
 */
import { expect, test, type Browser } from "@playwright/test";
import { choose, constat, etat, explorePage, goto, loginToDashboard, openActor, pause, scrollThrough, step, type Actor } from "./kit";
import { ELEVES } from "./donnees";

const ETAPE = "11-fin-de-periode";
const eleve = (key: string) => ELEVES.find((e) => e.key === key)!;
const TRIMESTRE_1 = /trimestre 1/i;

async function acteur(browser: Browser, scenario: string, key: string, label: string, name = key): Promise<Actor> {
    const a = await openActor(browser, { etape: ETAPE, scenario, name, label });
    // L'impression passe par la boîte d'impression du navigateur : elle est interceptée et tracée.
    await a.context.addInitScript(() => {
        window.print = () => {
            // react-to-print imprime depuis une iframe : la trace est posée sur la page principale.
            try {
                (window.top ?? window).document.documentElement.setAttribute("data-impression-demandee", String(Date.now()));
            } catch {
                document.documentElement.setAttribute("data-impression-demandee", String(Date.now()));
            }
        };
    });
    await step(a, "Connexion", async () => loginToDashboard(a, etat.account(key)), { critical: true });
    return a;
}

test("01 · conseil de classe de la 6ème A (1er trimestre)", async ({ browser }) => {
    const dir = await acteur(browser, "01-conseil-de-classe-college", "directeur-cocotiers", "Clarisse Hounkpatin (directrice des études)");
    const page = dir.page;
    try {
        await step(dir, "Préparation du conseil : 6ème A, trimestre 1", async () => {
            await goto(dir, "/dashboard/grades/councils");
            await choose(dir, page, /^classe/i, "6ème A");
            await choose(dir, page, /^période/i, TRIMESTRE_1);
            await page.getByRole("button", { name: /^préparer$/i }).click();
            await expect(page.getByText(eleve("eleve-kate").nom).first()).toBeVisible({ timeout: 30_000 });
            await scrollThrough(dir);
        }, { critical: true });
        await step(dir, "Mentions selon les seuils (tableau d'honneur ≥ 15, encouragements ≥ 13, avertissement < 10)", async () => {
            const ligneKate = page.locator("tr, li").filter({ hasText: eleve("eleve-kate").nom }).filter({ hasText: "Kate" }).first();
            constat(dir, "Ligne de Kate au conseil", (await ligneKate.innerText()).replace(/\s+/g, " "));
            await expect(ligneKate, "Kate (≈ 15 de moyenne) doit obtenir une mention").toContainText(/honneur|encouragement|félicitation/i);
        });
        await step(dir, "Avis du conseil pour chaque élève", async () => {
            const avis = page.getByRole("textbox");
            const n = Math.min(await avis.count(), 4);
            for (let i = 0; i < n; i++) await avis.nth(i).fill(i === 0 ? "Excellent trimestre, continuez ainsi." : "Des efforts sont attendus au prochain trimestre.");
            await pause(dir, 1000);
        });
        await step(dir, "Clôture du conseil", async () => {
            await page.getByRole("button", { name: /clôturer le conseil/i }).click();
            const confirmer = page.getByRole("dialog").getByRole("button", { name: /clôturer|confirmer/i });
            if (await confirmer.isVisible().catch(() => false)) await confirmer.click();
            await pause(dir, 2500);
            await expect(page.getByText(/clôtur/i).first()).toBeVisible();
        });
    } finally {
        await dir.close();
    }
});

test("02 · bulletins du 1er trimestre : individuel et classe entière", async ({ browser }) => {
    const dir = await acteur(browser, "02-bulletins-college", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        await step(dir, "Bulletin de Kate Agbossou (6ème A, trimestre 1)", async () => {
            await goto(dir, "/dashboard/grades/bulletins");
            await choose(dir, page, /^classe/i, "6ème A");
            await choose(dir, page, /^élève/i, eleve("eleve-kate").prenom);
            await choose(dir, page, /^période/i, TRIMESTRE_1);
            await page.getByRole("button", { name: /^générer$/i }).click();
            await expect(page.getByText(/mathématiques/i).first()).toBeVisible({ timeout: 30_000 });
            await scrollThrough(dir);
        }, { critical: true });
        await step(dir, "Contenu du bulletin : moyennes, coefficients, rang, appréciations", async () => {
            const texte = await page.locator("main").innerText();
            constat(dir, "Bulletin de Kate (extrait)", texte.replace(/\s+/g, " ").slice(0, 600));
            expect(texte, "le bulletin doit afficher la moyenne de mathématiques").toMatch(/1[56][,.]\d/);
            expect(texte, "l'appréciation saisie par l'enseignant doit figurer").toMatch(/rigoureux/i);
        });
        await step(dir, "Imprimer ou enregistrer en PDF", async () => {
            await page.getByRole("button", { name: /imprimer ou enregistrer en pdf/i }).click();
            await expect(page.locator("html")).toHaveAttribute("data-impression-demandee", /\d+/, { timeout: 10_000 });
        });
        await step(dir, "Bulletins de toute la classe (un document)", async () => {
            await choose(dir, page, /^élève/i, /toute la classe/i);
            await page.getByRole("button", { name: /^générer$/i }).click();
            await expect(page.getByRole("button", { name: /imprimer la classe/i })).toBeVisible({ timeout: 60_000 });
            await page.evaluate(() => document.documentElement.removeAttribute("data-impression-demandee"));
            await page.getByRole("button", { name: /imprimer la classe/i }).click();
            await expect(page.locator("html")).toHaveAttribute("data-impression-demandee", /\d+/, { timeout: 10_000 });
            await pause(dir, 2500);
            await scrollThrough(dir);
        });
        await step(dir, "Bulletin de Divine (absente à l'interrogation)", async () => {
            await goto(dir, "/dashboard/grades/bulletins");
            await choose(dir, page, /^classe/i, "6ème A");
            await choose(dir, page, /^élève/i, eleve("eleve-divine").prenom);
            await choose(dir, page, /^période/i, TRIMESTRE_1);
            await page.getByRole("button", { name: /^générer$/i }).click();
            await pause(dir, 3000);
            await scrollThrough(dir);
        });
        await step(dir, "Générateur de documents (certificats)", async () => explorePage(dir, "/dashboard/documents"));
    } finally {
        await dir.close();
    }
});

test("03 · bulletin et conseil du primaire (CM2 A)", async ({ browser }) => {
    const dir = await acteur(browser, "03-bulletins-primaire", "admin-cocotiers-primaire", "Mireille Dossa (direction de l'annexe primaire)");
    const page = dir.page;
    try {
        await step(dir, "Bulletin d'Emmanuel Zinsou (CM2 A, trimestre 1, notes sur 10)", async () => {
            await goto(dir, "/dashboard/grades/bulletins");
            await choose(dir, page, /^classe/i, "CM2 A");
            await choose(dir, page, /^élève/i, eleve("eleve-emmanuel").prenom);
            await choose(dir, page, /^période/i, TRIMESTRE_1);
            await page.getByRole("button", { name: /^générer$/i }).click();
            await pause(dir, 3000);
            await scrollThrough(dir);
            constat(dir, "Bulletin primaire (extrait)", (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 500));
        });
        await step(dir, "Conseil des maîtres (CM2 A)", async () => {
            await goto(dir, "/dashboard/grades/councils");
            await choose(dir, page, /^classe/i, "CM2 A");
            await choose(dir, page, /^période/i, TRIMESTRE_1);
            await page.getByRole("button", { name: /^préparer$/i }).click();
            await pause(dir, 3000);
            await scrollThrough(dir);
        });
    } finally {
        await dir.close();
    }
});

test("04 · bulletins consultés par l'élève et par les parents", async ({ browser }) => {
    for (const [key, label] of [
        ["eleve-kate", "Kate Agbossou (élève)"],
        ["parent-agbossou", "Fabrice Agbossou (parent)"],
        ["parent-zinsou", "Célestin Zinsou (parent, deux sites)"],
    ] as const) {
        const a = await acteur(browser, "04-consultation-familles", key, label);
        try {
            await step(a, "Bulletin du 1er trimestre disponible", async () => {
                await explorePage(a, "/dashboard/grades");
                const bulletin = a.page.getByRole("link", { name: /bulletin/i }).or(a.page.getByRole("button", { name: /bulletin/i })).first();
                await expect(bulletin, "l'accès au bulletin doit être proposé à la famille").toBeVisible({ timeout: 10_000 });
                await bulletin.click();
                await pause(a, 2500);
                await scrollThrough(a);
            });
            await step(a, "Accueil de fin de trimestre", async () => {
                await goto(a, "/dashboard");
                await scrollThrough(a);
            });
        } finally {
            await a.close();
        }
    }
});
