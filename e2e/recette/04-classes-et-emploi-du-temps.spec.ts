/**
 * Étape 04 — Classes, matières enseignées et emploi du temps : création des
 * classes (niveau, capacité, professeur principal), affectation de chaque
 * matière à son enseignant, coefficients par classe, conflits d'horaires,
 * vues par classe / par enseignant / par jour.
 */
import { expect, test, type Browser } from "@playwright/test";
import { etat, explorePage, goto, loginToDashboard, openActor, pause, pickOption, scrollThrough, step, type Actor } from "./kit";
import { CLASSES, CONFIGS, ECOLES, EDT_6A, type Classe, type Ecole } from "./donnees";

const ETAPE = "04-classes-et-emploi-du-temps";

async function direction(browser: Browser, ecole: Ecole, scenario: string): Promise<Actor> {
    const admin = await openActor(browser, { etape: ETAPE, scenario, name: ecole.admin.key, label: `Direction ${ecole.name}` });
    await step(admin, "Connexion de la direction", async () => loginToDashboard(admin, etat.account(ecole.admin.key)), { critical: true });
    return admin;
}

const lastName = (key: string) => etat.account(key).name.split(" ").slice(-1)[0];
const escapeRx = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function createClass(admin: Actor, c: Classe) {
    const page = admin.page;
    await goto(admin, "/dashboard/classes/new");
    await page.getByLabel("Nom de la classe").fill(c.name);
    await pickOption(admin, page.getByLabel("Sélectionner le niveau d'étude"), c.niveau);
    await page.getByLabel("Capacité maximale de la classe").fill(String(c.capacite));
    await pickOption(admin, page.getByLabel("Sélectionner le professeur principal"), new RegExp(lastName(c.principal), "i"));
    await pause(admin, 800);
    await page.getByRole("button", { name: /enregistrer la classe/i }).click();
    await expect(page.getByText(/classe créée avec succès/i).first()).toBeVisible();
}

async function assignSubjects(admin: Actor, ecole: Ecole, c: Classe) {
    const page = admin.page;
    const cfg = CONFIGS[ecole.key];
    await goto(admin, "/dashboard/classes");
    await page.getByRole("link", { name: new RegExp(escapeRx(c.name)) }).first().click();
    await page.waitForURL(/\/dashboard\/classes\/[^/]+$/);
    etat.set(`url:classe:${ecole.key}:${c.name}`, new URL(page.url()).pathname);
    for (const [code, teacher] of Object.entries(c.matieres)) {
        const matiere = cfg.matieres.find((m) => m.code === code);
        if (!matiere) continue;
        await admin.caption(`${c.name} : « ${matiere.name} » confiée à ${etat.account(teacher).name}`);
        await page.getByRole("button", { name: /assigner une matière/i }).click();
        const subject = page.locator("select#subjectId");
        const value = await subject.locator("option", { hasText: `(${code})` }).first().getAttribute("value");
        await subject.selectOption(value ?? "");
        const teacherSelect = page.locator("select#teacherId");
        const tValue = await teacherSelect.locator("option", { hasText: lastName(teacher) }).first().getAttribute("value");
        await teacherSelect.selectOption(tValue ?? "");
        await pause(admin, 600);
        await page.getByRole("button", { name: /^assigner$/i }).click();
        await expect(page.getByText(/matière assignée avec succès/i).first()).toBeVisible();
        await pause(admin, 900);
    }
    await scrollThrough(admin);
}

async function selectByLabel(admin: Actor, name: RegExp, label: string) {
    const select = admin.page.getByRole("combobox", { name }).first();
    const tag = await select.evaluate((e) => e.tagName);
    if (tag === "SELECT") {
        const options = await select.locator("option").allInnerTexts();
        await select.selectOption({ label: options.find((o) => o.includes(label)) ?? options[0] });
    } else await pickOption(admin, select, new RegExp(escapeRx(label)));
}

for (const [index, ecole] of ECOLES.entries()) {
    test(`${String(index + 1).padStart(2, "0")} · classes et matières de « ${ecole.name} »`, async ({ browser }) => {
        const admin = await direction(browser, ecole, `${String(index + 1).padStart(2, "0")}-classes-${ecole.key}`);
        const page = admin.page;
        try {
            for (const c of CLASSES[ecole.key]) {
                await step(admin, `Classe « ${c.name} » (${c.niveau}, ${c.capacite} places, professeur principal ${etat.account(c.principal).name})`, async () =>
                    createClass(admin, c),
                );
            }
            if (index === 0) {
                await step(
                    admin,
                    "Classe en double (même nom) : refus",
                    async () => {
                        await goto(admin, "/dashboard/classes/new");
                        await page.getByLabel("Nom de la classe").fill(CLASSES[ecole.key][0].name);
                        await pickOption(admin, page.getByLabel("Sélectionner le niveau d'étude"), CLASSES[ecole.key][0].niveau);
                        await page.getByRole("button", { name: /enregistrer la classe/i }).click();
                        await pause(admin, 2500);
                        await expect(page.getByText(/classe créée avec succès/i)).toHaveCount(0);
                    },
                    { refusAttendu: true },
                );
                await step(admin, "Création de classe : aucun niveau du primaire pour un établissement sans primaire", async () => {
                    await goto(admin, "/dashboard/classes/new");
                    await page.getByLabel("Sélectionner le niveau d'étude").click();
                    await pause(admin, 1200);
                    const niveaux = await page.getByRole("option").allInnerTexts();
                    await page.keyboard.press("Escape");
                    expect(niveaux.join(" "), "niveaux proposés").not.toMatch(/CM2|Cours Moyen|Initiation/);
                });
            }
            for (const c of CLASSES[ecole.key]) {
                await step(admin, `${c.name} : matières et enseignants`, async () => assignSubjects(admin, ecole, c));
            }
            await step(admin, "Liste des classes : grille, tableau, filtres par cycle, recherche", async () => {
                await goto(admin, "/dashboard/classes");
                await scrollThrough(admin);
                await page.getByRole("button", { name: /^tableau$/i }).click();
                await pause(admin, 1500);
                await page.getByRole("button", { name: /^grille$/i }).click();
                for (const cycle of [/^collège/i, /^lycée/i, /^primaire/i, /^tous les cycles/i]) {
                    await page.getByRole("button", { name: cycle }).click();
                    await pause(admin, 1000);
                }
                await page.getByRole("searchbox", { name: /rechercher/i }).fill(CLASSES[ecole.key][0].name);
                await pause(admin, 1200);
            });
            await step(admin, "Matières par classe : coefficients", async () => explorePage(admin, "/dashboard/settings/class-subjects"));
            await step(admin, "Programmes scolaires (curriculum) d'une classe", async () => {
                await goto(admin, "/dashboard/settings/curriculum");
                await selectByLabel(admin, /classe/i, CLASSES[ecole.key][0].name);
                await pause(admin, 1500);
                await scrollThrough(admin);
            });
        } finally {
            await admin.close();
        }
    });
}

test("06 · coefficient propre à une classe (Mathématiques coef. 4 en Tle D)", async ({ browser }) => {
    const ecole = ECOLES[0];
    const admin = await direction(browser, ecole, "06-coefficients-par-classe");
    const page = admin.page;
    try {
        await step(admin, "Matières par classe : Tle D", async () => {
            await goto(admin, "/dashboard/settings/class-subjects");
            await selectByLabel(admin, /.*/, "Tle D");
            await pause(admin, 1500);
            await scrollThrough(admin);
        });
        await step(admin, "Coefficient de Mathématiques porté à 4", async () => {
            const row = page.locator("tr, li").filter({ hasText: /Mathématiques/ }).first();
            await row.getByRole("spinbutton").first().fill("4");
            await page.getByRole("button", { name: /enregistrer|sauvegarder/i }).first().click();
            await pause(admin, 2000);
            await page.reload();
            await page.waitForLoadState("networkidle").catch(() => undefined);
            await scrollThrough(admin);
        });
    } finally {
        await admin.close();
    }
});

test("07 · emploi du temps de la 6ème A, conflits, vues par classe, enseignant et jour", async ({ browser }) => {
    const ecole = ECOLES[0];
    const admin = await direction(browser, ecole, "07-emploi-du-temps");
    const page = admin.page;
    const classe = CLASSES[ecole.key][0];
    const matiereName = (code: string) => CONFIGS[ecole.key].matieres.find((m) => m.code === code)!.name;
    try {
        for (const slot of EDT_6A) {
            const teacher = etat.account(classe.matieres[slot.matiere]).name;
            await step(admin, `${classe.name} · ${slot.jour} ${slot.debut}-${slot.fin} · ${matiereName(slot.matiere)} (${teacher}) · ${slot.salle}`, async () => {
                await goto(admin, "/dashboard/schedule/new");
                await page.getByLabel("Sélectionner une classe").selectOption({ label: classe.name });
                await pause(admin, 800);
                const subject = page.getByLabel("Sélectionner la matière et l'enseignant");
                const options = await subject.locator("option").allInnerTexts();
                await subject.selectOption({ label: options.find((o) => o.includes(matiereName(slot.matiere))) ?? "" });
                await page.getByLabel("Sélectionner le jour de la semaine").selectOption({ label: slot.jour });
                await page.getByLabel("Heure de début").fill(slot.debut);
                await page.getByLabel("Heure de fin").fill(slot.fin);
                await page.getByLabel("Salle de cours").fill(slot.salle);
                await pause(admin, 600);
                await page.getByRole("button", { name: /planifier le cours/i }).click();
                await page.waitForURL((url) => url.pathname === "/dashboard/schedule", { timeout: 20_000 });
            });
        }
        await step(
            admin,
            "Même enseignant au même moment dans une autre classe (6ème B) : conflit refusé",
            async () => {
                await goto(admin, "/dashboard/schedule/new");
                await page.getByLabel("Sélectionner une classe").selectOption({ label: "6ème B" });
                await pause(admin, 800);
                const subject = page.getByLabel("Sélectionner la matière et l'enseignant");
                const options = await subject.locator("option").allInnerTexts();
                await subject.selectOption({ label: options.find((o) => o.includes("Mathématiques")) ?? "" });
                await page.getByLabel("Sélectionner le jour de la semaine").selectOption({ label: "Lundi" });
                await page.getByLabel("Heure de début").fill("09:00");
                await page.getByLabel("Heure de fin").fill("11:00");
                await page.getByRole("button", { name: /planifier le cours/i }).click();
                await pause(admin, 3000);
                await expect(page).toHaveURL(/schedule\/new/);
            },
            { refusAttendu: true },
        );
        await step(
            admin,
            "Heure de fin avant l'heure de début : refus",
            async () => {
                await goto(admin, "/dashboard/schedule/new");
                await page.getByLabel("Sélectionner une classe").selectOption({ label: "6ème B" });
                await pause(admin, 800);
                const subject = page.getByLabel("Sélectionner la matière et l'enseignant");
                const options = await subject.locator("option").allInnerTexts();
                await subject.selectOption({ label: options.find((o) => o.includes("Français")) ?? "" });
                await page.getByLabel("Heure de début").fill("14:00");
                await page.getByLabel("Heure de fin").fill("12:00");
                await page.getByRole("button", { name: /planifier le cours/i }).click();
                await pause(admin, 3000);
                await expect(page).toHaveURL(/schedule\/new/);
            },
            { refusAttendu: true },
        );
        await step(admin, "Emploi du temps : semaine de la 6ème A", async () => {
            await goto(admin, "/dashboard/schedule");
            await selectByLabel(admin, /filtrer par classe/i, "6ème A");
            await pause(admin, 2000);
            await scrollThrough(admin);
        });
        await step(admin, "Emploi du temps : vue « Jour »", async () => {
            await page.getByRole("button", { name: /^jour$/i }).click();
            await pause(admin, 2000);
            await page.getByRole("button", { name: /^semaine$/i }).click();
        });
        await step(admin, "Emploi du temps : par enseignant (Koffi Dossou)", async () => {
            await page.getByRole("button", { name: /par enseignant/i }).click();
            await selectByLabel(admin, /filtrer par enseignant/i, "Dossou");
            await pause(admin, 2000);
            await scrollThrough(admin);
        });
        await step(admin, "Emploi du temps : toutes les classes", async () => {
            await page.getByRole("button", { name: /par classe/i }).click();
            await page.getByRole("combobox", { name: /filtrer par classe/i }).selectOption({ index: 0 });
            await pause(admin, 2000);
        });
    } finally {
        await admin.close();
    }
});
