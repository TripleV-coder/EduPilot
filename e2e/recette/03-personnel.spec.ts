/**
 * Étape 03 — Personnel : comptes de direction pédagogique, comptabilité et
 * enseignants de chaque établissement (mots de passe provisoires lus à
 * l'écran), refus des doublons, rôle « personnel administratif », premières
 * connexions, puis ressources humaines (fiches, disponibilités, pointage,
 * congés demandés et validés, paie).
 */
import { expect, test, type Browser } from "@playwright/test";
import {
    etat,
    explorePage,
    firstLogin,
    goto,
    loginToDashboard,
    openActor,
    pause,
    pickOption,
    scrollThrough,
    step,
    type Actor,
} from "./kit";
import { ECOLES, mail, PERSONNEL, pwd, type Ecole, type Enseignant, type Membre } from "./donnees";

const ETAPE = "03-personnel";

async function direction(browser: Browser, ecole: Ecole, scenario: string): Promise<Actor> {
    const admin = await openActor(browser, { etape: ETAPE, scenario, name: ecole.admin.key, label: `Direction ${ecole.name}` });
    await step(admin, "Connexion de la direction", async () => loginToDashboard(admin, etat.account(ecole.admin.key)), { critical: true });
    return admin;
}

async function createUser(admin: Actor, m: Membre, role: RegExp, roleCode: string) {
    const page = admin.page;
    await goto(admin, "/dashboard/users/new");
    await page.getByLabel("Prénom de l'utilisateur", { exact: true }).fill(m.firstName);
    await page.getByLabel("Nom de l'utilisateur", { exact: true }).fill(m.lastName);
    await page.getByLabel("Adresse e-mail de l'utilisateur", { exact: true }).fill(mail(m.key));
    await page.getByLabel("Téléphone de l'utilisateur", { exact: true }).fill(m.phone);
    await pickOption(admin, page.getByLabel("Sélectionner le rôle utilisateur"), role);
    await pause(admin, 800);
    await page.getByRole("button", { name: /créer l'utilisateur/i }).click();
    await expect(page.getByText(/utilisateur créé avec succès/i).first()).toBeVisible();
    await pause(admin, 1800);
    const provisional = (await page.locator("code.select-all").innerText()).trim();
    etat.setAccount(m.key, { email: mail(m.key), password: provisional, role: roleCode, name: `${m.firstName} ${m.lastName}` });
}

async function createTeacher(admin: Actor, t: Enseignant) {
    const page = admin.page;
    await goto(admin, "/dashboard/teachers/new");
    await page.getByLabel("Prénom de l'enseignant").fill(t.firstName);
    await page.getByLabel("Nom de famille de l'enseignant").fill(t.lastName);
    await page.getByLabel("Adresse e-mail de l'enseignant").fill(mail(t.key));
    await page.getByLabel("Téléphone de l'enseignant").fill(t.phone);
    await page.getByLabel("Matricule").fill(t.matricule);
    await page.getByLabel("Spécialité Principale").fill(t.specialite);
    await page.getByLabel("Date d'embauche").fill(t.embauche);
    await pause(admin, 800);
    await page.getByRole("button", { name: /^enregistrer$/i }).click();
    await expect(page.getByText(/enseignant créé avec succès/i).first()).toBeVisible();
    await pause(admin, 1800);
    const provisional = (await page.locator("code.select-all").innerText()).trim();
    etat.setAccount(t.key, { email: mail(t.key), password: provisional, role: "TEACHER", name: `${t.firstName} ${t.lastName}` });
}

for (const [index, ecole] of ECOLES.entries()) {
    const equipe = PERSONNEL[ecole.key];
    test(`${String(index + 1).padStart(2, "0")} · équipe de « ${ecole.name} »`, async ({ browser }) => {
        const admin = await direction(browser, ecole, `${String(index + 1).padStart(2, "0")}-equipe-${ecole.key}`);
        const page = admin.page;
        try {
            if (equipe.directeur) {
                const d = equipe.directeur;
                await step(admin, `Compte de la directrice des études « ${d.firstName} ${d.lastName} » (rôle Directeur)`, async () =>
                    createUser(admin, d, /^directeur$/i, "DIRECTOR"),
                );
            }
            if (equipe.comptable) {
                const c = equipe.comptable;
                await step(admin, `Compte du comptable « ${c.firstName} ${c.lastName} » (rôle Comptable)`, async () =>
                    createUser(admin, c, /^comptable$/i, "ACCOUNTANT"),
                );
            }
            if (index === 0) {
                await step(admin, "Rôle « Personnel administratif » (secrétariat) proposé à la création d'un compte", async () => {
                    await goto(admin, "/dashboard/users/new");
                    await page.getByLabel("Sélectionner le rôle utilisateur").click();
                    await pause(admin, 1500);
                    const roles = await page.getByRole("option").allInnerTexts();
                    await page.keyboard.press("Escape");
                    expect(roles.join(" · "), "rôles proposés à la création d'un compte").toMatch(/personnel|secrétari/i);
                });
            }
            for (const t of equipe.enseignants) {
                await step(admin, `Enseignant « ${t.firstName} ${t.lastName} » (${t.specialite})`, async () => createTeacher(admin, t));
            }
            await step(
                admin,
                "Même adresse e-mail pour un deuxième enseignant : refus",
                async () => {
                    const t = equipe.enseignants[0];
                    await goto(admin, "/dashboard/teachers/new");
                    await page.getByLabel("Prénom de l'enseignant").fill("Doublon");
                    await page.getByLabel("Nom de famille de l'enseignant").fill("Test");
                    await page.getByLabel("Adresse e-mail de l'enseignant").fill(mail(t.key));
                    await page.getByRole("button", { name: /^enregistrer$/i }).click();
                    await pause(admin, 2500);
                    await expect(page.getByText(/enseignant créé avec succès/i)).toHaveCount(0);
                },
                { refusAttendu: true },
            );
            await step(admin, "Annuaire des enseignants : liste, tableau, recherche, filtre", async () => {
                await goto(admin, "/dashboard/teachers");
                await scrollThrough(admin);
                await page.getByRole("button", { name: /^tableau$/i }).click();
                await pause(admin, 1500);
                await page.getByRole("button", { name: /^liste$/i }).click();
                await page.getByRole("searchbox", { name: /rechercher/i }).fill(equipe.enseignants[0].lastName);
                await pause(admin, 1500);
                await page.getByRole("searchbox", { name: /rechercher/i }).fill("");
                await page.getByRole("combobox", { name: /statut/i }).selectOption({ label: "Actif" });
                await pause(admin, 1200);
            });
            await step(admin, "Export CSV des enseignants", async () => {
                const download = page.waitForEvent("download", { timeout: 15_000 });
                await page.getByRole("button", { name: /exporter csv/i }).click();
                const file = await download;
                expect(file.suggestedFilename()).toMatch(/\.csv$/);
            });
            await step(admin, "Comptes de l'établissement : filtre par rôle", async () => {
                await goto(admin, "/dashboard/users");
                await scrollThrough(admin);
                const filter = page.getByRole("combobox", { name: /^rôle$/i });
                for (const label of ["Enseignant", "Directeur", "Comptable"]) {
                    await filter.selectOption({ label });
                    await pause(admin, 1200);
                }
                await filter.selectOption({ index: 0 });
            });
        } finally {
            await admin.close();
        }
    });
}

test("06 · premières connexions de toute l'équipe (mot de passe provisoire, consentement)", async ({ browser }) => {
    const membres = ECOLES.flatMap((ecole) => {
        const equipe = PERSONNEL[ecole.key];
        return [equipe.directeur, equipe.comptable, ...equipe.enseignants].filter(Boolean) as Membre[];
    });
    for (const m of membres) {
        const actor = await openActor(browser, { etape: ETAPE, scenario: "06-premieres-connexions-equipe", name: m.key, label: `${m.firstName} ${m.lastName}` });
        try {
            const account = etat.account(m.key);
            await step(actor, "Mot de passe provisoire : changement imposé, consentement", async () => {
                await firstLogin(actor, account.email, account.password, pwd(m.key));
                etat.setAccount(m.key, { ...account, password: pwd(m.key) });
            });
            await step(actor, "Premier accueil", async () => {
                await goto(actor, "/dashboard");
                await pause(actor, 1500);
                await scrollThrough(actor);
            });
        } finally {
            await actor.close();
        }
    }
});

test("07 · ressources humaines : fiches, disponibilités, pointage, congés, paie", async ({ browser }) => {
    const ecole = ECOLES[0];
    const equipe = PERSONNEL[ecole.key];
    const admin = await direction(browser, ecole, "07-ressources-humaines");
    const page = admin.page;
    try {
        await step(admin, "Ressources humaines · enseignants", async () => explorePage(admin, "/dashboard/teachers/hr"));
        await step(admin, "Fiche d'un enseignant (onglets)", async () => {
            await goto(admin, "/dashboard/teachers");
            await page.getByRole("link", { name: new RegExp(equipe.enseignants[0].lastName, "i") }).first().click();
            await page.waitForURL(/\/dashboard\/teachers\/[^/]+$/);
            etat.set("url:prof-maths", new URL(page.url()).pathname);
            await explorePage(admin, new URL(page.url()).pathname);
        });
        await step(admin, "Disponibilités de l'enseignant", async () => {
            await explorePage(admin, `${etat.get("url:prof-maths")}/availability`);
            // Disponible le matin du lundi au jeudi, et le vendredi après-midi.
            for (const jour of ["Lundi", "Mardi", "Mercredi", "Jeudi"]) {
                for (const heure of ["08:00", "10:00"]) await page.getByRole("button", { name: `${jour} ${heure} : indisponible` }).click();
            }
            await page.getByRole("button", { name: "Vendredi 15:00 : indisponible" }).click();
            await pause(admin, 1200);
            await page.getByRole("button", { name: /enregistrer la grille/i }).click();
            await pause(admin, 2000);
            await page.reload();
            await expect(page.getByRole("button", { name: "Lundi 08:00 : disponible" })).toBeVisible();
        });
        await step(admin, "Pointage du personnel : tout présent, un retard, une absence", async () => {
            await goto(admin, "/dashboard/staff/attendance");
            await page.getByRole("button", { name: /tout présent/i }).click();
            await pause(admin, 1500);
            const rows = page.locator("main li");
            if ((await rows.count()) > 2) {
                await rows.nth(1).getByRole("button", { name: /^retard$/i }).click();
                await rows.nth(2).getByRole("button", { name: /^absent$/i }).click();
            }
            await pause(admin, 1500);
            await scrollThrough(admin);
        });
        await step(admin, "Paie : salaire de base, prime et retenue pour un enseignant", async () => {
            await goto(admin, "/dashboard/staff/payroll");
            const row = page.locator("main li").filter({ hasText: equipe.enseignants[0].lastName });
            await row.getByRole("button", { name: /configurer/i }).click();
            await page.getByLabel("Salaire de base (FCFA)").fill("185000");
            const add = page.getByRole("button", { name: /^ajouter$/i });
            await add.nth(0).click();
            await pause(admin, 600);
            let inputs = page.locator("main input:visible");
            let count = await inputs.count();
            if (count >= 3) {
                await inputs.nth(count - 2).fill("Prime de rendement").catch(() => undefined);
                await inputs.nth(count - 1).fill("15000").catch(() => undefined);
            }
            await add.nth(1).click();
            await pause(admin, 600);
            inputs = page.locator("main input:visible");
            count = await inputs.count();
            if (count >= 3) {
                await inputs.nth(count - 2).fill("CNSS").catch(() => undefined);
                await inputs.nth(count - 1).fill("6475").catch(() => undefined);
            }
            await pause(admin, 1200);
            await page.getByRole("button", { name: /^enregistrer$/i }).click();
            await pause(admin, 2500);
            await scrollThrough(admin);
        });
    } finally {
        await admin.close();
    }

    const prof = await openActor(browser, { etape: ETAPE, scenario: "07-ressources-humaines", name: "prof-maths", label: "Koffi Dossou (enseignant)" });
    try {
        await step(prof, "Connexion de l'enseignant", async () => loginToDashboard(prof, etat.account("prof-maths")), { critical: true });
        await step(prof, "Demande de congé maladie (3 jours)", async () => {
            await goto(prof, "/dashboard/staff/leaves");
            await prof.page.getByRole("combobox", { name: /^type$/i }).selectOption({ label: "Maladie" });
            await prof.page.getByLabel("Du", { exact: true }).fill("2026-10-12");
            await prof.page.getByLabel("Au", { exact: true }).fill("2026-10-14");
            await prof.page.getByLabel(/motif/i).fill("Paludisme — certificat médical fourni");
            await prof.page.getByRole("button", { name: /envoyer la demande/i }).click();
            await pause(prof, 2000);
            const demande = prof.page.locator("main li").filter({ hasText: /2026-10-12/ }).filter({ hasText: /Maladie/ }).first();
            await expect(demande).toContainText(/en attente/i);
        });
        await step(prof, "Ma fiche de paie", async () => explorePage(prof, "/dashboard/staff/payroll"));
    } finally {
        await prof.close();
    }

    const admin2 = await openActor(browser, { etape: ETAPE, scenario: "07-ressources-humaines", name: `${ecole.admin.key}-validation`, label: `Direction ${ecole.name}` });
    try {
        await step(admin2, "Connexion de la direction", async () => loginToDashboard(admin2, etat.account(ecole.admin.key)), { critical: true });
        await step(admin2, "Validation de la demande de congé de l'enseignant", async () => {
            await goto(admin2, "/dashboard/staff/leaves");
            const row = admin2.page.locator("main li, main tr").filter({ hasText: /Dossou/ }).filter({ hasText: /Maladie/ }).first();
            await expect(row).toContainText(/paludisme/i);
            await row.getByRole("button", { name: /approuver|valider|accepter/i }).click();
            await pause(admin2, 2000);
            await expect(admin2.page.locator("main li, main tr").filter({ hasText: /Dossou/ }).first()).toContainText(/approuv/i);
        });
        await step(admin2, "Pointage du jour de congé : l'enseignant apparaît en congé", async () => {
            await goto(admin2, "/dashboard/staff/attendance");
            await admin2.page.getByLabel("Date").fill("2026-10-13");
            await pause(admin2, 2000);
            await scrollThrough(admin2);
        });
    } finally {
        await admin2.close();
    }
});
