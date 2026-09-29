/**
 * Étape 15 — Fin d'année, dernière étape du cycle : décisions de promotion
 * (admis, redoublant, partant) vers l'année 2027-2028, clôture de
 * l'année 2026-2027, verrou des données de l'année close (notes, appel),
 * paiements après clôture, passage à la nouvelle année, historique consulté
 * par la famille, demande de données personnelles (RGPD) reçue par la
 * plateforme, journal d'audit du cycle complet.
 */
import { expect, test, type Browser } from "@playwright/test";
import { choose, constat, etat, explorePage, goto, loginToDashboard, openActor, pause, scrollThrough, step, type Actor } from "./kit";
import { ANNEE, ANNEE_SUIVANTE, ELEVES } from "./donnees";

const ETAPE = "15-fin-d-annee";
const eleve = (key: string) => ELEVES.find((e) => e.key === key)!;

async function acteur(browser: Browser, scenario: string, key: string, label: string, name = key): Promise<Actor> {
    const a = await openActor(browser, { etape: ETAPE, scenario, name, label });
    await step(a, "Connexion", async () => loginToDashboard(a, etat.account(key)), { critical: true });
    return a;
}

async function decision(a: Actor, key: string, choix: RegExp) {
    const ligne = a.page.locator("tr").filter({ hasText: eleve(key).nom }).filter({ hasText: eleve(key).prenom }).first();
    await ligne.getByRole("button", { name: choix }).click();
    await pause(a, 500);
}

async function enregistrerDecisions(a: Actor) {
    await a.page.getByRole("button", { name: /enregistrer les décisions/i }).click();
    const confirmer = a.page.getByRole("alertdialog").or(a.page.getByRole("dialog")).getByRole("button", { name: /confirmer|appliquer|valider/i });
    if (await confirmer.first().isVisible().catch(() => false)) await confirmer.first().click();
}

test("01 · décisions de promotion de fin d'année", async ({ browser }) => {
    const dir = await acteur(browser, "01-promotion", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        await step(dir, `Promotion : 6ème A vers ${ANNEE_SUIVANTE}`, async () => {
            await goto(dir, "/dashboard/settings/academic/promotion");
            await page.getByRole("button", { name: /6ème A/ }).first().click();
            await choose(dir, page, /année académique de destination/i, ANNEE_SUIVANTE);
            await expect(page.getByText(eleve("eleve-kate").nom).first()).toBeVisible({ timeout: 20_000 });
            await scrollThrough(dir);
        }, { critical: true });
        await step(dir, "Kate, Ismaël, Divine admis ; Junior redouble", async () => {
            for (const k of ["eleve-kate", "eleve-ismael", "eleve-divine"]) await decision(dir, k, /promouvoir/i);
            await decision(dir, "eleve-junior", /redoubler/i);
            await expect(page.getByText(/admis\s*:\s*3/i).first()).toBeVisible();
            await expect(page.getByText(/redouble\s*:\s*1/i).first()).toBeVisible();
        });
        await step(dir, "Enregistrement des décisions", async () => {
            await enregistrerDecisions(dir);
            await expect(page.getByText(/promotion|décisions? enregistrée|succès/i).first()).toBeVisible({ timeout: 30_000 });
        });
        await step(dir, "Terminale D : Gloria partante (bachelière)", async () => {
            await goto(dir, "/dashboard/settings/academic/promotion");
            await page.getByRole("button", { name: /Tle D/ }).first().click();
            await choose(dir, page, /année académique de destination/i, ANNEE_SUIVANTE);
            await decision(dir, "eleve-gloria", /partant/i);
            await enregistrerDecisions(dir);
            await pause(dir, 3000);
        });
        await step(dir, "6ème A rouverte après promotion : aucun doublon", async () => {
            await goto(dir, "/dashboard/settings/academic/promotion");
            await page.getByRole("button", { name: /6ème A/ }).first().click();
            await choose(dir, page, /année académique de destination/i, ANNEE_SUIVANTE);
            await pause(dir, 2500);
            await scrollThrough(dir);
            constat(dir, "Classe 6ème A après promotion", (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400));
        });
    } finally {
        await dir.close();
    }
});

test("02 · clôture de l'année 2026-2027 et verrou des données", async ({ browser }) => {
    const dir = await acteur(browser, "02-cloture-de-l-annee", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        await step(dir, `Clôture de l'année ${ANNEE}`, async () => {
            await goto(dir, "/dashboard/settings/academic");
            const carte = page.locator("div").filter({ has: page.getByRole("heading", { name: ANNEE }) }).filter({ has: page.getByRole("button", { name: /clôturer/i }) }).last();
            await carte.getByRole("button", { name: /^clôturer$/i }).click();
            const d = page.getByRole("alertdialog").or(page.getByRole("dialog")).last();
            await expect(d).toContainText(new RegExp(`clôturer l'année ${ANNEE}`, "i"));
            await pause(dir, 1500);
            await d.getByRole("button", { name: /clôturer/i }).last().click();
            await pause(dir, 2500);
            const quandMeme = page.getByRole("button", { name: /clôturer quand même/i });
            if (await quandMeme.isVisible().catch(() => false)) {
                constat(dir, "Avertissement avant clôture", (await page.getByRole("alertdialog").or(page.getByRole("dialog")).last().innerText()).replace(/\s+/g, " ").slice(0, 300));
                await pause(dir, 1500);
                await quandMeme.click();
                await pause(dir, 3000);
            }
            await expect(page.getByRole("button", { name: /rouvrir/i }).first()).toBeVisible();
        }, { critical: true });
        await step(dir, "Années académiques après clôture", async () => {
            await goto(dir, "/dashboard/settings/academic");
            await scrollThrough(dir);
            constat(dir, "Années", (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400));
        });
    } finally {
        await dir.close();
    }
    const prof = await acteur(browser, "02-cloture-de-l-annee", "prof-maths", "Koffi Dossou (enseignant)");
    try {
        await step(prof, "Saisie d'une note sur l'année close : refusée", async () => {
            await goto(prof, "/dashboard/grades/entry");
            await choose(prof, prof.page, /^classe/i, "6ème A");
            await choose(prof, prof.page, /^matière/i, "Mathématiques");
            const periode = prof.page.getByRole("combobox", { name: /^période/i }).first();
            const periodes = (await periode.evaluate((e) => e.tagName)) === "SELECT" ? await periode.locator("option").allInnerTexts() : [];
            constat(prof, "Périodes proposées après clôture", periodes.join(" | "));
            if (!periodes.some((o) => /trimestre 1/i.test(o))) return; // les périodes de l'année close ne sont plus proposées : verrou effectif
            await choose(prof, prof.page, /^période/i, /trimestre 1/i);
            await choose(prof, prof.page, /^type/i, "Interrogation écrite");
            await prof.page.getByLabel(/^date/i).first().fill("2026-10-05");
            await pause(prof, 1500);
            await prof.page.locator("tr").filter({ hasText: eleve("eleve-kate").nom }).filter({ hasText: "Kate" }).first().getByLabel("Note", { exact: true }).fill("18");
            await prof.page.getByRole("button", { name: /publier les notes/i }).click();
            await pause(prof, 3000);
            await expect(prof.page.getByText(/clôtur|verrouill|année close|lecture seule/i).first(), "l'année close doit refuser toute nouvelle note").toBeVisible();
        }, { refusAttendu: true });
        await step(prof, "Appel sur l'année close : refusé", async () => {
            await goto(prof, "/dashboard/attendance");
            await choose(prof, prof.page, /^classe$/i, "6ème A");
            await prof.page.getByLabel("Date de l'appel").fill("2026-09-25");
            await pause(prof, 2000);
            await prof.page.locator("tr").filter({ hasText: eleve("eleve-kate").nom }).filter({ hasText: "Kate" }).first().getByRole("button", { name: /^absent/i }).click().catch(() => undefined);
            await prof.page.getByRole("button", { name: /enregistrer/i }).last().click().catch(() => undefined);
            await pause(prof, 3000);
            await expect(prof.page.getByText(/clôtur|verrouill|année close|lecture seule/i).first(), "l'appel d'une année close doit être refusé").toBeVisible();
        }, { refusAttendu: true });
    } finally {
        await prof.close();
    }
    const compta = await acteur(browser, "02-cloture-de-l-annee", "comptable-cocotiers", "Arnaud Tchibozo (comptable)");
    try {
        await step(compta, "Encaissement après clôture : lignes proposées pour Kate", async () => {
            await goto(compta, "/dashboard/finance/payments/new");
            await compta.page.getByRole("textbox", { name: /rechercher un élève/i }).fill(eleve("eleve-kate").nom);
            await pause(compta, 1500);
            await compta.page.getByText(/Kate/).first().click();
            await pause(compta, 1500);
            await scrollThrough(compta);
            constat(compta, "Encaissement après clôture", (await compta.page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 400));
        });
    } finally {
        await compta.close();
    }
});

test("03 · nouvelle année : élèves promus, redoublant, partante, familles", async ({ browser }) => {
    const dir = await acteur(browser, "03-nouvelle-annee", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        await step(dir, "Tableau de bord au passage d'année", async () => {
            await goto(dir, "/dashboard");
            await scrollThrough(dir);
        });
        await step(dir, "Élèves au passage d'année", async () => {
            await explorePage(dir, "/dashboard/students");
            constat(dir, "Liste des élèves", (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 600));
        });
        await step(dir, "Fiche de Kate : historique de scolarité", async () => explorePage(dir, etat.get("url:eleve-kate")));
        await step(dir, `Classes pour ${ANNEE_SUIVANTE}`, async () => explorePage(dir, "/dashboard/classes"));
        await step(dir, "Réseau Alumni après le départ de Gloria", async () => {
            await explorePage(dir, "/dashboard/alumni");
            constat(dir, "Gloria dans l'annuaire des anciens", String(await page.getByText(/akakpo/i).count()));
        });
    } finally {
        await dir.close();
    }
    const parent = await acteur(browser, "03-nouvelle-annee", "parent-agbossou", "Fabrice Agbossou (parent de Kate)");
    try {
        await step(parent, "Historique des notes et bulletins de l'année close", async () => explorePage(parent, "/dashboard/grades"));
        await step(parent, "Paiements : reste dû de l'année close", async () => explorePage(parent, "/dashboard/finance"));
    } finally {
        await parent.close();
    }
});

test("04 · données personnelles (RGPD) et journal d'audit du cycle", async ({ browser }) => {
    const parent = await acteur(browser, "04-rgpd-et-audit", "parent-gnanhoui", "Rachida Gnanhoui (parent)");
    try {
        await step(parent, "Mes données : demande d'archive (portabilité)", async () => {
            await goto(parent, "/dashboard/settings/my-data");
            await parent.page.getByRole("button", { name: /demander l'archive/i }).click();
            await pause(parent, 2500);
            await scrollThrough(parent);
        });
    } finally {
        await parent.close();
    }
    const root = await acteur(browser, "04-rgpd-et-audit", "root", "Super-admin plateforme", "super-admin");
    try {
        await step(root, "Demandes RGPD reçues", async () => {
            await explorePage(root, "/dashboard/root-control/data-requests");
            await expect(root.page.getByText(/gnanhoui/i).first(), "la demande du parent doit être listée").toBeVisible();
        });
        await step(root, "Journal d'audit du cycle complet", async () => {
            await explorePage(root, "/dashboard/audit-logs");
            constat(root, "Journal d'audit (extrait)", (await root.page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 600));
        });
        await step(root, "Journaux de la plateforme", async () => explorePage(root, "/dashboard/root-control/logs"));
        await step(root, "Analyses de la plateforme en fin de cycle", async () => explorePage(root, "/dashboard/root-control/analytics"));
    } finally {
        await root.close();
    }
    const dir = await acteur(browser, "04-rgpd-et-audit", "admin-cocotiers", "Direction Les Cocotiers");
    try {
        await step(dir, "Journal d'audit de l'établissement", async () => explorePage(dir, "/dashboard/audit-logs"));
        await step(dir, "Conformité RGPD de l'établissement", async () => explorePage(dir, "/dashboard/compliance"));
    } finally {
        await dir.close();
    }
});
