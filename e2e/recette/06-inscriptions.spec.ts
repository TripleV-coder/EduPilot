/**
 * Étape 06 — Inscriptions et familles : assistant d'inscription en 4 étapes
 * (identité, famille, cursus, documents), brouillon, erreurs de saisie,
 * matricule en double, fiches élèves, comptes parents, codes de liaison
 * (y compris un parent dont les deux enfants sont sur deux sites du réseau),
 * liste des élèves (filtres, export), premières connexions élèves et parents,
 * rattachement des enfants par le parent.
 */
import { expect, test, type Browser } from "@playwright/test";
import {
    acceptConsent,
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
import { ECOLES, ELEVES, mail, pwd, type Ecole, type Eleve } from "./donnees";

const ETAPE = "06-inscriptions-et-familles";

async function direction(browser: Browser, ecole: Ecole, scenario: string, name = ecole.admin.key): Promise<Actor> {
    const admin = await openActor(browser, { etape: ETAPE, scenario, name, label: `Direction ${ecole.name}` });
    await step(admin, "Connexion de la direction", async () => loginToDashboard(admin, etat.account(ecole.admin.key)), { critical: true });
    return admin;
}

async function fillIdentity(admin: Actor, e: Eleve) {
    const page = admin.page;
    await page.getByLabel("Nom *", { exact: true }).fill(e.nom);
    await page.getByLabel("Prénom *", { exact: true }).fill(e.prenom);
    await page.getByLabel("Matricule *", { exact: true }).fill(e.matricule);
    await page.getByLabel("Date de naissance").fill(e.naissance);
    await page.getByLabel("Genre").selectOption({ label: e.genre });
    await page.getByLabel("Lieu de naissance").fill(e.lieu);
    await page.getByLabel("Téléphone *", { exact: true }).fill(e.phone);
    await page.getByLabel("Email *", { exact: true }).fill(mail(e.key));
    await page.getByLabel("Adresse").fill(e.adresse);
}

async function inscrire(admin: Actor, e: Eleve) {
    const page = admin.page;
    await goto(admin, "/dashboard/students/inscription");
    await fillIdentity(admin, e);
    await pause(admin, 700);
    await page.getByRole("button", { name: /^continuer$/i }).click();
    await page.getByRole("textbox", { name: "Nom du responsable", exact: true }).fill(e.responsable.lastName.toUpperCase());
    await page.getByRole("textbox", { name: "Prénom du responsable", exact: true }).fill(e.responsable.firstName);
    await page.getByLabel("Lien de parenté").selectOption({ label: e.responsable.lien });
    await page.getByRole("textbox", { name: "Téléphone responsable", exact: true }).fill(e.responsable.phone);
    await pause(admin, 700);
    await page.getByRole("button", { name: /^continuer$/i }).click();
    const classe = page.getByLabel("Classe demandée *");
    const options = await classe.locator("option").allInnerTexts();
    await classe.selectOption({ label: options.find((o) => o.includes(e.classe)) ?? e.classe });
    await page.getByLabel("Date d'admission").fill("2026-09-14");
    await pause(admin, 900);
    await page.getByRole("button", { name: /^continuer$/i }).click();
    await pause(admin, 1500);
    await page.getByRole("button", { name: /finaliser l'inscription/i }).click();
    await expect(page.getByText(/inscription enregistrée/i).first()).toBeVisible({ timeout: 30_000 });
    await pause(admin, 2000);
    const provisional = (await page.locator("code").first().innerText()).trim();
    etat.setAccount(e.key, { email: mail(e.key), password: provisional, role: "STUDENT", name: `${e.prenom} ${e.nom}` });
    await page.getByRole("button", { name: /ouvrir la fiche de l'élève/i }).click();
    await page.waitForURL((url) => /\/dashboard\/students\/(?!inscription$)[^/]+$/.test(url.pathname));
    etat.set(`url:${e.key}`, new URL(page.url()).pathname);
    await pause(admin, 1500);
}

for (const [index, ecole] of ECOLES.entries()) {
    const eleves = ELEVES.filter((e) => e.ecole === ecole.key);
    test(`${String(index + 1).padStart(2, "0")} · inscriptions de « ${ecole.name} »`, async ({ browser }) => {
        const admin = await direction(browser, ecole, `${String(index + 1).padStart(2, "0")}-inscriptions-${ecole.key}`);
        const page = admin.page;
        try {
            if (index === 0) {
                await step(
                    admin,
                    "Assistant d'inscription : continuer sans les champs obligatoires",
                    async () => {
                        await goto(admin, "/dashboard/students/inscription");
                        await page.getByRole("button", { name: /^continuer$/i }).click();
                        await pause(admin, 1800);
                        await expect(page.getByRole("heading", { name: /identité de l'élève/i })).toBeVisible();
                    },
                    { refusAttendu: true },
                );
                await step(admin, "Assistant d'inscription : brouillon enregistré puis repris", async () => {
                    await goto(admin, "/dashboard/students/inscription");
                    await page.getByLabel("Nom *", { exact: true }).fill("BROUILLON");
                    await page.getByLabel("Prénom *", { exact: true }).fill("Dossier");
                    await page.getByRole("button", { name: /enregistrer brouillon/i }).click();
                    await pause(admin, 2000);
                    await goto(admin, "/dashboard/students/inscription");
                    await pause(admin, 2000);
                    await expect(page.getByLabel("Nom *", { exact: true }), "le brouillon doit être repris").toHaveValue("BROUILLON");
                    await page.getByRole("button", { name: /^annuler$/i }).click();
                    await pause(admin, 1500);
                });
            }
            for (const e of eleves) {
                await step(
                    admin,
                    `Inscription de ${e.prenom} ${e.nom} en ${e.classe} (responsable : ${e.responsable.firstName} ${e.responsable.lastName}, ${e.responsable.lien.toLowerCase()})`,
                    async () => inscrire(admin, e),
                );
            }
            if (index === 0) {
                await step(
                    admin,
                    "Matricule déjà attribué : refus",
                    async () => {
                        const e = eleves[0];
                        await goto(admin, "/dashboard/students/inscription");
                        await fillIdentity(admin, { ...e, key: "doublon-matricule", prenom: "Doublon" });
                        await page.getByRole("button", { name: /^continuer$/i }).click();
                        await page.getByRole("textbox", { name: "Nom du responsable", exact: true }).fill("TEST");
                        await page.getByRole("textbox", { name: "Prénom du responsable", exact: true }).fill("Test");
                        await page.getByRole("textbox", { name: "Téléphone responsable", exact: true }).fill("+229 96 00 00 01");
                        await page.getByRole("button", { name: /^continuer$/i }).click();
                        await page.getByLabel("Classe demandée *").selectOption({ index: 1 });
                        await page.getByRole("button", { name: /^continuer$/i }).click();
                        await page.getByRole("button", { name: /finaliser l'inscription/i }).click();
                        await pause(admin, 3000);
                        await expect(page.getByText(/inscription enregistrée/i)).toHaveCount(0);
                    },
                    { refusAttendu: true },
                );
                await step(
                    admin,
                    "Téléphone du responsable invalide : refus",
                    async () => {
                        await goto(admin, "/dashboard/students/inscription");
                        await fillIdentity(admin, { ...eleves[0], key: "tel-invalide", matricule: "COC-2026-9999", prenom: "Téléphone" });
                        await page.getByRole("button", { name: /^continuer$/i }).click();
                        await page.getByRole("textbox", { name: "Nom du responsable", exact: true }).fill("TEST");
                        await page.getByRole("textbox", { name: "Prénom du responsable", exact: true }).fill("Test");
                        await page.getByRole("textbox", { name: "Téléphone responsable", exact: true }).fill("12");
                        await page.getByRole("button", { name: /^continuer$/i }).click();
                        await pause(admin, 2000);
                        await expect(page.getByRole("heading", { name: /famille/i })).toBeVisible();
                    },
                    { refusAttendu: true },
                );
            }
            await step(admin, "Liste des élèves : liste, tableau, recherche", async () => {
                await goto(admin, "/dashboard/students");
                await scrollThrough(admin);
                await page.getByRole("button", { name: /^tableau$/i }).click().catch(() => undefined);
                await pause(admin, 1500);
                await page.getByRole("button", { name: /^liste$/i }).click().catch(() => undefined);
                const search = page.getByPlaceholder(/nom, prénom|rechercher/i).first();
                await search.fill(eleves[0].nom);
                await pause(admin, 1500);
                await search.fill("");
                await pause(admin, 800);
            });
            await step(admin, "Export des élèves", async () => {
                const download = page.waitForEvent("download", { timeout: 15_000 });
                await page.getByRole("button", { name: /exporter/i }).first().click();
                expect((await download).suggestedFilename()).toMatch(/\.(csv|xlsx)$/);
            });
            await step(admin, `Fiche élève de ${eleves[0].prenom} ${eleves[0].nom} : tous les onglets`, async () => explorePage(admin, etat.get(`url:${eleves[0].key}`)));
        } finally {
            await admin.close();
        }
    });
}

test("06 · comptes parents et codes de liaison (dont un parent sur deux sites)", async ({ browser }) => {
    const byParent = new Map<string, Eleve[]>();
    for (const e of ELEVES.filter((x) => x.responsable.compte)) byParent.set(e.responsable.key, [...(byParent.get(e.responsable.key) ?? []), e]);

    for (const [parentKey, enfants] of byParent) {
        const r = enfants[0].responsable;
        const ecoleCompte = ECOLES.find((x) => x.key === enfants[0].ecole)!;
        const admin = await direction(browser, ecoleCompte, "06-comptes-parents-et-codes", `${ecoleCompte.admin.key}-${parentKey}`);
        try {
            await step(admin, `Compte parent de ${r.firstName} ${r.lastName}`, async () => {
                const page = admin.page;
                await goto(admin, "/dashboard/users/new");
                await page.getByLabel("Prénom de l'utilisateur", { exact: true }).fill(r.firstName);
                await page.getByLabel("Nom de l'utilisateur", { exact: true }).fill(r.lastName);
                await page.getByLabel("Adresse e-mail de l'utilisateur", { exact: true }).fill(mail(parentKey));
                await page.getByLabel("Téléphone de l'utilisateur", { exact: true }).fill(r.phone);
                await pickOption(admin, page.getByLabel("Sélectionner le rôle utilisateur"), /^parent$/i);
                await page.getByRole("button", { name: /créer l'utilisateur/i }).click();
                await expect(page.getByText(/utilisateur créé avec succès/i).first()).toBeVisible();
                await pause(admin, 1500);
                const provisional = (await page.locator("code.select-all").innerText()).trim();
                etat.setAccount(parentKey, { email: mail(parentKey), password: provisional, role: "PARENT", name: `${r.firstName} ${r.lastName}` });
            });
        } finally {
            await admin.close();
        }
        for (const e of enfants) {
            const ecole = ECOLES.find((x) => x.key === e.ecole)!;
            const dir = await direction(browser, ecole, "06-comptes-parents-et-codes", `${ecole.admin.key}-code-${e.key}`);
            try {
                await step(dir, `Code de liaison pour ${e.prenom} ${e.nom} (${ecole.name})`, async () => {
                    const page = dir.page;
                    await goto(dir, etat.get(`url:${e.key}`));
                    await page.getByRole("button", { name: /code|liaison/i }).first().click();
                    const dialog = page.getByRole("dialog", { name: /code de liaison parent/i });
                    await dialog.getByRole("button", { name: /générer le code/i }).click();
                    const code = dialog.getByText(/^[A-Z0-9]{8}$/);
                    await expect(code).toBeVisible();
                    await pause(dir, 2500);
                    etat.set(`code:${e.key}`, (await code.innerText()).trim());
                    await page.keyboard.press("Escape");
                });
            } finally {
                await dir.close();
            }
        }
    }
});

test("07 · premières connexions des élèves", async ({ browser }) => {
    for (const e of ELEVES) {
        const eleve = await openActor(browser, { etape: ETAPE, scenario: "07-premieres-connexions-eleves", name: e.key, label: `${e.prenom} ${e.nom} (élève, ${e.classe})` });
        try {
            const account = etat.account(e.key);
            await step(eleve, "Mot de passe provisoire : changement imposé, consentement", async () => {
                await firstLogin(eleve, account.email, account.password, pwd(e.key));
                etat.setAccount(e.key, { ...account, password: pwd(e.key) });
            });
            await step(eleve, "Accueil de l'élève", async () => {
                await goto(eleve, "/dashboard");
                await pause(eleve, 1500);
                await scrollThrough(eleve);
            });
        } finally {
            await eleve.close();
        }
    }
});

test("08 · premières connexions des parents et rattachement des enfants", async ({ browser }) => {
    const keys = [...new Set(ELEVES.filter((e) => e.responsable.compte).map((e) => e.responsable.key))];
    for (const key of keys) {
        const enfants = ELEVES.filter((e) => e.responsable.key === key);
        const r = enfants[0].responsable;
        const parent = await openActor(browser, { etape: ETAPE, scenario: "08-parents-rattachement", name: key, label: `${r.firstName} ${r.lastName} (parent)` });
        try {
            const account = etat.account(key);
            await step(parent, "Mot de passe provisoire : changement imposé, consentement", async () => {
                await firstLogin(parent, account.email, account.password, pwd(key));
                etat.setAccount(key, { ...account, password: pwd(key) });
            });
            await step(parent, "Accueil d'un parent sans enfant rattaché", async () => {
                await goto(parent, "/dashboard");
                await pause(parent, 1500);
                await scrollThrough(parent);
            });
            await step(
                parent,
                "Code de liaison erroné : refus",
                async () => {
                    await goto(parent, "/dashboard/onboarding");
                    await parent.page.getByLabel("Matricule élève").fill(enfants[0].matricule);
                    await parent.page.getByLabel(/code de liaison/i).fill("ZZZZ9999");
                    await parent.page.getByRole("button", { name: /lier cet enfant/i }).click();
                    await pause(parent, 2500);
                    await expect(parent.page.getByText(/invalide|incorrect|introuvable|expiré/i).first()).toBeVisible();
                },
                { refusAttendu: true },
            );
            for (const e of enfants) {
                await step(parent, `Rattachement de ${e.prenom} ${e.nom} (${ECOLES.find((x) => x.key === e.ecole)!.name}, ${e.classe})`, async () => {
                    await goto(parent, "/dashboard/onboarding");
                    await parent.page.getByLabel("Matricule élève").fill(e.matricule);
                    await parent.page.getByLabel(/code de liaison/i).fill(etat.get(`code:${e.key}`));
                    await parent.page.getByRole("button", { name: /lier cet enfant/i }).click();
                    await pause(parent, 2500);
                    await goto(parent, "/dashboard");
                    await acceptConsent(parent);
                    await expect(parent.page.getByText(e.prenom).first(), "l'enfant rattaché doit apparaître sur l'accueil du parent").toBeVisible();
                });
            }
            await step(parent, "Mes enfants", async () => explorePage(parent, "/dashboard/students"));
            await step(parent, "Accueil du parent avec ses enfants", async () => {
                await goto(parent, "/dashboard");
                await pause(parent, 1500);
                await scrollThrough(parent);
            });
        } finally {
            await parent.close();
        }
    }
});
