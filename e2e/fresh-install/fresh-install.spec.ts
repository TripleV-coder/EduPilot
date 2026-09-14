/**
 * Démarrage à vide (Lot 5) — de la base neuve à la consultation des notes par
 * un parent, EXCLUSIVEMENT depuis l'interface.
 *
 * Prérequis : serveur de production sur une base NEUVE (migrate deploy, aucun
 * seed, aucun utilisateur), rôle applicatif soumis à la RLS. Lancement :
 *   E2E_BASE_URL=http://localhost:3100 npx playwright test -c playwright.fresh.config.ts
 *
 * Chaque compte est créé par le parcours (aucun compte de démonstration) et
 * chaque mot de passe provisoire est lu à l'écran, comme le ferait l'auteur.
 */
import { test, expect, type Browser, type Page } from "@playwright/test";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

// Le parcours des états vides réutilise le super-administrateur de l'installation.
test.describe.configure({ mode: "serial" });

const RUN = Date.now().toString(36);
const mail = (who: string) => `${who}.${RUN}@fresh-install.test`;

const SUPER_ADMIN = { email: mail("root"), password: "Racine!2026x" };
const SCHOOL_ADMIN = { email: mail("direction"), password: "Ecole!2026ab" };
const TEACHER = { email: mail("prof"), password: "Profes!2026ab" };
const STUDENT = { email: mail("eleve"), password: "Eleve!2026abc" };
const PARENT = { email: mail("parent"), password: "Parent!2026ab" };

const YEAR = "2026-2027";
const NEXT_YEAR = "2027-2028";
const CURRENT_PERIOD = "Trimestre 1";
const NEXT_PERIOD = "T1 2027-2028";
const LEVEL = "Sixième";
const CLASS_NAME = "6ème A";
const SUBJECT = "Mathématiques";
const MATRICULE = `BJ-${RUN.toUpperCase()}`;
const GRADE = "15";

/** Échoue avec le message affiché si l'écran signale une erreur. */
async function expectNoErrorBanner(page: Page) {
    const banner = page.locator('[role="alert"], .text-destructive p, [data-sonner-toast][data-type="error"]').filter({ hasText: /\S/ });
    if (await banner.count()) {
        const texts = (await banner.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
        expect(texts, "message d'erreur affiché à l'écran").toEqual([]);
    }
}

async function newPage(browser: Browser): Promise<Page> {
    const context = await browser.newContext();
    return context.newPage();
}

async function login(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: /se connecter/i }).click();
}

/** Première connexion d'un compte créé par un tiers : changement imposé (M1). */
async function firstLogin(page: Page, email: string, provisional: string, chosen: string) {
    await login(page, email, provisional);
    await page.waitForURL(/\/first-login/, { timeout: 30_000 });
    await page.locator("#currentPassword").fill(provisional);
    await page.locator("#newPassword").fill(chosen);
    await page.locator("#confirmPassword").fill(chosen);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    await login(page, email, chosen);
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

test("installation complète depuis une base vide, jusqu'à la consultation par un parent", async ({ browser }) => {
    test.setTimeout(15 * 60_000);

    const root = await newPage(browser);
    const admin = await newPage(browser);
    let adminProvisional = "";
    let teacherProvisional = "";
    let studentProvisional = "";
    let parentProvisional = "";
    let studentUrl = "";
    let linkCode = "";

    await test.step("1. /setup crée le premier super-administrateur", async () => {
        await root.goto("/login");
        await root.goto("/setup");
        await root.locator("#firstName").fill("Aïcha");
        await root.locator("#lastName").fill("Houénou");
        await root.locator("#email").fill(SUPER_ADMIN.email);
        await root.locator("#password").fill(SUPER_ADMIN.password);
        await root.locator("#confirmPassword").fill(SUPER_ADMIN.password);
        await root.getByRole("button", { name: /compléter l'installation/i }).click();
        await root.waitForURL(/\/login/, { timeout: 30_000 });
        await login(root, SUPER_ADMIN.email, SUPER_ADMIN.password);
        await root.waitForURL(/\/dashboard/, { timeout: 30_000 });
    });

    await test.step("2. la console root déploie l'établissement et son administrateur", async () => {
        await root.goto("/dashboard/root-control/schools");
        await root.getByRole("button", { name: /déployer un établissement/i }).click();
        const dialog = root.getByRole("dialog");
        await dialog.locator("#create-name").fill("Collège Les Cocotiers");
        await dialog.locator("#create-city").fill("Cotonou");
        await dialog.getByRole("button", { name: /étape suivante/i }).click();
        await dialog.locator("#admin-firstname").fill("Rodrigue");
        await dialog.locator("#admin-lastname").fill("Agossou");
        await dialog.locator("#admin-email").fill(SCHOOL_ADMIN.email);
        await dialog.locator('button[type="submit"]').click();
        const credentials = root.getByRole("dialog", { name: /identifiants de l'administrateur/i });
        await expect(credentials).toBeVisible({ timeout: 30_000 });
        adminProvisional = (await credentials.locator(".select-all").innerText()).trim();
        expect(adminProvisional).toMatch(/\S{8,}/);
    });

    await test.step("3. l'administrateur change son mot de passe provisoire", async () => {
        await firstLogin(admin, SCHOOL_ADMIN.email, adminProvisional, SCHOOL_ADMIN.password);
    });

    await test.step("4. années scolaires : la courante (créée au déploiement) et la suivante", async () => {
        await admin.goto("/dashboard/settings/academic");
        // Le déploiement crée l'année en cours et ses trimestres (lib/schools/provisioning).
        await expect(admin.getByText(YEAR).first()).toBeVisible();
        await admin.getByRole("button", { name: /nouvelle année/i }).click();
        await admin.locator("#name").fill(NEXT_YEAR);
        await admin.locator("#startDate").fill("2027-09-01");
        await admin.locator("#endDate").fill("2028-07-31");
        await admin.locator('form button[type="submit"]').click();
        await expect(admin.getByText(/année académique créée avec succès/i)).toBeVisible();
        await expectNoErrorBanner(admin);
    });

    await test.step("5. périodes : trimestres de l'année courante, création d'une période", async () => {
        await admin.goto("/dashboard/settings/periods");
        await admin.getByRole("combobox").first().click();
        await admin.getByRole("option", { name: NEXT_YEAR }).click();
        await admin.getByRole("button", { name: /nouvelle période/i }).click();
        // Contenu de la carte du formulaire : titre et champs (libellés non associés aux champs).
        const card = admin.locator("div.space-y-4").filter({ has: admin.getByRole("heading", { name: /nouvelle période/i }) }).first();
        await card.locator("input").first().fill(NEXT_PERIOD);
        await card.locator('input[type="date"]').nth(0).fill("2027-09-01");
        await card.locator('input[type="date"]').nth(1).fill("2027-12-20");
        await admin.getByRole("button", { name: /^créer$/i }).click();
        await expect(admin.getByRole("heading", { name: NEXT_PERIOD })).toBeVisible();

        await admin.getByRole("combobox").first().click();
        await admin.getByRole("option", { name: YEAR }).click();
        await expect(admin.getByRole("heading", { name: CURRENT_PERIOD })).toBeVisible();
    });

    await test.step("6. niveau de collège", async () => {
        await admin.goto("/dashboard/settings/class-levels");
        await admin.getByRole("button", { name: /nouveau niveau/i }).click();
        await admin.locator("#name").fill(LEVEL);
        await admin.locator("#code").fill("6E");
        await admin.locator("#level").selectOption({ label: "Collège" });
        await admin.locator("#sequence").fill("1");
        await admin.locator('form button[type="submit"]').click();
        await expect(admin.getByText(/niveau d'étude créé avec succès/i)).toBeVisible();
        await expectNoErrorBanner(admin);
    });

    await test.step("7. matière et type d'évaluation", async () => {
        await admin.goto("/dashboard/settings/subjects");
        await admin.getByRole("button", { name: /nouvelle matière/i }).click();
        await admin.locator("#name").fill(SUBJECT);
        await admin.locator("#code").fill("MATH");
        await admin.locator('form button[type="submit"]').click();
        await expect(admin.getByText(/matière créée avec succès/i)).toBeVisible();

        await admin.getByRole("tab", { name: /types d'évaluation/i }).click();
        await admin.getByRole("button", { name: /nouveau type/i }).click();
        await admin.locator("#evalName").fill("Devoir surveillé");
        await admin.locator("#evalCode").fill("DS");
        await admin.locator('form:has(#evalName) button[type="submit"]').click();
        await expect(admin.getByText(/type d'évaluation créé avec succès/i)).toBeVisible();
    });

    await test.step("8. enseignant", async () => {
        await admin.goto("/dashboard/teachers/new");
        await admin.getByLabel("Prénom de l'enseignant").fill("Koffi");
        await admin.getByLabel("Nom de famille de l'enseignant").fill("Dossou");
        await admin.getByLabel("Adresse e-mail de l'enseignant").fill(TEACHER.email);
        await admin.getByRole("button", { name: /^enregistrer$/i }).click();
        await expect(admin.getByText(/enseignant créé avec succès/i)).toBeVisible();
        teacherProvisional = (await admin.locator("code.select-all").innerText()).trim();
    });

    await test.step("9. classe, avec professeur principal", async () => {
        await admin.goto("/dashboard/classes/new");
        await admin.getByLabel("Nom de la classe").fill(CLASS_NAME);
        await admin.getByLabel("Sélectionner le niveau d'étude").click();
        await admin.getByRole("option", { name: LEVEL }).click();
        await admin.getByLabel("Sélectionner le professeur principal").click();
        await admin.getByRole("option", { name: /dossou/i }).click();
        await admin.getByRole("button", { name: /enregistrer la classe/i }).click();
        await expect(admin.getByText(/classe créée avec succès/i)).toBeVisible();
    });

    await test.step("10. matière affectée à la classe, avec son enseignant", async () => {
        await admin.goto("/dashboard/classes");
        await admin.getByRole("link", { name: new RegExp(CLASS_NAME) }).first().click();
        await admin.waitForURL(/\/dashboard\/classes\/[^/]+$/);
        await admin.getByRole("button", { name: /assigner une matière/i }).click();
        // Option libellée « Mathématiques (MATH) » : choisie par sa valeur.
        const subjectSelect = admin.locator("select#subjectId");
        const subjectValue = await subjectSelect.locator("option", { hasText: SUBJECT }).getAttribute("value");
        await subjectSelect.selectOption(subjectValue ?? "");
        await admin.locator("select#teacherId").selectOption({ index: 1 });
        await admin.getByRole("button", { name: /^assigner$/i }).click();
        await expect(admin.getByText(/matière assignée avec succès/i)).toBeVisible();
    });

    await test.step("11. inscription d'un élève", async () => {
        await admin.goto("/dashboard/students/inscription");
        // Correspondance exacte : « Nom * » est aussi contenu dans « Prénom * ».
        await admin.getByLabel("Nom *", { exact: true }).fill("Hounsou");
        await admin.getByLabel("Prénom *", { exact: true }).fill("Aïcha");
        await admin.getByLabel("Matricule *", { exact: true }).fill(MATRICULE);
        await admin.getByLabel("Téléphone *", { exact: true }).fill("+229 90 00 00 01");
        await admin.getByLabel("Email *", { exact: true }).fill(STUDENT.email);
        await admin.getByRole("button", { name: /continuer/i }).click();
        await admin.getByRole("button", { name: /continuer/i }).click();
        await admin.getByLabel("Classe demandée *").selectOption({ label: CLASS_NAME });
        await admin.getByRole("button", { name: /^finaliser$/i }).click();
        await expect(admin.getByText(/inscription enregistrée/i)).toBeVisible({ timeout: 30_000 });
        studentProvisional = (await admin.locator("code").first().innerText()).trim();
        await admin.getByRole("button", { name: /ouvrir la fiche de l'élève/i }).click();
        // « /dashboard/students/inscription » correspond aussi à /students/<id> : on attend la fiche.
        await admin.waitForURL((url) => /\/dashboard\/students\/(?!inscription$)[^/]+$/.test(url.pathname));
        studentUrl = new URL(admin.url()).pathname;
    });

    await test.step("12. compte parent et code de liaison", async () => {
        await admin.goto("/dashboard/users/new");
        await admin.getByLabel("Prénom de l'utilisateur", { exact: true }).fill("Fabrice");
        await admin.getByLabel("Nom de l'utilisateur", { exact: true }).fill("Hounsou");
        await admin.getByLabel("Adresse e-mail de l'utilisateur", { exact: true }).fill(PARENT.email);
        await admin.getByLabel("Sélectionner le rôle utilisateur").click();
        await admin.getByRole("option", { name: /^parent$/i }).click();
        await admin.getByRole("button", { name: /créer l'utilisateur/i }).click();
        await expect(admin.getByText(/utilisateur créé avec succès/i)).toBeVisible();
        parentProvisional = (await admin.locator("code.select-all").innerText()).trim();

        await admin.goto(studentUrl);
        await admin.getByRole("button", { name: /code|liaison/i }).first().click();
        const dialog = admin.getByRole("dialog", { name: /code de liaison parent/i });
        await dialog.getByRole("button", { name: /générer le code/i }).click();
        await expect(dialog.getByText(/^[A-Z0-9]{8}$/)).toBeVisible();
        linkCode = (await dialog.getByText(/^[A-Z0-9]{8}$/).innerText()).trim();
    });

    await test.step("13. l'enseignant saisit une note", async () => {
        const teacher = await newPage(browser);
        await firstLogin(teacher, TEACHER.email, teacherProvisional, TEACHER.password);
        await teacher.goto("/dashboard/grades/entry");
        // Chaque libellé enveloppe sa liste : son nom accessible inclut les options
        // (« Choisir une classe » dans la liste des matières). Liste ciblée par le
        // libellé qui COMMENCE par le nom du champ.
        const field = (name: string) =>
            teacher.locator("label").filter({ has: teacher.locator("select") }).filter({ hasText: new RegExp(`^${name}`) }).locator("select");
        await field("Classe").selectOption({ label: CLASS_NAME });
        await field("Matière").selectOption({ label: SUBJECT });
        await field("Période").selectOption({ label: CURRENT_PERIOD });
        await field("Type").selectOption({ label: "Devoir surveillé" });
        await teacher.getByLabel("Note", { exact: true }).first().fill(GRADE);
        const saved = teacher.waitForResponse((r) => r.url().includes("/api/grades/batch") && r.request().method() === "POST");
        await teacher.getByRole("button", { name: /publier les notes/i }).click();
        expect((await saved).status()).toBeLessThan(300);
        await expectNoErrorBanner(teacher);
    });

    await test.step("14. l'élève se connecte", async () => {
        const student = await newPage(browser);
        await firstLogin(student, STUDENT.email, studentProvisional, STUDENT.password);
        await expect(student.locator("body")).not.toContainText(/Application error|Server Error/i);
    });

    await test.step("15. le parent rattache son enfant et consulte sa note", async () => {
        const parent = await newPage(browser);
        await firstLogin(parent, PARENT.email, parentProvisional, PARENT.password);
        await parent.goto("/dashboard/onboarding");
        await parent.getByLabel("Matricule élève").fill(MATRICULE);
        await parent.getByLabel(/code de liaison/i).fill(linkCode);
        await parent.getByRole("button", { name: /lier cet enfant/i }).click();
        await expectNoErrorBanner(parent);
        // Chemin du parent : « Mes enfants » → fiche de l'enfant → onglet Scolarité.
        await parent.goto("/dashboard/students");
        await parent.locator(`a[href="${studentUrl}"]`).first().click();
        await parent.waitForURL((url) => url.pathname === studentUrl);
        await parent.getByRole("tab", { name: /scolarité/i }).click();
        const row = parent.locator("tr").filter({ hasText: SUBJECT });
        await expect(row.first()).toBeVisible({ timeout: 30_000 });
        await expect(row.first().locator("td").nth(1)).toHaveText(GRADE);
    });
});

// ─── États vides (Lot 5) ────────────────────────────────────────────────────

const EMPTY_ADMIN = { email: mail("vide.direction"), password: "Vide!2026abcd" };
const EMPTY_TEACHER = { email: mail("vide.prof"), password: "Vide!2026efgh" };
const EMPTY_PARENT = { email: mail("vide.parent"), password: "Vide!2026ijkl" };

/** Toutes les pages statiques du tableau de bord (routes `[param]` exclues), lues dans le code. */
function dashboardRoutes(): string[] {
    const root = path.join(__dirname, "..", "..", "src", "app", "(dashboard)", "dashboard");
    const routes: string[] = [];
    const walk = (dir: string, prefix: string) => {
        for (const name of readdirSync(dir)) {
            const full = path.join(dir, name);
            if (!statSync(full).isDirectory()) {
                if (name === "page.tsx") routes.push(prefix || "/dashboard");
                continue;
            }
            if (name.startsWith("[") || name.startsWith("_")) continue;
            const segment = name.startsWith("(") ? "" : `/${name}`;
            walk(full, `${prefix || "/dashboard"}${segment}`);
        }
    };
    walk(root, "");
    return [...new Set(routes)].sort();
}

async function deploySchool(root: Page, schoolName: string, adminEmail: string): Promise<string> {
    await root.goto("/dashboard/root-control/schools");
    await root.getByRole("button", { name: /déployer un établissement/i }).click();
    const dialog = root.getByRole("dialog");
    await dialog.locator("#create-name").fill(schoolName);
    await dialog.getByRole("button", { name: /étape suivante/i }).click();
    await dialog.locator("#admin-firstname").fill("Admin");
    await dialog.locator("#admin-lastname").fill("Vide");
    await dialog.locator("#admin-email").fill(adminEmail);
    await dialog.locator('button[type="submit"]').click();
    const credentials = root.getByRole("dialog", { name: /identifiants de l'administrateur/i });
    await expect(credentials).toBeVisible({ timeout: 30_000 });
    const provisional = (await credentials.locator(".select-all").innerText()).trim();
    await credentials.getByRole("button").last().click();
    return provisional;
}

async function createAccount(admin: Page, email: string, role?: RegExp): Promise<string> {
    await admin.goto("/dashboard/users/new");
    await admin.getByLabel("Prénom de l'utilisateur", { exact: true }).fill("Compte");
    await admin.getByLabel("Nom de l'utilisateur", { exact: true }).fill("Vide");
    await admin.getByLabel("Adresse e-mail de l'utilisateur", { exact: true }).fill(email);
    if (role) {
        await admin.getByLabel("Sélectionner le rôle utilisateur").click();
        await admin.getByRole("option", { name: role }).click();
    }
    await admin.getByRole("button", { name: /créer l'utilisateur/i }).click();
    await expect(admin.getByText(/utilisateur créé avec succès/i)).toBeVisible();
    return (await admin.locator("code.select-all").innerText()).trim();
}

/**
 * Visite chaque page et relève tout ce qu'un utilisateur ne doit jamais voir
 * dans une école sans données : erreur serveur ou 404, écran d'erreur,
 * exception non rattrapée, « NaN », « Infinity » ou « undefined » affichés,
 * zone principale vide, perte de session. « Accès refusé » est attendu pour
 * les pages d'un autre rôle et n'est pas une anomalie.
 */
async function crawlEmptySchool(page: Page, role: string, routes: string[]): Promise<string[]> {
    const problems: string[] = [];
    let pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message.split("\n")[0]));
    for (const route of routes) {
        pageErrors = [];
        let status = 0;
        try {
            const response = await page.goto(route, { waitUntil: "load", timeout: 45_000 });
            status = response?.status() ?? 0;
        } catch (error) {
            problems.push(`${role} ${route} : navigation impossible (${(error as Error).message.split("\n")[0]})`);
            continue;
        }
        await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
        const where = `${role} ${route}`;
        if (new URL(page.url()).pathname.startsWith("/login")) {
            problems.push(`${where} : session perdue (renvoi vers /login)`);
            continue;
        }
        if (status >= 500 || status === 404) problems.push(`${where} : HTTP ${status}`);
        const body = await page.locator("body").innerText().catch(() => "");
        if (/Une erreur inattendue est survenue|Application error|Internal Server Error/i.test(body)) {
            problems.push(`${where} : écran d'erreur`);
        }
        const garbage = body.match(/\b(NaN|Infinity|undefined)\b/);
        if (garbage) problems.push(`${where} : « ${garbage[1]} » affiché`);
        const main = page.locator("main");
        const mainText = (await main.count()) ? await main.first().innerText().catch(() => "") : body;
        if (!mainText.trim()) problems.push(`${where} : zone principale vide`);
        for (const message of pageErrors) problems.push(`${where} : exception « ${message} »`);
    }
    return problems;
}

test("toutes les pages s'affichent dans une école sans aucune donnée (admin, enseignant, parent)", async ({ browser }) => {
    test.setTimeout(90 * 60_000);
    const routes = dashboardRoutes();
    expect(routes.length).toBeGreaterThan(100);

    const root = await newPage(browser);
    await login(root, SUPER_ADMIN.email, SUPER_ADMIN.password);
    await root.waitForURL(/\/dashboard/, { timeout: 30_000 });
    const adminProvisional = await deploySchool(root, "École Sans Données", EMPTY_ADMIN.email);

    const admin = await newPage(browser);
    await firstLogin(admin, EMPTY_ADMIN.email, adminProvisional, EMPTY_ADMIN.password);
    const teacherProvisional = await createAccount(admin, EMPTY_TEACHER.email);
    const parentProvisional = await createAccount(admin, EMPTY_PARENT.email, /^parent$/i);

    const teacher = await newPage(browser);
    await firstLogin(teacher, EMPTY_TEACHER.email, teacherProvisional, EMPTY_TEACHER.password);
    const parent = await newPage(browser);
    await firstLogin(parent, EMPTY_PARENT.email, parentProvisional, EMPTY_PARENT.password);

    const problems = [
        ...(await crawlEmptySchool(admin, "SCHOOL_ADMIN", routes)),
        ...(await crawlEmptySchool(teacher, "TEACHER", routes)),
        ...(await crawlEmptySchool(parent, "PARENT", routes)),
    ];
    console.log(`[états vides] ${routes.length} pages × 3 rôles — ${problems.length} anomalie(s)`);
    expect(problems).toEqual([]);
});
