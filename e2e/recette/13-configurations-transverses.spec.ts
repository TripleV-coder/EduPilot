/**
 * Étape 13 — Configurations transverses, en conditions réelles :
 * téléphone (375 px) pour chaque rôle, thème sombre, interface en anglais,
 * module coupé puis rétabli, cycle retiré puis rétabli, mode maintenance
 * global, double authentification (TOTP réel), verrouillage après échecs,
 * perte de connexion, suspension d'un établissement par la plateforme.
 */
import { expect, test } from "@playwright/test";
import { TOTP } from "otplib";
import { etat, explorePage, goto, login, loginToDashboard, openActor, pause, pickOption, scrollThrough, step } from "./kit";

const ETAPE = "13-configurations-transverses";
const MOBILE = { width: 375, height: 812 };

const totp = new TOTP({ step: 30, window: 1 } as never) as unknown as { generate: (opts: { secret: string }) => string };

test("01 · sur téléphone (375 px) : chaque rôle et ses écrans du quotidien", async ({ browser }) => {
    const parcours: { key: string; label: string; pages: string[] }[] = [
        { key: "admin-cocotiers", label: "Direction", pages: ["/dashboard", "/dashboard/students", "/dashboard/finance", "/dashboard/classes", "/dashboard/settings"] },
        { key: "prof-maths", label: "Enseignant", pages: ["/dashboard", "/dashboard/attendance", "/dashboard/grades/entry", "/dashboard/schedule", "/dashboard/messages"] },
        { key: "eleve-kate", label: "Élève", pages: ["/dashboard", "/dashboard/grades", "/dashboard/homework", "/dashboard/schedule"] },
        { key: "parent-zinsou", label: "Parent", pages: ["/dashboard", "/dashboard/students", "/dashboard/finance", "/dashboard/liaison", "/dashboard/messages"] },
        { key: "comptable-cocotiers", label: "Comptable", pages: ["/dashboard", "/dashboard/finance", "/dashboard/finance/payments/new"] },
    ];
    for (const p of parcours) {
        const actor = await openActor(browser, { etape: ETAPE, scenario: "01-telephone-375px", name: p.key, label: `${p.label} sur téléphone`, viewport: MOBILE, isMobile: true });
        try {
            await step(actor, "Connexion sur téléphone", async () => loginToDashboard(actor, etat.account(p.key)), { critical: true });
            await step(actor, "Menu mobile", async () => {
                await actor.page.getByRole("button", { name: /menu|navigation/i }).first().click();
                await pause(actor, 2000);
                await actor.page.keyboard.press("Escape");
            });
            for (const route of p.pages) {
                await step(actor, `${route} sur téléphone`, async () => {
                    await explorePage(actor, route);
                    const overflow = await actor.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
                    expect(overflow, "pas de défilement horizontal à 375 px").toBeLessThanOrEqual(1);
                });
            }
        } finally {
            await actor.close();
        }
    }
});

test("02 · thème sombre et interface en anglais", async ({ browser }) => {
    const parent = await openActor(browser, { etape: ETAPE, scenario: "02-theme-sombre-parent", name: "parent-agbossou", label: "Parent en thème sombre", colorScheme: "dark" });
    try {
        await step(parent, "Connexion", async () => loginToDashboard(parent, etat.account("parent-agbossou")), { critical: true });
        await step(parent, "Thème sombre choisi dans l'apparence", async () => {
            await goto(parent, "/dashboard/settings/appearance");
            await parent.page.getByRole("button", { name: /^sombre/i }).click();
            await pause(parent, 1500);
        });
        for (const route of ["/dashboard", "/dashboard/students", "/dashboard/finance", "/dashboard/notifications"]) {
            await step(parent, `${route} en thème sombre`, async () => explorePage(parent, route));
        }
        await step(parent, "Retour au thème clair", async () => {
            await goto(parent, "/dashboard/settings/appearance");
            await parent.page.getByRole("button", { name: /^clair/i }).click();
        });
    } finally {
        await parent.close();
    }

    const eleve = await openActor(browser, { etape: ETAPE, scenario: "03-interface-en-anglais-eleve", name: "eleve-gloria", label: "Élève en anglais" });
    try {
        await step(eleve, "Connexion", async () => loginToDashboard(eleve, etat.account("eleve-gloria")), { critical: true });
        await step(eleve, "Langue : English (US)", async () => {
            await goto(eleve, "/dashboard/settings/locale");
            await eleve.page.getByRole("combobox", { name: /^langue$/i }).selectOption({ label: "English (US)" });
            await eleve.page.getByRole("button", { name: /enregistrer maintenant/i }).click();
            await pause(eleve, 2000);
        });
        for (const route of ["/dashboard", "/dashboard/grades", "/dashboard/homework", "/dashboard/schedule", "/dashboard/settings"]) {
            await step(eleve, `${route} en anglais`, async () => {
                await explorePage(eleve, route);
                const body = await eleve.page.locator("main").first().innerText();
                const french = (body.match(/\b(Tableau de bord|Mes notes|Devoirs|Emploi du temps|Paramètres|Aucun|Aucune)\b/g) ?? []).length;
                expect(french, "textes restés en français dans l'interface anglaise").toBe(0);
            });
        }
        await step(eleve, "Retour au français", async () => {
            await goto(eleve, "/dashboard/settings/locale");
            await eleve.page.getByRole("combobox").first().selectOption({ label: "Français (France)" });
            await eleve.page.getByRole("button").filter({ hasText: /save|enregistrer/i }).last().click();
            await pause(eleve, 1500);
        });
    } finally {
        await eleve.close();
    }
});

test("04 · module coupé puis rétabli (Finance à La Rosée)", async ({ browser }) => {
    const admin = await openActor(browser, { etape: ETAPE, scenario: "04-module-coupe-puis-retabli", name: "admin-rosee", label: "Direction La Rosée" });
    const page = admin.page;
    const toggleFinance = async () => {
        await goto(admin, "/dashboard/settings/modules");
        await expect(page.getByText(/module\(s\)/)).toBeVisible();
        await page.locator("main").getByRole("button").filter({ hasText: /^\s*Finance et paiements/ }).first().click();
        await page.getByRole("button", { name: /^enregistrer$/i }).click();
        await expect(page.getByText(/modules enregistrés/i)).toBeVisible();
    };
    try {
        await step(admin, "Connexion", async () => loginToDashboard(admin, etat.account("admin-rosee")), { critical: true });
        await step(admin, "Finance visible avant la coupure", async () => explorePage(admin, "/dashboard/finance"));
        await step(admin, "Module « Finance et paiements » désactivé", toggleFinance);
        await step(admin, "Menu sans la finance", async () => {
            await goto(admin, "/dashboard");
            await pause(admin, 2000);
            const links = await page.$$eval('nav a[href^="/dashboard/finance"]', (els) => els.length);
            expect(links, "plus d'entrée finance dans le menu").toBe(0);
        });
        await step(
            admin,
            "Accès direct à la finance, module coupé",
            async () => {
                await explorePage(admin, "/dashboard/finance");
                const status = await page.evaluate(async () => (await fetch("/api/finance/stats")).status);
                expect(status, "l'API finance doit être fermée").toBeGreaterThanOrEqual(400);
            },
            { refusAttendu: true },
        );
        await step(admin, "Module rétabli", toggleFinance);
        await step(admin, "Finance de nouveau accessible", async () => explorePage(admin, "/dashboard/finance"));
    } finally {
        await admin.close();
    }
});

test("05 · cycle retiré puis rétabli (Lycée à Saint-Joseph)", async ({ browser }) => {
    const admin = await openActor(browser, { etape: ETAPE, scenario: "05-cycle-retire-puis-retabli", name: "admin-saint-joseph", label: "Direction Saint-Joseph" });
    const page = admin.page;
    const toggleLycee = async () => {
        await goto(admin, "/dashboard/settings/cycles");
        await page.getByRole("button", { name: /^Lycée \(second cycle\)/i }).click();
        await page.getByRole("button", { name: /^enregistrer$/i }).click();
        await pause(admin, 2500);
    };
    try {
        await step(admin, "Connexion", async () => loginToDashboard(admin, etat.account("admin-saint-joseph")), { critical: true });
        await step(admin, "Menu avec les trois cycles", async () => {
            await goto(admin, "/dashboard");
            await pause(admin, 2500);
        });
        await step(admin, "Cycle « Lycée » retiré", toggleLycee);
        await step(admin, "Menu et création de classe sans le lycée", async () => {
            await goto(admin, "/dashboard");
            await pause(admin, 2000);
            await goto(admin, "/dashboard/classes/new");
            await page.getByLabel("Sélectionner le niveau d'étude").click();
            await pause(admin, 1500);
            const niveaux = await page.getByRole("option").allInnerTexts();
            await page.keyboard.press("Escape");
            expect(niveaux.join(" "), "plus de niveau du lycée proposé").not.toMatch(/Seconde|Première|Terminale/);
        });
        await step(admin, "Cycle « Lycée » rétabli", toggleLycee);
    } finally {
        await admin.close();
    }
});

test("06 · maintenance globale activée par la plateforme", async ({ browser }) => {
    const root = await openActor(browser, { etape: ETAPE, scenario: "06-maintenance-globale", name: "super-admin", label: "Super-admin" });
    const prof = await openActor(browser, { etape: ETAPE, scenario: "06-maintenance-globale", name: "prof-maths", label: "Enseignant pendant la maintenance" });
    try {
        await step(root, "Connexion", async () => loginToDashboard(root, etat.account("root")), { critical: true });
        await step(prof, "Connexion de l'enseignant", async () => loginToDashboard(prof, etat.account("prof-maths")), { critical: true });
        await step(root, "Message personnalisé puis activation de la maintenance", async () => {
            await goto(root, "/dashboard/root-control/maintenance");
            await root.page.getByLabel("Message de maintenance personnalisé").fill("Mise à jour des bulletins en cours. Retour prévu à 14 h. Merci de votre patience.");
            await root.page.getByRole("button", { name: /enregistrer le message/i }).click();
            await pause(root, 1500);
            await root.page.getByRole("button", { name: /activer la maintenance globale/i }).click();
            const confirm = root.page.getByRole("dialog").getByRole("button", { name: /activer|confirmer/i });
            if (await confirm.isVisible().catch(() => false)) await confirm.click();
            await pause(root, 2500);
        });
        await step(
            prof,
            "L'enseignant voit l'écran de maintenance avec le message",
            async () => {
                await goto(prof, "/dashboard/attendance");
                await pause(prof, 2500);
                await expect(prof.page.getByText(/mise à jour des bulletins/i).first()).toBeVisible();
                const status = await prof.page.evaluate(async () => (await fetch("/api/classes")).status);
                expect(status, "API métier en 503").toBe(503);
            },
            { refusAttendu: true },
        );
        await step(root, "Le super-admin garde l'accès puis désactive la maintenance", async () => {
            await goto(root, "/dashboard/root-control/maintenance");
            await root.page.getByRole("button", { name: /désactiver|remettre en ligne|sortir/i }).first().click();
            const confirm = root.page.getByRole("dialog").getByRole("button", { name: /désactiver|confirmer/i });
            if (await confirm.isVisible().catch(() => false)) await confirm.click();
            await pause(root, 2500);
            await expect(root.page.getByText(/en ligne/i).first()).toBeVisible();
        });
        await step(prof, "Retour à la normale pour l'enseignant", async () => {
            await goto(prof, "/dashboard/attendance");
            await pause(prof, 2500);
            await expect(prof.page.getByText(/mise à jour des bulletins/i)).toHaveCount(0);
        });
    } finally {
        await prof.close();
        await root.close();
    }
});

test("07 · double authentification (application TOTP) : activation, connexion, désactivation", async ({ browser }) => {
    const key = "admin-lycee";
    const account = etat.account(key);
    const admin = await openActor(browser, { etape: ETAPE, scenario: "07-double-authentification", name: key, label: "Direction du lycée technique" });
    const page = admin.page;
    let secret = "";
    try {
        await step(admin, "Connexion", async () => loginToDashboard(admin, account), { critical: true });
        await step(
            admin,
            "Génération du QR code",
            async () => {
                await goto(admin, "/dashboard/settings/security");
                await page.getByRole("button", { name: /générer le qr code/i }).click();
                await expect(page.getByRole("img", { name: /qr code 2fa/i })).toBeVisible();
                secret = await page.getByLabel("Secret manuel").inputValue();
                expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
                await pause(admin, 2000);
            },
            { critical: true },
        );
        await step(
            admin,
            "Code faux : refus",
            async () => {
                await page.getByLabel("Code à 6 chiffres").fill("000000");
                await page.getByRole("button", { name: /activer la 2fa/i }).click();
                await pause(admin, 2000);
                await expect(page.getByText(/codes de secours/i)).toHaveCount(0);
            },
            { refusAttendu: true },
        );
        await step(
            admin,
            "Code de l'application : 2FA activée, codes de secours affichés",
            async () => {
                await page.getByLabel("Code à 6 chiffres").fill(totp.generate({ secret }));
                await page.getByRole("button", { name: /activer la 2fa/i }).click();
                await expect(page.getByText(/codes de secours/i).first()).toBeVisible();
                await pause(admin, 3000);
            },
            { critical: true },
        );
        await step(admin, "Nouvelle connexion : le code à 6 chiffres est demandé", async () => {
            await admin.context.clearCookies();
            await login(admin, account);
            await page.waitForURL(/mfa-verify/, { timeout: 30_000 });
            await pause(admin, 1500);
        });
        await step(
            admin,
            "Mauvais code : refus",
            async () => {
                await page.locator("input").first().click();
                await page.keyboard.type("123456", { delay: 150 });
                await pause(admin, 2500);
                await expect(page).toHaveURL(/mfa-verify/);
            },
            { refusAttendu: true },
        );
        await step(admin, "Bon code : accès au tableau de bord", async () => {
            await page.reload();
            await page.locator("input").first().click();
            await page.keyboard.type(totp.generate({ secret }), { delay: 150 });
            await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
            await pause(admin, 2000);
        });
        await step(admin, "Désactivation de la 2FA avec le mot de passe", async () => {
            await goto(admin, "/dashboard/settings/security");
            await page.getByLabel("Mot de passe pour désactiver").fill(account.password);
            await page.getByRole("button", { name: /désactiver/i }).click();
            await pause(admin, 2500);
            await expect(page.getByRole("button", { name: /générer le qr code/i })).toBeVisible();
        });
    } finally {
        await admin.close();
    }
});

test("08 · verrouillage du compte après des échecs répétés", async ({ browser }) => {
    const key = "instit-rosee";
    const account = etat.account(key);
    const actor = await openActor(browser, { etape: ETAPE, scenario: "08-verrouillage-apres-echecs", name: key, label: "Institutrice de La Rosée (tentatives)" });
    try {
        for (let i = 1; i <= 6; i++) {
            await step(
                actor,
                `Tentative ${i} avec un mauvais mot de passe`,
                async () => {
                    await login(actor, { email: account.email, password: `Mauvais!2026-${i}` });
                    await pause(actor, 1800);
                    await expect(actor.page).toHaveURL(/\/login/);
                },
                { refusAttendu: true },
            );
        }
        await step(
            actor,
            "Bon mot de passe après le verrouillage : toujours refusé",
            async () => {
                await login(actor, account);
                await pause(actor, 2500);
                await expect(actor.page, "le compte doit rester verrouillé").toHaveURL(/\/login/);
            },
            { refusAttendu: true },
        );
    } finally {
        await actor.close();
    }
});

test("09 · perte de connexion en pleine saisie", async ({ browser }) => {
    const prof = await openActor(browser, { etape: ETAPE, scenario: "09-perte-de-connexion", name: "prof-francais", label: "Enseignante de français" });
    try {
        await step(prof, "Connexion", async () => loginToDashboard(prof, etat.account("prof-francais")), { critical: true });
        await step(prof, "Saisie de notes ouverte", async () => {
            await goto(prof, "/dashboard/grades/entry");
        });
        await step(
            prof,
            "Réseau coupé : navigation",
            async () => {
                await prof.context.setOffline(true);
                await prof.page.getByRole("link").filter({ hasText: /accueil|tableau de bord/i }).first().click().catch(() => undefined);
                await pause(prof, 4000);
            },
            { refusAttendu: true },
        );
        await step(prof, "Réseau rétabli", async () => {
            await prof.context.setOffline(false);
            await pause(prof, 1500);
            await goto(prof, "/dashboard");
            await scrollThrough(prof);
        });
    } finally {
        await prof.close();
    }
});

test("10 · établissement suspendu par la plateforme puis réactivé", async ({ browser }) => {
    const root = await openActor(browser, { etape: ETAPE, scenario: "10-etablissement-suspendu", name: "super-admin", label: "Super-admin" });
    const admin = await openActor(browser, { etape: ETAPE, scenario: "10-etablissement-suspendu", name: "admin-rosee", label: "Direction La Rosée" });
    const setStatus = async (status: RegExp) => {
        await goto(root, "/dashboard/root-control/schools");
        const row = root.page.locator("tbody tr").filter({ has: root.page.getByText("École Primaire Catholique La Rosée", { exact: true }) });
        await row.getByRole("button", { name: /ajuster les quotas/i }).click();
        const d = root.page.getByRole("dialog", { name: /ajuster les quotas/i });
        await pickOption(root, d.getByRole("combobox", { name: /statut de l'établissement/i }), status);
        await d.getByRole("button", { name: /enregistrer les modifications/i }).click();
        await expect(d).toBeHidden({ timeout: 20_000 });
        await pause(root, 1500);
    };
    try {
        await step(root, "Connexion", async () => loginToDashboard(root, etat.account("root")), { critical: true });
        await step(root, "Statut « suspendu » pour La Rosée", async () => setStatus(/suspendu|bloqué|inactif/i));
        await step(
            admin,
            "La direction de La Rosée tente de se connecter",
            async () => {
                await login(admin, etat.account("admin-rosee"));
                await pause(admin, 3000);
                const path = new URL(admin.page.url()).pathname;
                expect(path.startsWith("/dashboard"), "un établissement suspendu ne doit plus accéder au tableau de bord").toBe(false);
            },
            { refusAttendu: true },
        );
        await step(root, "Réactivation de La Rosée", async () => setStatus(/^actif/i));
        await step(admin, "Connexion de nouveau possible", async () => {
            await loginToDashboard(admin, etat.account("admin-rosee"));
            await scrollThrough(admin);
        });
    } finally {
        await admin.close();
        await root.close();
    }
});
