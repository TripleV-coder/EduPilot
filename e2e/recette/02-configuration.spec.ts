/**
 * Étape 02 — Configuration de chaque établissement par sa direction :
 * identité et vitrine publique, cycles offerts, modules, calendrier (années,
 * périodes, découpage, seuils du conseil), catégories, matières et
 * coefficients, types d'évaluation, niveaux, séries, salles, options,
 * rôles et conformité — puis les paramètres personnels de la direction
 * (profil, notifications, apparence, langue, données personnelles).
 */
import { expect, test, type Browser } from "@playwright/test";
import {
    etat,
    explorePage,
    goto,
    loginToDashboard,
    openActor,
    pause,
    scrollThrough,
    step,
    type Actor,
} from "./kit";
import { ANNEE_SUIVANTE, CONFIGS, ECOLES, type Config, type Ecole } from "./donnees";

const ETAPE = "02-configuration-etablissements";

async function direction(browser: Browser, ecole: Ecole, scenario: string): Promise<Actor> {
    const admin = await openActor(browser, { etape: ETAPE, scenario, name: ecole.admin.key, label: `Direction ${ecole.name}` });
    await step(admin, "Connexion de la direction", async () => loginToDashboard(admin, etat.account(ecole.admin.key)), { critical: true });
    return admin;
}

const CYCLE_BUTTON: Record<string, RegExp> = {
    Primaire: /^Primaire Examen/i,
    Collège: /^Collège \(premier cycle\)/i,
    Lycée: /^Lycée \(second cycle\)/i,
};

async function configure(admin: Actor, ecole: Ecole, cfg: Config) {
    const page = admin.page;

    await step(admin, "Identité, couleur et vitrine publique", async () => {
        await goto(admin, "/dashboard/settings/school");
        await page.getByLabel("Devise / slogan").fill(cfg.devise);
        await page.getByLabel("Code MEMP").fill(cfg.codeMemp);
        await page.getByLabel("Domaine email").fill(ecole.email.split("@")[1]);
        await page.getByRole("button", { name: `Choisir la couleur ${cfg.couleur}` }).click();
        await pause(admin, 1200);
        const publish = page.getByRole("checkbox", { name: /publier la fiche publique/i });
        if (!(await publish.isChecked())) await publish.check();
        await page.getByLabel("Région / département").fill(cfg.region);
        await page.getByLabel("Téléphone public").fill(ecole.phone);
        await page.getByLabel("Présentation publique").fill(`${ecole.name} — ${cfg.devise}. Établissement ${ecole.type.toLowerCase()} situé à ${ecole.city}.`);
        await scrollThrough(admin);
        // Enregistrement automatique : le bouton n'est actif que s'il reste une modification en attente.
        const save = page.getByRole("button", { name: /enregistrer maintenant/i });
        // L'enregistrement automatique peut passer avant le clic : le bouton redevient alors inactif.
        await save.click({ timeout: 3000 }).catch(() => undefined);
        await expect(save, "plus aucune modification en attente").toBeDisabled({ timeout: 20_000 });
        await pause(admin, 1500);
        await page.reload();
        await page.waitForLoadState("networkidle").catch(() => undefined);
        await expect(page.getByLabel("Code MEMP")).toHaveValue(cfg.codeMemp);
    });

    await step(admin, `Cycles offerts : ${cfg.cycles.join(" + ")}`, async () => {
        await goto(admin, "/dashboard/settings/cycles");
        for (const cycle of cfg.cycles) {
            const button = page.getByRole("button", { name: CYCLE_BUTTON[cycle] });
            if (/Non offert/i.test(await button.innerText())) await button.click();
            await pause(admin, 700);
        }
        await page.getByRole("button", { name: /^enregistrer$/i }).click();
        await pause(admin, 2000);
        await page.reload();
        await page.waitForLoadState("networkidle").catch(() => undefined);
        for (const cycle of cfg.cycles) await expect(page.getByRole("button", { name: CYCLE_BUTTON[cycle] })).not.toContainText(/Non offert/i);
    });

    await step(admin, cfg.modules === "tous" ? "Modules : tout le catalogue activé" : `Modules activés : ${cfg.modules.join(", ")}`, async () => {
        await goto(admin, "/dashboard/settings/modules");
        // La liste arrive après le chargement : attendre le compteur « n/m module(s) ».
        await expect(page.getByText(/module\(s\)/)).toBeVisible();
        const labels = await page.locator("main").getByRole("button").filter({ hasText: /Désactivé\s*$/ }).allInnerTexts();
        const escape = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        for (const label of labels) {
            const wanted = cfg.modules === "tous" || cfg.modules.some((m) => label.startsWith(m));
            if (!wanted) continue;
            const title = label.split("\n")[0].trim();
            // Texte de la carte = « <titre> <description> <état> » : correspondance sur le début.
            await page.locator("main").getByRole("button").filter({ hasText: new RegExp(`^\\s*${escape(title)}`) }).first().click();
            await pause(admin, 500);
        }
        await scrollThrough(admin);
        const save = page.getByRole("button", { name: /^enregistrer$/i });
        await save.scrollIntoViewIfNeeded();
        if (await save.isEnabled()) {
            await save.click();
            await expect(page.getByText(/modules enregistrés/i)).toBeVisible();
        }
        await pause(admin, 2000);
        await page.reload();
        await page.waitForLoadState("networkidle").catch(() => undefined);
        await scrollThrough(admin);
    });

    await step(admin, "Menu latéral après activation des cycles et modules", async () => {
        await goto(admin, "/dashboard");
        await page.getByRole("navigation").first().hover();
        await pause(admin, 2500);
    });

    await step(admin, `Années scolaires : année en cours et création de ${ANNEE_SUIVANTE}`, async () => {
        await goto(admin, "/dashboard/settings/academic");
        await page.getByRole("button", { name: /nouvelle année/i }).click();
        await page.locator("#name").fill(ANNEE_SUIVANTE);
        await page.locator("#startDate").fill("2027-09-01");
        await page.locator("#endDate").fill("2028-06-30");
        await page.locator('form button[type="submit"]').click();
        await expect(page.getByText(/année académique créée avec succès/i).first()).toBeVisible();
        await scrollThrough(admin);
    });

    await step(admin, "Périodes : trimestres de l'année en cours, bascule sur l'année suivante", async () => {
        await goto(admin, "/dashboard/settings/periods");
        await scrollThrough(admin);
        await page.getByRole("combobox").first().click();
        await page.getByRole("option", { name: ANNEE_SUIVANTE }).click();
        await pause(admin, 1500);
        await page.getByRole("combobox").first().click();
        await page.getByRole("option", { name: /2026-2027/ }).click();
        await pause(admin, 1200);
    });

    await step(admin, "Découpage de l'année, vacances et seuils du conseil de classe", async () => {
        await goto(admin, "/dashboard/settings/academic-config");
        await scrollThrough(admin);
        await page.getByRole("spinbutton", { name: /tableau d'honneur/i }).fill("15");
        await page.getByRole("spinbutton", { name: /encouragements/i }).fill("13");
        await page.getByRole("button", { name: /enregistrer les seuils/i }).click();
        await expect(page.getByText(/seuils du conseil de classe enregistrés/i).first()).toBeVisible();
    });

    for (const c of cfg.categories) {
        await step(admin, `Catégorie de matières « ${c.name} »`, async () => {
            await goto(admin, "/dashboard/settings/subject-categories");
            await page.getByRole("button", { name: /^nouvelle catégorie$/i }).click();
            const d = page.getByRole("dialog", { name: /créer une catégorie/i });
            await d.getByLabel("Nom", { exact: true }).fill(c.name);
            await d.getByLabel("Code", { exact: true }).fill(c.code);
            await d.getByLabel("Couleur", { exact: true }).fill(c.couleur);
            await d.getByLabel("Description").fill(`Famille « ${c.name} »`);
            await d.getByRole("button", { name: /^créer$/i }).click();
            await expect(d).toBeHidden({ timeout: 20_000 });
        });
    }

    for (const m of cfg.matieres) {
        await step(admin, `Matière « ${m.name} » (${m.code}, coef. ${m.coef}, ${m.categorie})`, async () => {
            await goto(admin, "/dashboard/settings/subjects");
            await page.getByRole("button", { name: /nouvelle matière/i }).click();
            await page.getByLabel("Nom de la matière *").fill(m.name);
            await page.getByLabel(/code \(abr/i).fill(m.code);
            const category = page.getByRole("combobox", { name: /catégorie/i });
            const options = await category.locator("option").allInnerTexts();
            const match = options.find((o) => o.includes(m.categorie));
            if (match) await category.selectOption({ label: match });
            await page.getByLabel("Coef. par défaut *").fill(String(m.coef));
            await page.getByRole("button", { name: /^sauvegarder$/i }).click();
            await expect(page.getByText(/matière créée avec succès/i).first()).toBeVisible();
        });
    }

    await step(
        admin,
        "Matière en double (même code) : refus",
        async () => {
            const m = cfg.matieres[0];
            await goto(admin, "/dashboard/settings/subjects");
            await page.getByRole("button", { name: /nouvelle matière/i }).click();
            await page.getByLabel("Nom de la matière *").fill(`${m.name} bis`);
            await page.getByLabel(/code \(abr/i).fill(m.code);
            await page.getByRole("button", { name: /^sauvegarder$/i }).click();
            await pause(admin, 2500);
            await expect(page.getByText(/matière créée avec succès/i)).toHaveCount(0);
        },
        { refusAttendu: true },
    );

    for (const t of cfg.typesEvaluation) {
        await step(admin, `Type d'évaluation « ${t.name} » (poids ${t.coef}${t.max ? `, ${t.max} max par période` : ""})`, async () => {
            await goto(admin, "/dashboard/settings/evaluation-types");
            await page.getByRole("button", { name: /nouveau type/i }).click();
            const d = page.getByRole("dialog", { name: /nouveau type d'évaluation/i });
            await d.getByLabel("Nom", { exact: true }).fill(t.name);
            await d.getByLabel("Code", { exact: true }).fill(t.code);
            await d.getByLabel("Coefficient (poids)").fill(String(t.coef));
            if (t.max) await d.getByLabel(/nb max/i).fill(String(t.max));
            await d.getByRole("button", { name: /^créer$/i }).click();
            await expect(d).toBeHidden({ timeout: 20_000 });
            await expect(page.getByText(t.name).first()).toBeVisible();
        });
    }

    for (const n of cfg.niveaux) {
        await step(admin, `Niveau d'étude « ${n.name} » (${n.cycle})`, async () => {
            await goto(admin, "/dashboard/settings/class-levels");
            await page.getByRole("button", { name: /nouveau niveau/i }).click();
            await page.locator("#name").fill(n.name);
            await page.locator("#code").fill(n.code);
            await page.locator("#level").selectOption({ label: n.cycle });
            await page.locator("#sequence").fill(String(n.sequence));
            await page.locator('form button[type="submit"]').click();
            await expect(page.getByText(/niveau d'étude créé avec succès/i).first()).toBeVisible();
        });
    }

    await step(admin, "Niveaux d'étude : vue d'ensemble", async () => {
        await goto(admin, "/dashboard/settings/class-levels");
        await scrollThrough(admin);
    });

    await step(admin, "Structure cycles / niveaux / séries : ajout d'un cycle", async () => {
        await goto(admin, "/dashboard/settings/levels");
        await scrollThrough(admin);
        await page.getByRole("button", { name: /ajouter un cycle/i }).click();
        await pause(admin, 1500);
        const opened = (await page.getByRole("dialog").count()) > 0 || (await page.locator("main form").count()) > 0;
        expect(opened, "le bouton « Ajouter un cycle » doit ouvrir un formulaire").toBe(true);
    });

    for (const s of cfg.salles) {
        await step(admin, `Salle « ${s.name} » (${s.capacite} places, ${s.batiment})`, async () => {
            await goto(admin, "/dashboard/settings/rooms");
            await page.getByRole("button", { name: /^ajouter une salle$/i }).click();
            await page.getByLabel("Nom de la salle *").fill(s.name);
            await page.getByLabel("Capacité *").fill(String(s.capacite));
            await page.getByLabel("Bâtiment *").fill(s.batiment);
            await page.getByLabel(/équipements/i).fill(s.equipements);
            await page.getByRole("button", { name: /^ajouter$/i }).click();
            await pause(admin, 1500);
            await expect(page.getByText(s.name).first()).toBeVisible();
        });
    }

    await step(admin, "Salles : recherche", async () => {
        await page.getByPlaceholder(/rechercher une salle/i).fill(cfg.salles[0].batiment);
        await pause(admin, 1500);
        await page.getByPlaceholder(/rechercher une salle/i).fill("");
    });
}

for (const [index, ecole] of ECOLES.entries()) {
    test(`${String(index + 1).padStart(2, "0")} · configuration complète de « ${ecole.name} »`, async ({ browser }) => {
        const admin = await direction(browser, ecole, `${String(index + 1).padStart(2, "0")}-${ecole.key}`);
        try {
            await configure(admin, ecole, CONFIGS[ecole.key]);
        } finally {
            await admin.close();
        }
    });
}

test("06 · options de configuration, rôles & permissions, conformité (Les Cocotiers)", async ({ browser }) => {
    const ecole = ECOLES[0];
    const admin = await direction(browser, ecole, "06-options-roles-conformite");
    const page = admin.page;
    try {
        await step(
            admin,
            "Panneau « Créer une option » sur un écran de 720 px de haut : bouton « Créer » atteignable",
            async () => {
                await goto(admin, "/dashboard/settings/config-options");
                await page.getByRole("button", { name: /^nouvelle option$/i }).click();
                const d = page.getByRole("dialog", { name: /créer une option/i });
                await pause(admin, 1200);
                const ok = await d.getByRole("button", { name: /^annuler$/i }).click({ timeout: 5000 }).then(() => true, () => false);
                if (!ok) await page.keyboard.press("Escape");
                expect(ok, "les boutons du bas du panneau doivent être atteignables (défilement)").toBe(true);
            },
        );
        // La suite se fait sur un écran plus haut, pour que les options existent pour la suite du cycle.
        await page.setViewportSize({ width: 1280, height: 1080 });
        for (const o of [
            { label: "Maladie", categorie: "absence", code: "MALADIE", description: "Motif d'absence : maladie avec certificat" },
            { label: "Évènement familial", categorie: "absence", code: "FAMILLE", description: "Motif d'absence : décès, mariage, naissance" },
            { label: "Retard de transport", categorie: "retard", code: "TRANSPORT", description: "Motif de retard lié au transport" },
            { label: "Frais de dossier", categorie: "finance", code: "DOSSIER", description: "Nature de frais divers" },
        ]) {
            await step(admin, `Option « ${o.label} » (${o.categorie})`, async () => {
                await goto(admin, "/dashboard/settings/config-options");
                await page.getByRole("button", { name: /^nouvelle option$/i }).click();
                const d = page.getByRole("dialog", { name: /créer une option/i });
                await d.getByLabel("Libellé").fill(o.label);
                await d.getByLabel("Catégorie").fill(o.categorie);
                await d.getByLabel("Code").fill(o.code);
                await d.getByLabel("Description").fill(o.description);
                await d.getByRole("button", { name: /^créer$/i }).click();
                await expect(d).toBeHidden({ timeout: 20_000 });
            });
        }
        await step(admin, "Options : filtre par catégorie", async () => {
            await goto(admin, "/dashboard/settings/config-options");
            const filter = page.getByRole("combobox", { name: /catégorie/i });
            const options = await filter.locator("option").allInnerTexts();
            const absence = options.find((x) => /absence/i.test(x));
            if (absence) await filter.selectOption({ label: absence });
            await pause(admin, 1500);
            await scrollThrough(admin);
        });
        await step(admin, "Rôles & permissions : matrice de chaque rôle", async () => {
            await goto(admin, "/dashboard/settings/roles");
            const roles = page.locator("main button").filter({ hasText: /\d+\s*$/ });
            const n = await roles.count();
            for (let i = 0; i < n; i++) {
                await roles.nth(i).click();
                await pause(admin, 900);
                await scrollThrough(admin);
            }
        });
        await step(admin, "RGPD & conformité", async () => explorePage(admin, "/dashboard/settings/compliance"));
        await step(admin, "Programmes scolaires (curriculum) avant la création des classes", async () => explorePage(admin, "/dashboard/settings/curriculum"));
        await step(admin, "Matières par classe avant la création des classes", async () => explorePage(admin, "/dashboard/settings/class-subjects"));
        await step(admin, "Page d'accueil des paramètres et recherche", async () => {
            await goto(admin, "/dashboard/settings");
            await page.getByRole("searchbox", { name: /rechercher un paramètre/i }).fill("salle");
            await pause(admin, 1500);
            await page.getByRole("searchbox", { name: /rechercher un paramètre/i }).fill("");
            await scrollThrough(admin);
        });
        await step(admin, "Fiche publique de l'établissement dans l'annuaire", async () => {
            await goto(admin, "/ecoles");
            await page.getByRole("searchbox", { name: /rechercher une école/i }).fill("Cocotiers");
            await pause(admin, 1500);
            const link = page.getByRole("link", { name: /cocotiers/i }).first();
            if (await link.isVisible().catch(() => false)) {
                await link.click();
                await page.waitForLoadState("networkidle").catch(() => undefined);
            }
            await scrollThrough(admin);
        });
    } finally {
        await admin.close();
    }
});

test("07 · paramètres personnels de la direction (profil, notifications, apparence, langue, données)", async ({ browser }) => {
    const ecole = ECOLES[0];
    const admin = await direction(browser, ecole, "07-parametres-personnels");
    const page = admin.page;
    try {
        await step(admin, "Profil : téléphone ajouté, enregistrement", async () => {
            await goto(admin, "/dashboard/settings/profile");
            await page.getByLabel("Téléphone").fill("+229 97 12 34 56");
            await page.getByRole("button", { name: /enregistrer maintenant/i }).click();
            await pause(admin, 2000);
            await page.reload();
            await expect(page.getByLabel("Téléphone")).toHaveValue(/97/);
        });
        await step(admin, "Notifications : digest hebdomadaire désactivé puis réactivé", async () => {
            await goto(admin, "/dashboard/settings/notifications");
            const digest = page.getByRole("switch", { name: /digest hebdomadaire/i });
            await digest.click();
            await page.getByRole("button", { name: /enregistrer les préférences/i }).click();
            await pause(admin, 1800);
            await digest.click();
            await page.getByRole("button", { name: /enregistrer les préférences/i }).click();
            await pause(admin, 1500);
        });
        await step(admin, "Apparence : thème sombre", async () => {
            await goto(admin, "/dashboard/settings/appearance");
            await page.getByRole("button", { name: /^sombre/i }).click();
            await pause(admin, 1500);
            await goto(admin, "/dashboard");
            await pause(admin, 2000);
            await scrollThrough(admin);
        });
        await step(admin, "Apparence : mode dense puis mode focus", async () => {
            await goto(admin, "/dashboard/settings/appearance");
            await page.getByRole("button", { name: /^dense/i }).click();
            await pause(admin, 1500);
            await goto(admin, "/dashboard/settings/class-levels");
            await pause(admin, 2000);
            await goto(admin, "/dashboard/settings/appearance");
            await page.getByRole("button", { name: /^focus/i }).click();
            await pause(admin, 2000);
            await goto(admin, "/dashboard");
            await pause(admin, 2000);
        });
        await step(admin, "Apparence : retour au thème clair et au mode confort", async () => {
            await goto(admin, "/dashboard/settings/appearance");
            await page.getByRole("button", { name: /confort/i }).click();
            await page.getByRole("button", { name: /^clair/i }).click();
            await pause(admin, 1500);
            await goto(admin, "/dashboard");
            await expect(page.getByRole("button", { name: /quitter le mode focus/i }), "le mode confort doit quitter le mode focus").toHaveCount(0);
        });
        await step(admin, "Langue : interface en anglais", async () => {
            await goto(admin, "/dashboard/settings/locale");
            await page.getByRole("combobox", { name: /^langue$/i }).selectOption({ label: "English (US)" });
            await page.getByRole("button", { name: /enregistrer maintenant/i }).click();
            await pause(admin, 2000);
            await goto(admin, "/dashboard");
            await pause(admin, 2500);
            await scrollThrough(admin);
        });
        await step(admin, "Langue : format de date américain et devise euro, puis retour au français", async () => {
            await goto(admin, "/dashboard/settings/locale");
            await page.getByRole("combobox").nth(2).selectOption({ index: 1 });
            await page.getByRole("combobox").nth(3).selectOption({ index: 1 });
            await page.getByRole("button").filter({ hasText: /save|enregistrer/i }).last().click();
            await pause(admin, 1500);
            await page.getByRole("combobox").first().selectOption({ label: "Français (France)" });
            await page.getByRole("combobox").nth(2).selectOption({ index: 0 });
            await page.getByRole("combobox").nth(3).selectOption({ index: 0 });
            await page.getByRole("button").filter({ hasText: /save|enregistrer/i }).last().click();
            await pause(admin, 2000);
            await page.reload();
            await expect(page.getByRole("heading", { name: /langue & région/i })).toBeVisible();
        });
        await step(admin, "Mes données : consentement analyse accordé", async () => {
            await goto(admin, "/dashboard/settings/my-data");
            await page.getByRole("button", { name: /^accorder$/i }).first().click();
            await pause(admin, 1500);
            await scrollThrough(admin);
        });
        await step(admin, "Mes données : demande d'archive (portabilité)", async () => {
            await page.getByRole("button", { name: /demander l'archive/i }).click();
            await pause(admin, 2500);
        });
        await step(admin, "Sécurité : envoi du lien de changement de mot de passe", async () => {
            await goto(admin, "/dashboard/settings/security");
            await page.getByRole("button", { name: /envoyer le lien de réinitialisation/i }).click();
            await pause(admin, 2500);
        });
    } finally {
        await admin.close();
    }
});
