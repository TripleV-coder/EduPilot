/**
 * Étape 00 — Installation : l'application vierge, vue d'un visiteur, puis la
 * toute première installation (création du super-administrateur), le verrou
 * de /setup, les erreurs de connexion et le mot de passe oublié (vrai courriel).
 */
import { expect, test } from "@playwright/test";
import {
    acceptConsent,
    etat,
    expectMessage,
    explorePage,
    goto,
    latestMail,
    login,
    MAILPIT,
    openActor,
    pause,
    scrollThrough,
    step,
} from "./kit";
import { ROOT } from "./donnees";

const ETAPE = "00-installation";

test("01 · le site public d'une application vierge", async ({ browser }) => {
    const visiteur = await openActor(browser, { etape: ETAPE, scenario: "01-site-public-vierge", name: "visiteur", label: "Visiteur" });
    try {
        await step(visiteur, "Page d'accueil : défilement complet", async () => {
            await goto(visiteur, "/");
            await expect(visiteur.page.getByRole("heading", { level: 1 })).toBeVisible();
            await scrollThrough(visiteur);
        });
        await step(visiteur, "Bannière cookies : lecture puis acceptation", async () => {
            const accept = visiteur.page.getByRole("button", { name: /j.accepte/i });
            if (await accept.isVisible().catch(() => false)) {
                await pause(visiteur, 1200);
                await accept.click();
            }
        });
        await step(visiteur, "Tarifs : bascule mensuel / annuel", async () => {
            const toggle = visiteur.page.getByRole("switch", { name: /facturation annuelle/i });
            await toggle.scrollIntoViewIfNeeded();
            await toggle.click();
            await pause(visiteur, 1000);
            await toggle.click();
        });
        await step(visiteur, "Questions fréquentes : ouverture de chaque réponse", async () => {
            const questions = visiteur.page.locator("h3 button");
            const n = await questions.count();
            for (let i = 0; i < n; i++) {
                await questions.nth(i).scrollIntoViewIfNeeded();
                await questions.nth(i).click();
                await pause(visiteur, 900);
            }
        });
        for (const [route, titre] of [
            ["/explorer", "Cartographie du réseau (vide)"],
            ["/ecoles", "Annuaire des établissements (vide)"],
            ["/privacy", "Politique de confidentialité"],
            ["/terms", "Conditions d'utilisation"],
            ["/offline", "Page hors ligne"],
            ["/login", "Page de connexion"],
            ["/register", "Inscription publique (renvoie vers l'installation)"],
            ["/forgot-password", "Mot de passe oublié"],
        ] as const) {
            await step(visiteur, titre, async () => explorePage(visiteur, route));
        }
        await step(visiteur, "Annuaire : filtres type et cycle sans établissement", async () => {
            await goto(visiteur, "/ecoles");
            await visiteur.page.getByRole("combobox", { name: "Type" }).selectOption({ label: "Privé" });
            await pause(visiteur);
            await visiteur.page.getByRole("combobox", { name: "Cycle" }).selectOption({ label: "Collège" });
            await pause(visiteur);
            await visiteur.page.getByRole("searchbox", { name: /rechercher une école/i }).fill("Cocotiers");
            await pause(visiteur, 1200);
        });
        await step(visiteur, "Accès direct au tableau de bord sans être connecté : renvoi à la connexion", async () => {
            await goto(visiteur, "/dashboard/students");
            await expect(visiteur.page).toHaveURL(/\/login/);
        }, { refusAttendu: true });
        await step(visiteur, "Connexion alors qu'aucun compte n'existe", async () => {
            await login(visiteur, { email: ROOT.email, password: ROOT.password });
            await pause(visiteur, 2000);
            await expect(visiteur.page).toHaveURL(/\/login/);
        }, { refusAttendu: true });
    } finally {
        await visiteur.close();
    }
});

test("02 · installation : création du super-administrateur", async ({ browser }) => {
    const root = await openActor(browser, { etape: ETAPE, scenario: "02-installation-super-admin", name: "super-admin", label: "Super-admin" });
    try {
        await step(
            root,
            "Configuration initiale depuis la page d'accueil",
            async () => {
                await goto(root, "/");
                await root.page.getByRole("link", { name: /configuration initiale/i }).click();
                await root.page.waitForURL(/\/setup/);
            },
            { critical: true },
        );
        await step(root, "Formulaire soumis vide : messages de validation", async () => {
            await root.page.getByRole("button", { name: /compléter l'installation/i }).click();
            await pause(root, 1500);
            await expect(root.page).toHaveURL(/\/setup/);
        }, { refusAttendu: true });
        await step(root, "Mot de passe faible puis confirmation différente : refus", async () => {
            await root.page.locator("#firstName").fill(ROOT.firstName);
            await root.page.locator("#lastName").fill(ROOT.lastName);
            await root.page.locator("#email").fill(ROOT.email);
            await root.page.locator("#password").fill("abc123");
            await root.page.locator("#confirmPassword").fill("abc123");
            await root.page.getByRole("button", { name: /compléter l'installation/i }).click();
            await pause(root, 1500);
            await root.page.locator("#password").fill(ROOT.password);
            await root.page.locator("#confirmPassword").fill(`${ROOT.password}x`);
            await root.page.getByRole("button", { name: /compléter l'installation/i }).click();
            await pause(root, 1500);
            await expect(root.page).toHaveURL(/\/setup/);
        }, { refusAttendu: true });
        await step(
            root,
            "Création du super-administrateur",
            async () => {
                await root.page.locator("#confirmPassword").fill(ROOT.password);
                await root.page.getByRole("button", { name: /compléter l'installation/i }).click();
                await root.page.waitForURL(/\/login/, { timeout: 30_000 });
                etat.setAccount("root", { email: ROOT.email, password: ROOT.password, role: "SUPER_ADMIN", name: `${ROOT.firstName} ${ROOT.lastName}` });
            },
            { critical: true },
        );
        await step(
            root,
            "Première connexion et consentement (conditions + confidentialité)",
            async () => {
                await login(root, ROOT);
                await root.page.waitForURL(/\/dashboard/, { timeout: 45_000 });
                await pause(root, 1500);
                await scrollThrough(root);
                await acceptConsent(root, { expectVisible: true });
            },
            { critical: true },
        );
        await step(root, "Tableau de bord du super-administrateur sur une plateforme vide", async () => {
            await goto(root, "/dashboard");
            await pause(root, 1500);
            await scrollThrough(root);
        });
    } finally {
        await root.close();
    }
});

test("03 · /setup est verrouillé une fois l'installation faite", async ({ browser }) => {
    const visiteur = await openActor(browser, { etape: ETAPE, scenario: "03-setup-verrouille", name: "visiteur", label: "Visiteur" });
    try {
        await step(visiteur, "Retour sur /setup après installation", async () => {
            await goto(visiteur, "/setup");
            await pause(visiteur, 2500);
            await scrollThrough(visiteur);
        });
        await step(visiteur, "Tentative de créer un second super-administrateur", async () => {
            const form = visiteur.page.locator("#firstName");
            if (!(await form.isVisible().catch(() => false))) return;
            await form.fill("Intrus");
            await visiteur.page.locator("#lastName").fill("Pirate");
            await visiteur.page.locator("#email").fill("intrus@recette.edupilot.test");
            await visiteur.page.locator("#password").fill("Intrus!2026-abcd");
            await visiteur.page.locator("#confirmPassword").fill("Intrus!2026-abcd");
            await visiteur.page.getByRole("button", { name: /compléter l'installation/i }).click();
            await pause(visiteur, 2500);
            await login(visiteur, { email: "intrus@recette.edupilot.test", password: "Intrus!2026-abcd" });
            await pause(visiteur, 2500);
            await expect(visiteur.page, "le second super-administrateur ne doit pas pouvoir se connecter").not.toHaveURL(/\/dashboard/);
        }, { refusAttendu: true });
    } finally {
        await visiteur.close();
    }
});

test("04 · connexion : erreurs, affichage du mot de passe, mot de passe oublié par courriel", async ({ browser }) => {
    const root = await openActor(browser, { etape: ETAPE, scenario: "04-connexion-et-mot-de-passe-oublie", name: "super-admin", label: "Super-admin" });
    try {
        await step(root, "Champs vides", async () => {
            await goto(root, "/login");
            await root.page.getByRole("button", { name: /se connecter/i }).click();
            await pause(root, 1500);
            await expect(root.page).toHaveURL(/\/login/);
        }, { refusAttendu: true });
        await step(root, "Mauvais mot de passe", async () => {
            await login(root, { email: ROOT.email, password: "MauvaisMotDePasse!1" });
            await pause(root, 2500);
            await expect(root.page).toHaveURL(/\/login/);
        }, { refusAttendu: true });
        await step(root, "Adresse inconnue", async () => {
            await login(root, { email: "personne@recette.edupilot.test", password: "MauvaisMotDePasse!1" });
            await pause(root, 2500);
            await expect(root.page).toHaveURL(/\/login/);
        }, { refusAttendu: true });
        await step(root, "Afficher / masquer le mot de passe saisi", async () => {
            await root.page.locator("#password").fill(ROOT.password);
            await root.page.getByRole("button", { name: /afficher le mot de passe/i }).click();
            await pause(root, 1200);
            await root.page.getByRole("button", { name: /masquer le mot de passe|afficher le mot de passe/i }).click();
        });
        await step(root, "Mot de passe oublié : demande du lien", async () => {
            await root.page.getByRole("link", { name: /mot de passe oublié/i }).click();
            await root.page.waitForURL(/forgot-password/);
            await root.page.getByLabel("Email").fill(ROOT.email);
            await root.page.getByRole("button", { name: /envoyer le lien/i }).click();
            await pause(root, 2500);
        });
        let resetLink = "";
        await step(root, "Le courriel de réinitialisation arrive dans la boîte de réception", async () => {
            await expect.poll(async () => Boolean(await latestMail(ROOT.email)), { timeout: 30_000 }).toBe(true);
            const mail = await latestMail(ROOT.email);
            await goto(root, `${MAILPIT}/view/${mail?.id}`);
            await pause(root, 3000);
            resetLink = mail?.html.match(/href="([^"]*reset-password[^"]*)"/)?.[1]?.replace(/&amp;/g, "&") ?? "";
            expect(resetLink, "lien de réinitialisation dans le courriel").toContain("reset-password");
        });
        const nouveau = `${ROOT.password}-bis`;
        await step(root, "Lien du courriel : choix d'un nouveau mot de passe", async () => {
            const url = new URL(resetLink);
            await goto(root, `${url.pathname}${url.search}`);
            await pause(root, 1500);
            const inputs = root.page.locator('input[type="password"]');
            await inputs.nth(0).fill(nouveau);
            await inputs.nth(1).fill(nouveau);
            await root.page.getByRole("button", { name: /réinitialiser|enregistrer|valider|changer/i }).click();
            await pause(root, 2500);
        });
        await step(root, "Connexion avec le nouveau mot de passe", async () => {
            await login(root, { email: ROOT.email, password: nouveau });
            await root.page.waitForURL(/\/dashboard/, { timeout: 45_000 });
            etat.setAccount("root", { ...etat.account("root"), password: nouveau });
        });
        await step(root, "L'ancien lien de réinitialisation ne sert plus", async () => {
            const url = new URL(resetLink);
            await root.context.clearCookies();
            await goto(root, `${url.pathname}${url.search}`);
            const inputs = root.page.locator('input[type="password"]');
            if (await inputs.first().isVisible().catch(() => false)) {
                await inputs.nth(0).fill(`${nouveau}-ter`);
                await inputs.nth(1).fill(`${nouveau}-ter`);
                await root.page.getByRole("button", { name: /réinitialiser|enregistrer|valider|changer/i }).click();
            }
            await pause(root, 2500);
            await expectMessage(root, /invalide|expiré|déjà utilisé|n'est plus valide/i);
        }, { refusAttendu: true });
    } finally {
        await root.close();
    }
});
