/**
 * Étape 12 — Parcours complet par rôle, une fois l'année bien remplie :
 * chaque rôle ouvre chaque entrée de son menu (groupes dépliés), chaque page
 * est parcourue (défilement, onglets), puis les éléments communs du bandeau :
 * recherche Ctrl+K, notifications, menu du compte.
 */
import { test } from "@playwright/test";
import { etat, explorePage, goto, loginToDashboard, openActor, pause, scrollThrough, step, type Actor } from "./kit";

const ETAPE = "12-parcours-complet-par-role";

const ROLES: { key: string; label: string; scenario: string }[] = [
    { key: "root", label: "Super-admin plateforme", scenario: "01-super-admin" },
    { key: "admin-cocotiers", label: "Direction Les Cocotiers (administrateur + chef d'organisation)", scenario: "02-administrateur-chef-organisation" },
    { key: "directeur-cocotiers", label: "Directrice des études", scenario: "03-directeur" },
    { key: "comptable-cocotiers", label: "Comptable", scenario: "04-comptable" },
    { key: "prof-maths", label: "Enseignant de mathématiques (collège-lycée)", scenario: "05-enseignant-secondaire" },
    { key: "instit-cm2", label: "Instituteur de CM2 (primaire)", scenario: "06-enseignant-primaire" },
    { key: "eleve-kate", label: "Élève de 6ème A", scenario: "07-eleve-college" },
    { key: "eleve-gloria", label: "Élève de Terminale D", scenario: "08-eleve-lycee" },
    { key: "parent-zinsou", label: "Parent de deux enfants sur deux sites", scenario: "09-parent-deux-sites" },
    { key: "admin-cocotiers-primaire", label: "Direction de l'annexe primaire", scenario: "10-direction-primaire" },
    { key: "admin-lycee", label: "Direction du lycée technique public", scenario: "11-direction-lycee-technique" },
];

async function navLinks(actor: Actor): Promise<string[]> {
    const page = actor.page;
    await goto(actor, "/dashboard");
    await pause(actor, 2000);
    // Dépliage des groupes du menu.
    const collapsed = page.locator('nav [aria-expanded="false"]');
    for (let i = 0; i < 20 && (await collapsed.count()) > 0; i++) await collapsed.first().click().catch(() => undefined);
    const hrefs = await page.$$eval('nav a[href^="/dashboard"]', (els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? ""));
    return [...new Set(hrefs.map((h) => h.split("?")[0].split("#")[0]).filter(Boolean))];
}

for (const role of ROLES) {
    test(`${role.scenario} · ${role.label}`, async ({ browser }) => {
        const actor = await openActor(browser, { etape: ETAPE, scenario: role.scenario, name: role.key, label: role.label });
        try {
            await step(actor, "Connexion", async () => loginToDashboard(actor, etat.account(role.key)), { critical: true });
            await step(actor, "Accueil", async () => {
                await goto(actor, "/dashboard");
                await pause(actor, 1500);
                await scrollThrough(actor);
            });
            let links: string[] = [];
            await step(actor, "Menu latéral : tous les groupes dépliés", async () => {
                links = await navLinks(actor);
                await pause(actor, 2000);
            });
            for (const href of links) {
                await step(actor, `Menu → ${href.replace("/dashboard", "") || "/"}`, async () => explorePage(actor, href));
            }
            await step(actor, "Recherche rapide (Ctrl+K)", async () => {
                await goto(actor, "/dashboard");
                await actor.page.keyboard.press("Control+k");
                await pause(actor, 1000);
                await actor.page.keyboard.type("not", { delay: 120 });
                await pause(actor, 2000);
                await actor.page.keyboard.press("Escape");
            });
            await step(actor, "Bandeau : centre de notifications", async () => {
                await goto(actor, "/dashboard");
                await actor.page.locator("header").getByRole("link", { name: /^notifications$/i }).click();
                await actor.page.waitForURL(/\/dashboard\/notifications/);
                await scrollThrough(actor);
            });
            await step(actor, "Bandeau : thème sombre puis clair", async () => {
                await actor.page.locator("header").getByRole("button", { name: /passer en mode sombre/i }).click();
                await pause(actor, 1500);
                await actor.page.locator("header").getByRole("button", { name: /passer en mode clair/i }).click();
            });
            await step(actor, "Bandeau : accès au profil du compte", async () => {
                await actor.page.locator("header").getByRole("link").last().click();
                await pause(actor, 2000);
                await scrollThrough(actor);
            });
        } finally {
            await actor.close();
        }
    });
}
