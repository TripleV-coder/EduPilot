/**
 * Étape 09 — Finance : avis de paiement par niveau, encaissements par le
 * comptable (espèces, Mobile Money, chèque, paiement partiel, trop-perçu),
 * reçus, situation vue par le parent et paiement en ligne, impayés et
 * relances, exports et rapports, rapprochement bancaire, comptabilité OHADA,
 * cagnotte de classe, portefeuille, finance consolidée du réseau.
 */
import { expect, test, type Browser } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
    choose,
    constat,
    etat,
    expectDownload,
    expectEffect,
    explorePage,
    goto,
    loginToDashboard,
    openActor,
    OUT,
    pause,
    scrollThrough,
    step,
    type Actor,
} from "./kit";
import { ELEVES } from "./donnees";

const ETAPE = "09-finance";
const SUCCES = /encaissement (validé|enregistré)|paiement enregistré|reçu/i;
const eleve = (key: string) => ELEVES.find((e) => e.key === key)!;

async function acteur(browser: Browser, scenario: string, key: string, label: string, name = key): Promise<Actor> {
    const a = await openActor(browser, { etape: ETAPE, scenario, name, label });
    await step(a, "Connexion", async () => loginToDashboard(a, etat.account(key)), { critical: true });
    return a;
}

type Encaissement = { eleve: string; frais: RegExp; montant: number; mode: RegExp; reference?: string; observation: string };

let totalEncaisse = 0;

async function encaisser(a: Actor, e: Encaissement) {
    const page = a.page;
    await goto(a, "/dashboard/finance/payments/new");
    await page.getByRole("textbox", { name: /rechercher un élève/i }).fill(eleve(e.eleve).nom);
    await pause(a, 1500);
    await page.getByText(new RegExp(`${eleve(e.eleve).prenom}`, "i")).first().click();
    await pause(a, 1200);
    await choose(a, page, /ligne tarifaire/i, e.frais);
    await page.getByRole("spinbutton", { name: /montant payé/i }).fill(String(e.montant));
    await choose(a, page, /mode de paiement/i, e.mode);
    if (e.reference) await page.getByRole("textbox", { name: /référence de transaction/i }).fill(e.reference);
    await page.getByRole("textbox", { name: /observations du paiement/i }).fill(e.observation);
    await pause(a, 800);
    await page.getByRole("button", { name: /valider l'encaissement/i }).click();
    const ok = await page.getByText(SUCCES).first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
    if (ok) totalEncaisse += e.montant;
    if (ok && e.eleve === "eleve-kate" && /scolarité/i.test(e.frais.source)) etat.set("paye:kate-scolarite", String(e.montant));
}



test("01 · avis de paiement par niveau", async ({ browser }) => {
    const compta = await acteur(browser, "01-avis-de-paiement", "comptable-cocotiers", "Arnaud Tchibozo (comptable)");
    try {
        await step(compta, "Finance : tableau de bord avant encaissement", async () => explorePage(compta, "/dashboard/finance"));
        await step(compta, "Avis de paiement : Sixième, scolarité 2026-2027", async () => {
            await goto(compta, "/dashboard/finance/bulk-invoice");
            await choose(compta, compta.page, /^niveau$/i, "Sixième");
            await choose(compta, compta.page, /^frais$/i, /scolarité 6ème/i);
            await pause(compta, 1500);
            await scrollThrough(compta);
            await expect(compta.page.getByText(eleve("eleve-kate").nom).first(), "les élèves de 6ème doivent être listés").toBeVisible();
        });
        await step(compta, "Génération des avis de paiement", async () => {
            constat(compta, "Avis de paiement", await expectDownload(compta, compta.page.getByRole("button", { name: /télécharger .*avis/i })));
        });
    } finally {
        await compta.close();
    }
});

test("02 · encaissements au guichet : espèces, Mobile Money, chèque, partiel, trop-perçu", async ({ browser }) => {
    const compta = await acteur(browser, "02-encaissements", "comptable-cocotiers", "Arnaud Tchibozo (comptable)");
    const page = compta.page;
    try {
        await step(compta, "Frais d'inscription de Kate : 25 000 FCFA en espèces", async () => {
            await encaisser(compta, { eleve: "eleve-kate", frais: /frais d'inscription/i, montant: 25000, mode: /espèces|cash/i, observation: "Payé par le père au guichet" });
            await expect(page.getByText(SUCCES).first()).toBeVisible({ timeout: 20_000 });
        }, { critical: true });
        await step(compta, "Reçu de paiement", async () => {
            const recu = page.getByRole("button", { name: /reçu|imprimer|télécharger/i }).or(page.getByRole("link", { name: /reçu/i })).first();
            await expect(recu, "un reçu doit être proposé après l'encaissement").toBeVisible({ timeout: 10_000 });
            constat(compta, "Reçu", await expectDownload(compta, recu).catch(() => "(ouvert à l'écran, pas de fichier)"));
        });
        await step(compta, "Scolarité de Kate : acompte de 50 000 FCFA par Mobile Money", async () => {
            await encaisser(compta, { eleve: "eleve-kate", frais: /scolarité 6ème/i, montant: 50000, mode: /mobile|momo/i, reference: "MTN-7784512369", observation: "Premier versement sur 150 000" });
            await expect(page.getByText(SUCCES).first()).toBeVisible({ timeout: 20_000 });
        });
        await step(compta, "Scolarité d'Ismaël : 150 000 FCFA par chèque", async () => {
            await encaisser(compta, { eleve: "eleve-ismael", frais: /scolarité 6ème/i, montant: 150000, mode: /chèque/i, reference: "CHQ-0045871 Ecobank", observation: "Solde complet" });
            await expect(page.getByText(SUCCES).first()).toBeVisible({ timeout: 20_000 });
        });
        await step(compta, "Trop-perçu : 200 000 FCFA sur la scolarité déjà réglée d'Ismaël", async () => {
            await goto(compta, "/dashboard/finance/payments/new");
            await page.getByRole("textbox", { name: /rechercher un élève/i }).fill(eleve("eleve-ismael").nom);
            await pause(compta, 1500);
            await page.getByText(/Ismaël/).first().click();
            await pause(compta, 1500);
            const lignes = page.getByRole("combobox", { name: /ligne tarifaire/i }).first();
            const options = (await lignes.evaluate((e) => e.tagName)) === "SELECT" ? await lignes.locator("option").allInnerTexts() : [];
            constat(compta, "Lignes proposées pour Ismaël (scolarité soldée)", options.join(" | "));
            if (!options.some((o) => /scolarité 6ème/i.test(o))) return; // la scolarité soldée n'est plus proposée : trop-perçu impossible
            await encaisser(compta, { eleve: "eleve-ismael", frais: /scolarité 6ème/i, montant: 200000, mode: /espèces|cash/i, observation: "Tentative de trop-perçu" });
            await pause(compta, 3000);
            const messages = await page.locator('[role="alert"], [data-sonner-toast]').allInnerTexts().catch(() => []);
            constat(compta, "Message après le trop-perçu", messages.join(" | ") || "aucun message");
            await expect(page.getByText(SUCCES), "un paiement supérieur au reste dû ne doit pas être encaissé").toHaveCount(0);
        }, { refusAttendu: true });
        await step(compta, "Montant nul : refus", async () => {
            await encaisser(compta, { eleve: "eleve-junior", frais: /scolarité 6ème/i, montant: 0, mode: /espèces|cash/i, observation: "Montant nul" });
            await pause(compta, 2000);
            await expect(page).toHaveURL(/payments\/new/);
        }, { refusAttendu: true });
        await step(compta, "Tableau de bord finance après encaissements", async () => {
            await goto(compta, "/dashboard/finance");
            const attendu = totalEncaisse.toLocaleString("fr-FR").replace(/\s/g, "[\\s\u202f\u00a0]?");
            constat(compta, "Total des encaissements acceptés pendant la recette", `${totalEncaisse} FCFA`);
            await expect(page.getByText(new RegExp(attendu)).first(), `le total encaissé (${totalEncaisse} FCFA) doit apparaître`).toBeVisible();
            await scrollThrough(compta);
        });
    } finally {
        await compta.close();
    }
});

test("03 · le parent consulte sa situation et paie en ligne", async ({ browser }) => {
    const parent = await acteur(browser, "03-parent-paiement-en-ligne", "parent-agbossou", "Fabrice Agbossou (parent de Kate)");
    const page = parent.page;
    try {
        await step(parent, "Paiements : reste dû (frais obligatoires seulement)", async () => {
            await explorePage(parent, "/dashboard/finance");
            const reste = 150000 - Number(etat.maybe("paye:kate-scolarite") ?? 0);
            const bloc = await page.locator("main").innerText();
            constat(parent, "Reste à régler affiché / attendu (frais obligatoires seuls)", `${bloc.match(/reste à régler\s*([\d\s\u202f\u00a0]+FCFA)/i)?.[1]?.trim() ?? "?"} / ${reste} FCFA`);
            await expect(page.getByText(new RegExp(reste.toLocaleString("fr-FR").replace(/\s/g, "[\\s\u202f\u00a0]?"))).first(), "seuls les frais obligatoires doivent être comptés comme dus (cantine et tenue sont facultatives)").toBeVisible();
        });
        await step(parent, "Reçus des paiements déjà faits", async () => {
            const recu = page.getByRole("button", { name: /reçu/i }).or(page.getByRole("link", { name: /reçu/i })).first();
            await expect(recu, "le parent doit retrouver ses reçus").toBeVisible({ timeout: 10_000 });
        });
        await step(parent, "Paiement en ligne (Mobile Money / FedaPay)", async () => {
            const payer = page.getByRole("button", { name: /payer|régler/i }).first();
            await expect(payer, "un bouton de paiement en ligne doit être proposé").toBeVisible({ timeout: 10_000 });
            await payer.click();
            await pause(parent, 2500);
            await scrollThrough(parent);
            const texte = await page.locator("body").innerText();
            constat(parent, "Paiement en ligne : écran obtenu", texte.match(/(momo|mobile money|fedapay|non configuré|indisponible|numéro)[^\n]{0,120}/i)?.[0] ?? "(voir capture)");
        });
    } finally {
        await parent.close();
    }
});

test("04 · impayés, relances, rapports et exports", async ({ browser }) => {
    const compta = await acteur(browser, "04-impayes-relances-exports", "comptable-cocotiers", "Arnaud Tchibozo (comptable)");
    const page = compta.page;
    try {
        await step(compta, "Dettes & impayés : échéance passée (examen blanc BEPC)", async () => {
            await explorePage(compta, "/dashboard/risks/debts");
            await expect(page.getByText(eleve("eleve-fiacre").nom).first(), "Fiacre (examen blanc BEPC échu au 20/09) doit figurer dans les impayés").toBeVisible();
        });
        await step(compta, "Finance : impayés à relancer", async () => {
            await goto(compta, "/dashboard/finance");
            await scrollThrough(compta);
            const relancer = page.getByRole("button", { name: /relancer/i }).first();
            await expect(relancer, "une action de relance doit être proposée").toBeVisible({ timeout: 10_000 });
            await relancer.click();
            await pause(compta, 2500);
        });
        await step(compta, "Rapports financiers : export", async () => {
            await goto(compta, "/dashboard/finance/reports");
            constat(compta, "Rapport exporté", await expectDownload(compta, page.getByRole("button", { name: /exporter le rapport/i })));
        });
        await step(compta, "Export financier (Excel)", async () => {
            await goto(compta, "/dashboard/finance/export");
            await page.getByRole("checkbox", { name: /bourses et réductions/i }).check();
            constat(compta, "Export", await expectDownload(compta, page.getByRole("button", { name: /générer et télécharger/i })));
        });
        await step(compta, "Export comptable standard", async () => {
            await expectEffect(compta, page.getByRole("button", { name: /lancer l'export standard/i }), "« Lancer l'export standard »");
        });
        await step(compta, "Liste de relance (PDF)", async () => {
            await goto(compta, "/dashboard/finance/export");
            await expectEffect(compta, page.getByRole("button", { name: /exporter les relances/i }), "« Exporter les relances (PDF) »");
        });
    } finally {
        await compta.close();
    }
});

test("05 · rapprochement bancaire, comptabilité OHADA, portefeuille", async ({ browser }) => {
    const compta = await acteur(browser, "05-rapprochement-et-comptabilite", "comptable-cocotiers", "Arnaud Tchibozo (comptable)");
    const page = compta.page;
    const releve = path.join(OUT, ".tmp-releve-ecobank-septembre.csv");
    fs.writeFileSync(releve, "date;libelle;montant;reference\n2026-09-25;VIR MTN MOMO AGBOSSOU;50000;MTN-7784512369\n2026-09-25;REMISE CHEQUE GNANHOUI;150000;CHQ-0045871\n");
    try {
        await step(compta, "Rapprochement : import d'un relevé bancaire CSV", async () => {
            await goto(compta, "/dashboard/finance/reconciliation");
            const champ = page.locator('main input[type="file"]');
            if (await champ.count()) await champ.first().setInputFiles(releve);
            else {
                const chooser = page.waitForEvent("filechooser", { timeout: 8000 });
                await page.getByRole("button", { name: /importer csv/i }).click();
                await (await chooser).setFiles(releve);
            }
            await pause(compta, 3000);
            await scrollThrough(compta);
        });
        await step(compta, "Comptabilité OHADA : exercice", async () => {
            await explorePage(compta, "/dashboard/accounting");
            await expect(page.getByText(/aucun exercice comptable ouvert/i), "un exercice doit être ouvert ou ouvrable").toHaveCount(0);
        });
        await step(compta, "Écriture : achat de craies 15 000 FCFA (60x / 57x)", async () => {
            await goto(compta, "/dashboard/accounting/entries/new");
            await page.getByLabel(/libellé de l'écriture/i).fill("Achat de craies et marqueurs — librairie Notre-Dame");
            await choose(compta, page, /^exercice/i, /./);
            await choose(compta, page, /compte au débit/i, /60/);
            await page.getByRole("spinbutton", { name: /montant en fcfa/i }).nth(0).fill("15000");
            await choose(compta, page, /compte au crédit/i, /57/);
            await page.getByRole("spinbutton", { name: /montant en fcfa/i }).nth(1).fill("15000");
            await page.getByRole("button", { name: /comptabiliser l'écriture/i }).click();
            await page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 20_000 });
        });
        await step(compta, "Portefeuille Mobile Money & banques", async () => explorePage(compta, "/dashboard/wallet"));
    } finally {
        await compta.close();
    }
});

test("06 · cagnotte de classe : création, diffusion, contribution d'une famille", async ({ browser }) => {
    const dir = await acteur(browser, "06-cagnotte", "admin-cocotiers", "Direction Les Cocotiers");
    try {
        await step(dir, "Cagnotte « Sortie pédagogique à Ouidah » (6ème A, 150 000 FCFA)", async () => {
            await goto(dir, "/dashboard/cagnotte/new");
            await dir.page.getByLabel(/titre de la cagnotte/i).fill("Sortie pédagogique à Ouidah");
            await dir.page.getByLabel(/description/i).fill("Visite du musée d'histoire et de la Porte du Non-Retour, car et déjeuner compris.");
            await choose(dir, dir.page, /classe concernée/i, "6ème A");
            await dir.page.getByLabel(/date limite/i).fill("2026-10-20");
            await dir.page.getByRole("spinbutton", { name: /objectif/i }).fill("150000");
            await dir.page.getByRole("spinbutton", { name: /familles attendues/i }).fill("4");
            await dir.page.getByRole("button", { name: /créer la cagnotte/i }).click();
            await dir.page.waitForURL(/cagnotte\/(?!new)[^/]+$/, { timeout: 20_000 });
            etat.set("url:cagnotte-ouidah", new URL(dir.page.url()).pathname);
            await scrollThrough(dir);
        }, { critical: true });
        await step(dir, "Message groupé aux familles de la classe", async () => {
            const diffuser = dir.page.getByRole("button", { name: /message|diffuser|informer/i }).first();
            await expect(diffuser).toBeVisible();
            await expectEffect(dir, diffuser, "la diffusion aux familles");
        });
    } finally {
        await dir.close();
    }
    const parent = await acteur(browser, "06-cagnotte", "parent-gnanhoui", "Rachida Gnanhoui (parent d'Ismaël)");
    try {
        await step(parent, "Cagnotte visible par la famille", async () => {
            await explorePage(parent, "/dashboard/cagnotte");
            await expect(parent.page.getByText(/ouidah/i).first()).toBeVisible();
        });
        await step(parent, "Contribution de 37 500 FCFA", async () => {
            await goto(parent, etat.get("url:cagnotte-ouidah"));
            const contribuer = parent.page.getByRole("button", { name: /contribuer|participer|payer/i }).first();
            await expect(contribuer, "la famille doit pouvoir contribuer").toBeVisible({ timeout: 10_000 });
            await contribuer.click();
            await pause(parent, 1500);
            const montant = parent.page.getByRole("spinbutton").first();
            if (await montant.isVisible().catch(() => false)) await montant.fill("37500");
            await pause(parent, 1500);
            await scrollThrough(parent);
        });
    } finally {
        await parent.close();
    }
});

test("07 · finance consolidée du réseau et de la plateforme", async ({ browser }) => {
    const chef = await acteur(browser, "07-finance-consolidee", "admin-cocotiers", "Direction Les Cocotiers (chef d'organisation)");
    try {
        await step(chef, "Pilotage de l'organisation : deux sites", async () => {
            await explorePage(chef, "/dashboard/organization");
            await expect(chef.page.getByText(/annexe primaire/i).first(), "l'annexe doit apparaître dans le pilotage du réseau").toBeVisible();
        });
    } finally {
        await chef.close();
    }
    const root = await acteur(browser, "07-finance-consolidee", "root", "Super-admin plateforme", "super-admin");
    try {
        await step(root, "Finance de la plateforme après les premiers encaissements", async () => explorePage(root, "/dashboard/root-control/finance"));
        await step(root, "Finance consolidée (menu réseau)", async () => explorePage(root, "/dashboard/finance"));
    } finally {
        await root.close();
    }
});
