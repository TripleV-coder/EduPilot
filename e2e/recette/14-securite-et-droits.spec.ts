/**
 * Étape 14 — Sécurité et droits d'accès, en conditions réelles :
 * chaque rôle tente d'ouvrir toutes les pages du tableau de bord (ce qui est
 * refusé, affiché ou redirigé est journalisé page par page), puis des accès
 * croisés interdits : fiche d'un élève d'une autre école, d'un autre enfant,
 * d'un camarade ; appels directs aux API sans droit ; visiteur non connecté.
 */
import { expect, test } from "@playwright/test";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { constat, etat, goto, loginToDashboard, openActor, pause, step, type Actor } from "./kit";

const ETAPE = "14-securite-et-droits";

/** Toutes les pages statiques du tableau de bord, lues dans le code. */
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
            walk(full, `${prefix || "/dashboard"}${name.startsWith("(") ? "" : `/${name}`}`);
        }
    };
    walk(root, "");
    return [...new Set(routes)].sort();
}

const ROLES = [
    { key: "root", label: "Super-admin", scenario: "01-toutes-les-pages-super-admin" },
    { key: "admin-cocotiers", label: "Administrateur d'établissement", scenario: "02-toutes-les-pages-administrateur" },
    { key: "directeur-cocotiers", label: "Directrice des études", scenario: "03-toutes-les-pages-directeur" },
    { key: "comptable-cocotiers", label: "Comptable", scenario: "04-toutes-les-pages-comptable" },
    { key: "prof-maths", label: "Enseignant", scenario: "05-toutes-les-pages-enseignant" },
    { key: "eleve-kate", label: "Élève", scenario: "06-toutes-les-pages-eleve" },
    { key: "parent-agbossou", label: "Parent", scenario: "07-toutes-les-pages-parent" },
];

async function sweep(actor: Actor, routes: string[]) {
    const page = actor.page;
    for (const route of routes) {
        await actor.caption(route);
        let status = 0;
        try {
            status = (await page.goto(route, { waitUntil: "domcontentloaded", timeout: 45_000 }))?.status() ?? 0;
        } catch (error) {
            constat(actor, `Droits ${route}`, `navigation impossible : ${(error as Error).message.split("\n")[0]}`);
            continue;
        }
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => undefined);
        await page.waitForTimeout(600);
        const final = new URL(page.url()).pathname;
        const body = await page.locator("main").first().innerText().catch(() => "");
        const verdict = /accès refusé|non autorisé|vous n'avez pas accès|accès restreint/i.test(body)
            ? "refusé"
            : final !== route
              ? `redirigé vers ${final}`
              : /module désactivé|n'est pas activé/i.test(body)
                ? "module désactivé"
                : status >= 400
                  ? `HTTP ${status}`
                  : "accessible";
        constat(actor, `Droits ${route}`, verdict);
    }
}

for (const role of ROLES) {
    test(`${role.scenario} · ${role.label} : toutes les pages`, async ({ browser }) => {
        const actor = await openActor(browser, { etape: ETAPE, scenario: role.scenario, name: role.key, label: role.label });
        try {
            await step(actor, "Connexion", async () => loginToDashboard(actor, etat.account(role.key)), { critical: true });
            await step(actor, "Tentative d'ouverture de chaque page du tableau de bord", async () => sweep(actor, dashboardRoutes()), { refusAttendu: true });
        } finally {
            await actor.close();
        }
    });
}

test("08 · accès croisés interdits et appels d'API sans droit", async ({ browser }) => {
    const cases: { key: string; label: string; titre: string; url: () => string }[] = [
        { key: "prof-maths", label: "Enseignant des Cocotiers", titre: "Fiche d'un élève d'une autre école (La Rosée)", url: () => etat.get("url:eleve-rosee") },
        { key: "parent-agbossou", label: "Parent Agbossou", titre: "Fiche d'un enfant qui n'est pas le sien (Divine Zinsou)", url: () => etat.get("url:eleve-divine") },
        { key: "eleve-kate", label: "Élève Kate", titre: "Fiche d'un camarade (Ismaël)", url: () => etat.get("url:eleve-ismael") },
        { key: "admin-rosee", label: "Direction La Rosée", titre: "Fiche d'une classe d'une autre école (6ème A des Cocotiers)", url: () => etat.get("url:classe:cocotiers:6ème A") },
        { key: "admin-cocotiers-primaire", label: "Direction de l'annexe", titre: "Fiche d'un élève du site principal (Kate)", url: () => etat.get("url:eleve-kate") },
    ];
    for (const c of cases) {
        const actor = await openActor(browser, { etape: ETAPE, scenario: "08-acces-croises-interdits", name: c.key, label: c.label });
        try {
            await step(actor, "Connexion", async () => loginToDashboard(actor, etat.account(c.key)), { critical: true });
            await step(
                actor,
                c.titre,
                async () => {
                    await goto(actor, c.url());
                    await pause(actor, 2500);
                    const body = await actor.page.locator("main").first().innerText().catch(() => "");
                    const leaked = /matricule|date de naissance|responsable|moyenne/i.test(body) && !/accès refusé|introuvable|non autorisé|n'existe pas/i.test(body);
                    expect(leaked, "aucune donnée hors du périmètre du compte ne doit s'afficher").toBe(false);
                },
                { refusAttendu: true },
            );
            await step(
                actor,
                "Appel direct à l'API de la même fiche",
                async () => {
                    const id = c.url().split("/").pop();
                    const api = c.url().includes("/classes/") ? `/api/classes/${id}` : `/api/students/${id}`;
                    const status = await actor.page.evaluate(async (u) => (await fetch(u)).status, api);
                    constat(actor, `API ${api}`, `HTTP ${status}`);
                    expect([401, 403, 404]).toContain(status);
                },
                { refusAttendu: true },
            );
        } finally {
            await actor.close();
        }
    }

    const eleve = await openActor(browser, { etape: ETAPE, scenario: "08-acces-croises-interdits", name: "eleve-kate-api", label: "Élève Kate (API)" });
    try {
        await step(eleve, "Connexion", async () => loginToDashboard(eleve, etat.account("eleve-kate")), { critical: true });
        for (const api of ["/api/users", "/api/finance/stats", "/api/admin/system/info", "/api/root/schools", "/api/audit-logs"]) {
            await step(
                eleve,
                `Appel interdit : GET ${api}`,
                async () => {
                    const status = await eleve.page.evaluate(async (u) => (await fetch(u)).status, api);
                    constat(eleve, `API ${api}`, `HTTP ${status}`);
                    expect([400, 401, 403, 404]).toContain(status);
                },
                { refusAttendu: true },
            );
        }
    } finally {
        await eleve.close();
    }

    const visiteur = await openActor(browser, { etape: ETAPE, scenario: "09-visiteur-non-connecte", name: "visiteur", label: "Visiteur non connecté" });
    try {
        for (const route of ["/dashboard", "/dashboard/students", "/dashboard/finance", "/dashboard/root-control"]) {
            await step(visiteur, `Page protégée ${route} : renvoi à la connexion`, async () => {
                await goto(visiteur, route);
                await expect(visiteur.page).toHaveURL(/\/login/);
            });
        }
        await step(visiteur, "Page de connexion", async () => {
            await goto(visiteur, "/login");
        });
        for (const api of ["/api/students", "/api/grades?studentId=x", "/api/users", "/api/finance/stats"]) {
            await step(
                visiteur,
                `API sans session : GET ${api}`,
                async () => {
                    const status = await visiteur.page.evaluate(async (u) => (await fetch(u)).status, api);
                    constat(visiteur, `API ${api}`, `HTTP ${status}`);
                    expect([401, 403]).toContain(status);
                },
                { refusAttendu: true },
            );
        }
    } finally {
        await visiteur.close();
    }
});
