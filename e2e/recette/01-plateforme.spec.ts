/**
 * Étape 01 — Plateforme (super-administrateur) : formules et tarifs publiés,
 * déploiement des établissements dans toutes les configurations (organisation
 * multi-sites, annexe, public / privé / confessionnel / international,
 * primaire / collège / lycée / mixte), erreurs de saisie, liste des tenants,
 * premières connexions des directions, tous les écrans de la console root.
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
import { ECOLES, mail, type Ecole } from "./donnees";

const ETAPE = "01-plateforme-super-admin";

const FORMULES = [
    {
        nom: "Essentiel",
        code: "ESSENTIEL",
        description: "Pour les petites écoles primaires",
        eleves: "300",
        enseignants: "20",
        go: "5",
        mensuel: "25000",
        annuel: "250000",
        fonctions: "Notes et bulletins, Présences, Messagerie parents",
        devis: false,
        avant: false,
        enVente: true,
    },
    {
        nom: "Professionnel",
        code: "PRO",
        description: "Collèges et lycées : finances, SMS, paiement mobile",
        eleves: "1500",
        enseignants: "120",
        go: "50",
        mensuel: "75000",
        annuel: "750000",
        fonctions: "Bulletins PDF, SMS parents, Paiement MoMo, Comptabilité SYSCOHADA",
        devis: false,
        avant: true,
        enVente: true,
    },
    {
        nom: "Réseau",
        code: "RESEAU",
        description: "Organisations multi-sites avec cockpit transverse",
        eleves: "10000",
        enseignants: "800",
        go: "500",
        mensuel: "",
        annuel: "",
        fonctions: "Multi-sites, Cockpit réseau, API, Accompagnement dédié",
        devis: true,
        avant: false,
        enVente: true,
    },
    {
        nom: "Pilote 2025",
        code: "PILOTE25",
        description: "Ancienne formule d'essai, retirée de la vente",
        eleves: "100",
        enseignants: "10",
        go: "2",
        mensuel: "0",
        annuel: "0",
        fonctions: "Essai",
        devis: false,
        avant: false,
        enVente: false,
    },
];

async function rootActor(browser: Browser, scenario: string): Promise<Actor> {
    const root = await openActor(browser, { etape: ETAPE, scenario, name: "super-admin", label: "Super-admin" });
    await step(root, "Connexion du super-administrateur", async () => loginToDashboard(root, etat.account("root")), { critical: true });
    return root;
}

test("01 · formules et tarifs : création, modification, retrait de la vente, page publique", async ({ browser }) => {
    const root = await rootActor(browser, "01-formules-et-tarifs");
    try {
        await step(root, "Plans & tarifs : catalogue vide", async () => {
            await goto(root, "/dashboard/root-control/plans");
            await scrollThrough(root);
        });
        for (const f of FORMULES) {
            await step(root, `Créer la formule « ${f.nom} »${f.devis ? " (prix sur devis)" : ""}${f.enVente ? "" : " (hors vente)"}`, async () => {
                await root.page.getByRole("button", { name: /^créer une formule$/i }).first().click();
                const d = root.page.getByRole("dialog", { name: /nouvelle formule/i });
                await d.getByLabel("Nom", { exact: true }).fill(f.nom);
                await d.getByLabel("Code technique").fill(f.code);
                await d.getByLabel("Description courte").fill(f.description);
                await d.getByLabel("Élèves", { exact: true }).fill(f.eleves);
                await d.getByLabel("Enseignants", { exact: true }).fill(f.enseignants);
                await d.getByLabel("Go", { exact: true }).fill(f.go);
                if (f.devis) await d.getByRole("switch", { name: /prix sur devis/i }).click();
                else {
                    await d.getByLabel("Prix mensuel (FCFA)").fill(f.mensuel);
                    await d.getByLabel("Prix annuel (FCFA)").fill(f.annuel);
                }
                await d.getByLabel(/fonctionnalités/i).fill(f.fonctions);
                if (!f.enVente) await d.getByRole("switch", { name: /en vente/i }).click();
                if (f.avant) await d.getByRole("switch", { name: /mettre en avant/i }).click();
                await pause(root, 800);
                await d.getByRole("button", { name: /^enregistrer$/i }).click();
                await expect(d).toBeHidden({ timeout: 20_000 });
                await expect(root.page.getByText(f.nom).first()).toBeVisible();
            });
        }
        await step(
            root,
            "Formule en double (même code) : refus",
            async () => {
                await root.page.getByRole("button", { name: /^créer une formule$/i }).first().click();
                const d = root.page.getByRole("dialog", { name: /nouvelle formule/i });
                await d.getByLabel("Nom", { exact: true }).fill("Professionnel bis");
                await d.getByLabel("Code technique").fill("PRO");
                await d.getByLabel("Prix mensuel (FCFA)").fill("1000");
                await d.getByRole("button", { name: /^enregistrer$/i }).click();
                await pause(root, 2500);
                const stillOpen = await d.isVisible().catch(() => false);
                if (stillOpen) await d.getByRole("button", { name: /annuler/i }).click();
                expect(stillOpen, "une deuxième formule « PRO » ne doit pas être acceptée").toBe(true);
            },
            { refusAttendu: true },
        );
        await step(root, "Recherche d'une formule", async () => {
            await root.page.getByLabel("Rechercher une formule").fill("SMS");
            await pause(root, 1500);
            await root.page.getByRole("button", { name: /réinitialiser/i }).click();
            await pause(root, 800);
        });
        await step(root, "Modifier la formule « Essentiel » (prix annuel)", async () => {
            const edit = root.page.getByRole("button", { name: /modifier.*essentiel|essentiel.*modifier/i });
            if (await edit.count()) await edit.first().click();
            else {
                const card = root.page.locator("article, section, li, div").filter({ has: root.page.getByText("Essentiel", { exact: true }) }).filter({ has: root.page.getByRole("button") }).last();
                await card.getByRole("button", { name: /modifier|éditer/i }).first().click();
            }
            const d = root.page.getByRole("dialog");
            await d.getByLabel("Prix annuel (FCFA)").fill("240000");
            await d.getByRole("button", { name: /^enregistrer$/i }).click();
            await expect(d).toBeHidden({ timeout: 20_000 });
        });
        await step(root, "Page tarifs publique : formules en vente affichées", async () => {
            // Le lien ouvre un nouvel onglet : la page est ouverte dans l'onglet filmé.
            const link = root.page.getByRole("link", { name: /voir la page tarifs/i });
            await expect(link).toHaveAttribute("href", "/#pricing");
            await goto(root, "/#pricing");
            await root.page.locator("#pricing").scrollIntoViewIfNeeded();
            await pause(root, 2500);
            await expect(root.page.getByText("Professionnel").first()).toBeVisible();
            await expect(root.page.getByText("Pilote 2025"), "une formule hors vente ne doit pas être publiée").toHaveCount(0);
            const toggle = root.page.getByRole("switch", { name: /facturation annuelle/i });
            await toggle.click();
            await pause(root, 1500);
            await toggle.click();
            await pause(root, 1500);
        });
    } finally {
        await root.close();
    }
});

async function deploy(root: Actor, ecole: Ecole) {
    const page = root.page;
    await goto(root, "/dashboard/root-control/schools");
    await page.getByRole("button", { name: /déployer un établissement/i }).click();
    const d = page.getByRole("dialog", { name: /déploiement d'établissement/i });
    await d.getByLabel("Nom de l'établissement").fill(ecole.name);
    await pickOption(root, d.getByRole("combobox", { name: /^type$/i }), ecole.type);
    await pickOption(root, d.getByRole("combobox", { name: /niveau principal/i }), ecole.niveau);
    if (ecole.annexeDe) {
        await pickOption(root, d.getByRole("combobox", { name: /structure multi-site/i }), new RegExp(ecole.annexeDe.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    if (ecole.organisation?.mode === "nouvelle") {
        await pickOption(root, d.getByRole("combobox", { name: /mode organisation/i }), /créer une nouvelle organisation/i);
        await d.getByLabel("Nom de l'organisation").fill(ecole.organisation.name);
        await d.getByLabel("Description").fill(ecole.organisation.description);
    } else if (ecole.organisation?.mode === "existante") {
        const mode = d.getByRole("combobox", { name: /mode organisation/i });
        if (await mode.isEnabled().catch(() => false)) {
            const current = await mode.innerText();
            if (!new RegExp(ecole.organisation.name, "i").test(current)) {
                await pickOption(root, mode, /rattacher à une organisation existante/i);
                const orga = d.getByRole("combobox", { name: /^organisation/i });
                if (await orga.isVisible().catch(() => false)) await pickOption(root, orga, new RegExp(ecole.organisation.name, "i"));
            }
        }
    }
    await d.getByLabel("Ville").fill(ecole.city);
    await d.getByLabel("Téléphone").fill(ecole.phone);
    await d.getByLabel("Adresse physique").fill(ecole.address);
    await d.getByLabel("Email institutionnel").fill(ecole.email);
    await pause(root, 900);
    await d.getByRole("button", { name: /étape suivante/i }).click();
    await d.getByLabel("Prénom").fill(ecole.admin.firstName);
    await d.getByLabel("Nom de famille").fill(ecole.admin.lastName);
    await d.getByLabel("Email de connexion").fill(mail(ecole.admin.key));
    await pause(root, 900);
    await d.getByRole("button", { name: /finaliser le déploiement/i }).click();
    const credentials = page.getByRole("dialog", { name: /identifiants de l'administrateur/i });
    await expect(credentials).toBeVisible({ timeout: 45_000 });
    await pause(root, 2500);
    const provisional = (await credentials.locator(".select-all").first().innerText()).trim();
    expect(provisional).toMatch(/\S{8,}/);
    etat.setAccount(ecole.admin.key, {
        email: mail(ecole.admin.key),
        password: provisional,
        role: "SCHOOL_ADMIN",
        name: `${ecole.admin.firstName} ${ecole.admin.lastName}`,
    });
    await credentials.getByRole("button").last().click();
    await pause(root, 1200);
}

test("02 · déploiement des établissements dans chaque configuration", async ({ browser }) => {
    const root = await rootActor(browser, "02-deploiement-des-etablissements");
    try {
        await step(root, "Établissements : liste vide", async () => {
            await goto(root, "/dashboard/root-control/schools");
            await scrollThrough(root);
        });
        await step(
            root,
            "Déploiement incomplet (sans nom ni administrateur) : refus",
            async () => {
                await root.page.getByRole("button", { name: /déployer un établissement/i }).click();
                const d = root.page.getByRole("dialog", { name: /déploiement d'établissement/i });
                await d.getByRole("button", { name: /étape suivante/i }).click();
                await pause(root, 1200);
                await d.getByRole("tab", { name: /admin principal/i }).click();
                const finish = d.getByRole("button", { name: /finaliser le déploiement/i });
                if (await finish.isVisible().catch(() => false)) await finish.click();
                await pause(root, 2000);
                await expect(root.page.getByRole("dialog", { name: /identifiants de l'administrateur/i })).toHaveCount(0);
                await d.getByRole("button", { name: /annuler/i }).click();
            },
            { refusAttendu: true },
        );
        for (const ecole of ECOLES) {
            const detail = [
                ecole.type,
                ecole.niveau,
                ecole.organisation ? `organisation ${ecole.organisation.name}` : "indépendant",
                ecole.annexeDe ? `annexe de ${ecole.annexeDe}` : "",
            ]
                .filter(Boolean)
                .join(" · ");
            await step(root, `Déployer « ${ecole.name} » (${detail})`, async () => deploy(root, ecole));
        }
        await step(
            root,
            "Même adresse d'administrateur pour un nouvel établissement : refus",
            async () => {
                await goto(root, "/dashboard/root-control/schools");
                await root.page.getByRole("button", { name: /déployer un établissement/i }).click();
                const d = root.page.getByRole("dialog", { name: /déploiement d'établissement/i });
                await d.getByLabel("Nom de l'établissement").fill("École Doublon");
                await d.getByLabel("Ville").fill("Bohicon");
                await d.getByRole("button", { name: /étape suivante/i }).click();
                await d.getByLabel("Prénom").fill("Doublon");
                await d.getByLabel("Nom de famille").fill("Test");
                await d.getByLabel("Email de connexion").fill(mail(ECOLES[0].admin.key));
                await d.getByRole("button", { name: /finaliser le déploiement/i }).click();
                await pause(root, 3000);
                await expect(root.page.getByRole("dialog", { name: /identifiants de l'administrateur/i })).toHaveCount(0);
                if (await d.isVisible().catch(() => false)) await d.getByRole("button", { name: /annuler/i }).click();
            },
            { refusAttendu: true },
        );
        await step(root, "Liste des établissements déployés", async () => {
            await goto(root, "/dashboard/root-control/schools");
            for (const ecole of ECOLES) await expect(root.page.getByText(ecole.name).first()).toBeVisible();
            await scrollThrough(root);
        });
        await step(root, "Recherche par ville puis par organisation", async () => {
            const search = root.page.getByLabel("Rechercher un établissement");
            await search.fill("Parakou");
            await pause(root, 1500);
            await search.fill("Cocotiers");
            await pause(root, 1500);
            await search.fill("");
            await pause(root, 800);
        });
        await step(root, "Cartographie des établissements", async () => {
            await root.page.getByRole("link", { name: /voir cartographie/i }).click();
            await root.page.waitForLoadState("networkidle").catch(() => undefined);
            await pause(root, 2000);
            await scrollThrough(root);
        });
        await step(root, "Annuaire public : les établissements apparaissent", async () => {
            await goto(root, "/ecoles");
            await pause(root, 1500);
            await scrollThrough(root);
            await goto(root, "/explorer");
            await pause(root, 1500);
            await scrollThrough(root);
        });
    } finally {
        await root.close();
    }
});

test("03 · formules attribuées aux établissements (quotas), statut", async ({ browser }) => {
    const root = await rootActor(browser, "03-attribution-des-formules");
    try {
        for (const ecole of ECOLES) {
            await step(root, `« ${ecole.name} » : formule ${ecole.formule}`, async () => {
                await goto(root, "/dashboard/root-control/schools");
                // Nom exact : la ligne de l'annexe cite aussi le site principal.
                const row = root.page.locator("tbody tr").filter({ has: root.page.getByText(ecole.name, { exact: true }) });
                await row.getByRole("button", { name: /ajuster les quotas/i }).click();
                const d = root.page.getByRole("dialog", { name: /ajuster les quotas/i });
                await pause(root, 1000);
                await pickOption(root, d.getByRole("combobox", { name: /plan de souscription/i }), new RegExp(ecole.formule, "i"));
                await pause(root, 800);
                await d.getByRole("button", { name: /enregistrer les modifications/i }).click();
                await expect(d).toBeHidden({ timeout: 20_000 });
                await pause(root, 1200);
            });
        }
        await step(root, "Liste des établissements avec leur formule", async () => {
            await goto(root, "/dashboard/root-control/schools");
            await scrollThrough(root);
        });
        await step(root, "Finances de la plateforme après attribution", async () => explorePage(root, "/dashboard/root-control/finance"));
    } finally {
        await root.close();
    }
});

test("04 · premières connexions des directions (mot de passe provisoire)", async ({ browser }) => {
    for (const ecole of ECOLES) {
        const admin = await openActor(browser, {
            etape: ETAPE,
            scenario: "04-premieres-connexions-directions",
            name: ecole.admin.key,
            label: `Direction ${ecole.name}`,
        });
        try {
            const account = etat.account(ecole.admin.key);
            await step(
                admin,
                "Mot de passe provisoire : changement imposé, consentement",
                async () => {
                    const chosen = `Recette!2026-${ecole.admin.key}`;
                    await firstLogin(admin, account.email, account.password, chosen);
                    etat.setAccount(ecole.admin.key, { ...account, password: chosen });
                },
                { critical: true },
            );
            await step(admin, "Accueil de la direction d'un établissement vide", async () => {
                await goto(admin, "/dashboard");
                await pause(admin, 1500);
                await scrollThrough(admin);
            });
        } finally {
            await admin.close();
        }
    }
});

test("05 · console root : chaque écran de pilotage", async ({ browser }) => {
    const root = await rootActor(browser, "05-console-root-tous-les-ecrans");
    try {
        for (const [route, titre] of [
            ["/dashboard", "Accueil réseau"],
            ["/dashboard/root-control", "Console d'infrastructure"],
            ["/dashboard/root-control/schools", "Établissements"],
            ["/dashboard/root-control/users", "Utilisateurs de la plateforme"],
            ["/dashboard/root-control/plans", "Plans & tarifs"],
            ["/dashboard/root-control/finance", "Finances de la plateforme"],
            ["/dashboard/root-control/analytics", "Analyses"],
            ["/dashboard/root-control/ux-analytics", "Analytics produit (rétention)"],
            ["/dashboard/root-control/curriculum", "Programmes officiels"],
            ["/dashboard/root-control/reforms", "Réformes"],
            ["/dashboard/root-control/monitoring", "Supervision"],
            ["/dashboard/root-control/logs", "Journaux"],
            ["/dashboard/root-control/data-requests", "Demandes RGPD"],
            ["/dashboard/root-control/system-map", "Cartographie système"],
            ["/dashboard/root-control/maintenance", "Maintenance"],
            ["/dashboard/schools", "Écoles"],
            ["/dashboard/organization", "Organisation"],
            ["/dashboard/system/info", "Informations système"],
            ["/dashboard/system/monitoring", "Supervision système"],
            ["/dashboard/system/backup", "Sauvegardes"],
            ["/dashboard/system/retention", "Rétention des données"],
            ["/dashboard/audit-logs", "Journal d'audit"],
            ["/dashboard/admin", "Administration"],
            ["/dashboard/admin/logs", "Journaux d'administration"],
            ["/dashboard/admin/security", "Sécurité"],
            ["/dashboard/admin/rgpd", "RGPD"],
            ["/dashboard/benchmark", "Comparatif des établissements"],
        ] as const) {
            await step(root, titre, async () => explorePage(root, route));
        }
    } finally {
        await root.close();
    }
});
