/**
 * Étape 05 — Frais et tarifs, avant les inscriptions (les frais obligatoires
 * sont facturés à l'inscription) : lignes tarifaires générales et par niveau,
 * échéances (dont une déjà passée), frais facultatifs, montant invalide,
 * bourses, avis de paiement, tableau de bord finance vide.
 */
import { expect, test, type Browser } from "@playwright/test";
import { etat, explorePage, goto, loginToDashboard, openActor, pause, scrollThrough, step, type Actor } from "./kit";
import { ANNEE, ECOLES, FRAIS, type Ecole, type Frais } from "./donnees";

const ETAPE = "05-frais-et-tarifs";

async function direction(browser: Browser, ecole: Ecole, scenario: string): Promise<Actor> {
    const admin = await openActor(browser, { etape: ETAPE, scenario, name: ecole.admin.key, label: `Direction ${ecole.name}` });
    await step(admin, "Connexion de la direction", async () => loginToDashboard(admin, etat.account(ecole.admin.key)), { critical: true });
    return admin;
}

async function createFee(admin: Actor, f: Frais) {
    const page = admin.page;
    await goto(admin, "/dashboard/finance/fees");
    await page.getByRole("button", { name: /nouveau frais/i }).click();
    await page.getByLabel("Intitulé du frais").fill(f.intitule);
    await page.getByLabel("Montant du frais").fill(String(f.montant));
    await page.getByLabel("Année académique").selectOption({ label: ANNEE });
    if (f.niveau) await page.getByLabel("Niveau d'étude cible").selectOption({ label: f.niveau });
    if (f.echeance) await page.getByLabel(/date d'échéance/i).fill(f.echeance);
    if (f.notes) await page.getByLabel("Notes internes").fill(f.notes);
    const mandatory = page.getByRole("switch", { name: /frais obligatoire/i });
    if ((await mandatory.getAttribute("aria-checked")) === "true" && !f.obligatoire) await mandatory.click();
    await pause(admin, 800);
    await page.getByRole("button", { name: /^enregistrer$/i }).click();
    await pause(admin, 1500);
    await expect(page.getByText(f.intitule).first()).toBeVisible();
}

async function chooseInCombobox(admin: Actor, name: RegExp, label: string) {
    const combo = admin.page.getByRole("combobox", { name }).first();
    const tag = await combo.evaluate((e) => e.tagName);
    if (tag === "SELECT") await combo.selectOption({ label });
    else {
        await combo.click();
        await admin.page.getByRole("option", { name: label }).first().click();
    }
}

for (const [index, ecole] of ECOLES.entries()) {
    test(`${String(index + 1).padStart(2, "0")} · grille tarifaire de « ${ecole.name} »`, async ({ browser }) => {
        const admin = await direction(browser, ecole, `${String(index + 1).padStart(2, "0")}-frais-${ecole.key}`);
        const page = admin.page;
        try {
            await step(admin, "Tableau de bord finance avant toute facturation", async () => explorePage(admin, "/dashboard/finance"));
            for (const f of FRAIS[ecole.key]) {
                const detail = [
                    `${f.montant.toLocaleString("fr-FR")} FCFA`,
                    f.niveau ?? "tous niveaux",
                    f.echeance ? `échéance ${f.echeance}` : "sans échéance",
                    f.obligatoire ? "obligatoire" : "facultatif",
                ].join(", ");
                await step(admin, `Frais « ${f.intitule} » (${detail})`, async () => createFee(admin, f));
            }
            if (index === 0) {
                await step(
                    admin,
                    "Montant négatif : refus",
                    async () => {
                        await goto(admin, "/dashboard/finance/fees");
                        await page.getByRole("button", { name: /nouveau frais/i }).click();
                        await page.getByLabel("Intitulé du frais").fill("Frais invalide");
                        await page.getByLabel("Montant du frais").fill("-5000");
                        await page.getByRole("button", { name: /^enregistrer$/i }).click();
                        await pause(admin, 2500);
                        await goto(admin, "/dashboard/finance/fees");
                        await expect(page.getByText("Frais invalide")).toHaveCount(0);
                    },
                    { refusAttendu: true },
                );
                await step(admin, "Modification d'un frais (tenue scolaire 12 000 → 13 500 FCFA)", async () => {
                    await goto(admin, "/dashboard/finance/fees");
                    const row = page.locator("tr, li, [data-slot=card]").filter({ hasText: "Tenue scolaire" }).first();
                    await row.getByRole("button", { name: /modifier|éditer/i }).first().click();
                    await page.getByLabel("Montant du frais").fill("13500");
                    await page.getByRole("button", { name: /^enregistrer$/i }).click();
                    await pause(admin, 2000);
                    await expect(page.getByText(/13\s?500/).first()).toBeVisible();
                });
                await step(admin, "Bourses : création d'une bourse", async () => {
                    await goto(admin, "/dashboard/finance/scholarships");
                    await scrollThrough(admin);
                    await page.getByRole("button", { name: /nouvelle bourse/i }).click();
                    await pause(admin, 1500);
                    expect(await page.getByRole("dialog").count(), "« Nouvelle bourse » doit ouvrir un formulaire").toBeGreaterThan(0);
                });
                await step(admin, "Bourses : rapport MEMP", async () => {
                    await goto(admin, "/dashboard/finance/scholarships");
                    const download = page.waitForEvent("download", { timeout: 8000 }).catch(() => null);
                    await page.getByRole("button", { name: /rapport memp/i }).click();
                    expect(await download, "« Rapport MEMP » doit produire un fichier").not.toBeNull();
                });
                await step(admin, "Avis de paiement : choix du niveau et du frais (aucun élève encore)", async () => {
                    await goto(admin, "/dashboard/finance/bulk-invoice");
                    await chooseInCombobox(admin, /^niveau$/i, "Sixième");
                    await pause(admin, 1500);
                    await scrollThrough(admin);
                });
            }
            await step(admin, "Grille tarifaire complète", async () => {
                await goto(admin, "/dashboard/finance/fees");
                await scrollThrough(admin);
            });
        } finally {
            await admin.close();
        }
    });
}
