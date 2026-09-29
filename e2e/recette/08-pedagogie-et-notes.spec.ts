/**
 * Étape 08 — Pédagogie et notes : devoirs (création, consultation par
 * l'élève et le parent, rendu), saisie des notes dans chaque configuration
 * (interrogation, devoir surveillé avec plafond par période, absence à une
 * évaluation, note hors barème, primaire sur 10), cahier de notes,
 * consultation par l'élève et les parents, statistiques de la direction,
 * examens en ligne, cours en ligne, ressources, compétences, récompenses.
 */
import { expect, test, type Browser } from "@playwright/test";
import {
    choose,
    constat,
    etat,
    expectDownload,
    expectEffect,
    explorePage,
    goto,
    loginToDashboard,
    openActor,
    pause,
    scrollThrough,
    step,
    type Actor,
} from "./kit";
import { ELEVES } from "./donnees";

const ETAPE = "08-pedagogie-et-notes";
const eleve = (key: string) => ELEVES.find((e) => e.key === key)!;

async function acteur(browser: Browser, scenario: string, key: string, label: string, name = key): Promise<Actor> {
    const a = await openActor(browser, { etape: ETAPE, scenario, name, label });
    await step(a, "Connexion", async () => loginToDashboard(a, etat.account(key)), { critical: true });
    return a;
}

type Evaluation = {
    classe: string;
    matiere: string;
    type: string;
    titre: string;
    date: string;
    notes: Record<string, number | "absent">;
    appreciations?: Record<string, string>;
};

/** Paramètres de l'évaluation puis grille de saisie. */
async function ouvrirSaisie(a: Actor, e: Evaluation) {
    const page = a.page;
    await goto(a, "/dashboard/grades/entry");
    await choose(a, page, /^classe/i, e.classe);
    await choose(a, page, /^matière/i, e.matiere);
    await choose(a, page, /^période/i, /trimestre 1|1er trimestre|T1|semestre 1/i);
    await choose(a, page, /^type/i, e.type);
    const titre = page.getByLabel(/titre \(optionnel\)/i);
    if (await titre.isVisible().catch(() => false)) await titre.fill(e.titre);
    await page.getByLabel(/^date/i).first().fill(e.date);
    await pause(a, 1500);
}

async function saisir(a: Actor, e: Evaluation) {
    const page = a.page;
    for (const [key, note] of Object.entries(e.notes)) {
        const ligne = page.locator("tr").filter({ hasText: eleve(key).nom }).filter({ hasText: eleve(key).prenom }).first();
        if (note === "absent") await ligne.getByRole("switch").first().click();
        else await ligne.getByLabel("Note", { exact: true }).fill(String(note));
        const app = e.appreciations?.[key];
        if (app) await ligne.getByPlaceholder(/appréciation/i).fill(app).catch(() => undefined);
        await pause(a, 300);
    }
}

async function publier(a: Actor) {
    await a.page.getByRole("button", { name: /publier les notes/i }).click();
    await expect(a.page.getByText(/notes? (publiée|enregistrée)|succès/i).first()).toBeVisible({ timeout: 20_000 });
    await pause(a, 1500);
}

const INTERRO_MATHS: Evaluation = {
    classe: "6ème A",
    matiere: "Mathématiques",
    type: "Interrogation écrite",
    titre: "Interrogation n°1 — nombres entiers",
    date: "2026-09-22",
    notes: { "eleve-kate": 15.5, "eleve-ismael": 9, "eleve-divine": "absent", "eleve-junior": 12 },
    appreciations: { "eleve-kate": "Très bon travail, rigoureux", "eleve-ismael": "Revoir les priorités opératoires" },
};
const DS_MATHS = (n: number): Evaluation => ({
    classe: "6ème A",
    matiere: "Mathématiques",
    type: "Devoir surveillé",
    titre: `Devoir surveillé n°${n}`,
    date: `2026-09-2${n + 2}`,
    notes: { "eleve-kate": 17, "eleve-ismael": 11, "eleve-divine": 8, "eleve-junior": 13.5 },
});

test("01 · devoirs : création, consultation par l'élève et le parent, rendu", async ({ browser }) => {
    const prof = await acteur(browser, "01-devoirs", "prof-maths", "Koffi Dossou (enseignant)");
    try {
        await step(prof, "Devoirs : liste vide", async () => explorePage(prof, "/dashboard/homework"));
        await step(prof, "Nouveau devoir : 6ème A, Mathématiques, à rendre le 2 octobre", async () => {
            await goto(prof, "/dashboard/homework/new");
            await choose(prof, prof.page, /matière et classe/i, /Mathématiques.*6ème A|6ème A.*Mathématiques/);
            await prof.page.getByLabel(/^titre/i).fill("Exercices 12 à 18 p. 34 — fractions");
            await prof.page.getByLabel(/^description/i).fill("Rédiger proprement sur copie double. Justifier chaque étape de calcul.");
            await prof.page.getByLabel(/date limite/i).fill("2026-10-02T18:00");
            await prof.page.getByLabel(/note maximale/i).fill("20");
            await prof.page.getByLabel(/coefficient/i).fill("1");
            await pause(prof, 800);
            await prof.page.getByRole("button", { name: /publier|créer|enregistrer/i }).last().click();
            await prof.page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 20_000 });
        }, { critical: true });
        await step(prof, "Fiche du devoir", async () => {
            await goto(prof, "/dashboard/homework");
            await prof.page.getByRole("button", { name: /voir le devoir.*fractions/i }).first().click();
            await prof.page.waitForURL(/homework\/[^/]+$/);
            etat.set("url:devoir-fractions", new URL(prof.page.url()).pathname);
            await scrollThrough(prof);
        });
    } finally {
        await prof.close();
    }
    const kate = await acteur(browser, "01-devoirs", "eleve-kate", "Kate Agbossou (élève de 6ème A)");
    try {
        await step(kate, "Mes devoirs", async () => explorePage(kate, "/dashboard/homework"));
        await step(kate, "Rendre le devoir", async () => {
            const voir = kate.page.getByRole("button", { name: /voir le devoir.*fractions/i }).first();
            if (await voir.isVisible().catch(() => false)) await voir.click();
            else await kate.page.getByText(/fractions/i).first().click();
            await pause(kate, 2000);
            const rendre = kate.page.getByRole("button", { name: /rendre|déposer|soumettre|envoyer ma copie/i }).first();
            await expect(rendre, "l'élève doit pouvoir rendre son devoir").toBeVisible({ timeout: 10_000 });
        });
    } finally {
        await kate.close();
    }
    const parent = await acteur(browser, "01-devoirs", "parent-agbossou", "Fabrice Agbossou (parent de Kate)");
    try {
        await step(parent, "Devoirs de Kate vus par le parent", async () => {
            await explorePage(parent, "/dashboard/homework");
            await expect(parent.page.getByText(/fractions/i).first(), "le devoir de Kate doit être visible du parent").toBeVisible();
        });
    } finally {
        await parent.close();
    }
});

test("02 · saisie des notes : interrogation, devoirs surveillés, plafond, absence, barème", async ({ browser }) => {
    const prof = await acteur(browser, "02-saisie-des-notes-college", "prof-maths", "Koffi Dossou (enseignant)");
    try {
        await step(prof, "Saisie de notes : écran de départ", async () => explorePage(prof, "/dashboard/grades/entry"));
        await step(prof, `${INTERRO_MATHS.titre} (6ème A) : grille`, async () => ouvrirSaisie(prof, INTERRO_MATHS), { critical: true });
        await step(prof, "Note hors barème (25/20) : refusée", async () => {
            const ligne = prof.page.locator("tr").filter({ hasText: eleve("eleve-kate").nom }).filter({ hasText: eleve("eleve-kate").prenom }).first();
            const note = ligne.getByLabel("Note", { exact: true });
            await note.fill("25");
            await note.press("Tab");
            await pause(prof, 1200);
            const valeur = await note.inputValue();
            const alerte = await prof.page.getByText(/entre 0 et 20|maximum|invalide|supérieure/i).first().isVisible().catch(() => false);
            expect(valeur !== "25" || alerte, "25/20 doit être refusé ou signalé").toBe(true);
            await note.fill("");
        }, { refusAttendu: true });
        await step(prof, "Notes, absence de Divine et appréciations", async () => saisir(prof, INTERRO_MATHS));
        await step(prof, "Brouillon automatique avant publication", async () => {
            await pause(prof, 2500);
            await expect(prof.page.getByText(/brouillon enregistré/i).first()).toBeVisible({ timeout: 15_000 });
        });
        await step(prof, "Publication des notes", async () => publier(prof), { critical: true });
        for (const n of [1, 2]) {
            await step(prof, `Devoir surveillé n°${n} (plafond : 2 par période)`, async () => {
                await ouvrirSaisie(prof, DS_MATHS(n));
                await saisir(prof, DS_MATHS(n));
                await publier(prof);
            });
        }
        await step(prof, "Troisième devoir surveillé dans la période : refusé (plafond de 2)", async () => {
            await ouvrirSaisie(prof, DS_MATHS(3));
            await saisir(prof, DS_MATHS(3));
            await prof.page.getByRole("button", { name: /publier les notes/i }).click();
            await pause(prof, 3000);
            const messages = await prof.page.locator('[role="alert"], [data-sonner-toast]').allInnerTexts().catch(() => []);
            constat(prof, "Message après le 3e devoir surveillé", messages.join(" | ") || "aucun message");
            await goto(prof, "/dashboard/grades/cahier");
            await choose(prof, prof.page, /^classe/i, "6ème A");
            await pause(prof, 2500);
            await expect(prof.page.getByText(/devoir surveillé n°3/i), "le plafond de 2 devoirs surveillés par période doit être appliqué").toHaveCount(0);
        }, { refusAttendu: true });
        await step(prof, "Cahier de notes de la 6ème A", async () => {
            await goto(prof, "/dashboard/grades/cahier");
            await choose(prof, prof.page, /^classe/i, "6ème A");
            await pause(prof, 2500);
            await prof.page.getByText(/interrogation n°1/i).first().click();
            await pause(prof, 1500);
            await scrollThrough(prof);
            await expect(prof.page.getByText(/15,5|15\.5/).first(), "la note de Kate figure au cahier").toBeVisible();
        });
    } finally {
        await prof.close();
    }
    const francais = await acteur(browser, "02-saisie-des-notes-college", "prof-francais", "Awa Hountondji (enseignante de français)");
    try {
        const dictee: Evaluation = {
            classe: "6ème A",
            matiere: "Français",
            type: "Interrogation écrite",
            titre: "Dictée n°1",
            date: "2026-09-23",
            notes: { "eleve-kate": 13, "eleve-ismael": 14.5, "eleve-divine": 10, "eleve-junior": 7 },
        };
        await step(francais, "Dictée n°1 (6ème A, Français)", async () => {
            await ouvrirSaisie(francais, dictee);
            await saisir(francais, dictee);
            await publier(francais);
        });
        await step(francais, "Matières proposées : uniquement les siennes", async () => {
            await goto(francais, "/dashboard/grades/entry");
            await choose(francais, francais.page, /^classe/i, "6ème A");
            const matiere = francais.page.getByRole("combobox", { name: /^matière/i }).first();
            const options = (await matiere.evaluate((e) => e.tagName)) === "SELECT" ? await matiere.locator("option").allInnerTexts() : [];
            constat(francais, "Matières proposées à l'enseignante de français en 6ème A", options.join(", "));
            expect(options.join(" "), "seules ses matières doivent être proposées").not.toMatch(/Mathématiques/);
        });
    } finally {
        await francais.close();
    }
    const svt = await acteur(browser, "02-saisie-des-notes-college", "prof-svt", "Estelle Gbaguidi (SVT, Tle D)");
    try {
        const compo: Evaluation = {
            classe: "Tle D",
            matiere: "Sciences de la Vie et de la Terre",
            type: "Composition",
            titre: "Composition du 1er trimestre",
            date: "2026-09-24",
            notes: { "eleve-gloria": 14 },
        };
        await step(svt, "Composition de SVT en Tle D (poids 2)", async () => {
            await ouvrirSaisie(svt, compo);
            await saisir(svt, compo);
            await publier(svt);
        });
    } finally {
        await svt.close();
    }
});

test("03 · notes au primaire (CM2 A, évaluation sommative sur 10) et compétences", async ({ browser }) => {
    const instit = await acteur(browser, "03-saisie-des-notes-primaire", "instit-cm2", "Romaric Dègla (instituteur CM2)");
    try {
        for (const [matiere, notes] of [
            ["Mathématiques", { "eleve-emmanuel": 7, "eleve-grace": 8.5 }],
            ["Français (communication écrite et orale)", { "eleve-emmanuel": 6.5, "eleve-grace": 9 }],
        ] as const) {
            const ev: Evaluation = { classe: "CM2 A", matiere, type: "Évaluation sommative", titre: `Évaluation sommative — ${matiere}`, date: "2026-09-24", notes };
            await step(instit, `${matiere} : évaluation sommative sur 10`, async () => {
                await ouvrirSaisie(instit, ev);
                const max = instit.page.getByLabel(/note max/i);
                if (await max.isVisible().catch(() => false)) await max.fill("10");
                await saisir(instit, ev);
                await publier(instit);
            });
        }
        await step(instit, "Compétences (grille MEMP) du CM2 A", async () => {
            await goto(instit, "/dashboard/competences");
            await choose(instit, instit.page, /^classe/i, "CM2 A");
            await instit.page.getByRole("button", { name: /^calculer$/i }).click();
            await pause(instit, 3000);
            await scrollThrough(instit);
        });
        await step(instit, "Compétences : « Évaluer »", async () => {
            const evaluer = instit.page.getByRole("button", { name: /^évaluer$/i }).first();
            if (!(await evaluer.isVisible().catch(() => false))) {
                constat(instit, "Bouton « Évaluer » absent", "rien à tester");
                return;
            }
            await expectEffect(instit, evaluer, "« Évaluer »");
        });
    } finally {
        await instit.close();
    }
});

test("04 · notes vues par l'élève et par les parents", async ({ browser }) => {
    for (const [key, label, attendu] of [
        ["eleve-kate", "Kate Agbossou (élève)", /15,5|15\.5/],
        ["parent-agbossou", "Fabrice Agbossou (parent de Kate)", /15,5|15\.5/],
        ["parent-zinsou", "Célestin Zinsou (parent de Divine et Emmanuel)", /absent|abs\.|6,5|6\.5/i],
        ["eleve-gloria", "Gloria Akakpo (Tle D)", /14/],
    ] as const) {
        const a = await acteur(browser, "04-consultation-eleves-parents", key, label);
        try {
            await step(a, "Mes notes / notes des enfants", async () => {
                await explorePage(a, "/dashboard/grades");
                await expect(a.page.getByText(attendu).first(), "les notes publiées doivent apparaître").toBeVisible();
            });
            await step(a, "Accueil après publication des notes", async () => {
                await goto(a, "/dashboard");
                await scrollThrough(a);
            });
        } finally {
            await a.close();
        }
    }
});

test("05 · direction : évaluations, statistiques, export, analyses", async ({ browser }) => {
    const dir = await acteur(browser, "05-statistiques-direction", "directeur-cocotiers", "Clarisse Hounkpatin (directrice des études)");
    const page = dir.page;
    try {
        await step(dir, "Notes et évaluations : liste et filtres", async () => {
            await goto(dir, "/dashboard/grades");
            for (const f of ["Devoirs", "Interrogations", "Compositions", "Tous"]) {
                await page.getByRole("button", { name: new RegExp(`^${f}$`) }).click();
                await pause(dir, 900);
            }
        });
        await step(dir, "Statistiques & analyse", async () => {
            await page.getByRole("button", { name: /statistiques & analyse/i }).click();
            await pause(dir, 2500);
            await scrollThrough(dir);
        });
        await step(dir, "« Nouvelle évaluation »", async () => {
            await goto(dir, "/dashboard/grades");
            await expectEffect(dir, page.getByRole("button", { name: /nouvelle évaluation/i }), "« Nouvelle évaluation »");
        });
        await step(dir, "Export des notes", async () => {
            await goto(dir, "/dashboard/grades");
            constat(dir, "Fichier exporté", await expectDownload(dir, page.getByRole("button", { name: /^exporter$/i })));
        });
        await step(dir, "Analyses de l'établissement", async () => explorePage(dir, "/dashboard/analytics"));
        await step(dir, "Performances", async () => explorePage(dir, "/dashboard/performances"));
        await step(dir, "Risque d'échec", async () => explorePage(dir, "/dashboard/risks/failure"));
        await step(dir, "Cahier de notes (direction)", async () => {
            await goto(dir, "/dashboard/grades/cahier");
            await choose(dir, page, /^classe/i, "6ème A");
            await pause(dir, 2500);
            await scrollThrough(dir);
        });
    } finally {
        await dir.close();
    }
});

test("06 · examens en ligne : création par l'enseignant, passage par l'élève", async ({ browser }) => {
    const prof = await acteur(browser, "06-examens-en-ligne", "prof-maths", "Koffi Dossou (enseignant)");
    try {
        await step(prof, "Nouvel examen « Quiz — fractions » (30 min, publié)", async () => {
            await goto(prof, "/dashboard/exams/new");
            await prof.page.getByLabel(/^titre/i).fill("Quiz — fractions");
            await choose(prof, prof.page, /matière et classe/i, /Mathématiques.*6ème A|6ème A.*Mathématiques/);
            await prof.page.getByLabel(/durée/i).fill("30");
            await prof.page.getByRole("switch", { name: /publier maintenant/i }).click();
            await prof.page.getByRole("button", { name: /créer l'examen/i }).click();
            await prof.page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 20_000 });
        }, { critical: true });
        await step(prof, "Ajout de questions à l'examen", async () => {
            await goto(prof, "/dashboard/exams");
            const lien = await prof.page.locator('main a[href*="/dashboard/exams/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""));
            const id = lien.map((h) => h.match(/\/dashboard\/exams\/([^/?#]+)/)?.[1]).find((x) => x && !["new", "planning"].includes(x));
            expect(id, "lien vers l'examen créé").toBeTruthy();
            etat.set("url:exam-fractions", `/dashboard/exams/${id}`);
            await goto(prof, `/dashboard/exams/${id}`);
            await scrollThrough(prof);
            const ajouter = prof.page.getByRole("button", { name: /ajouter une question|nouvelle question/i }).first();
            await expect(ajouter, "l'enseignant doit pouvoir ajouter des questions").toBeVisible({ timeout: 8000 });
        });
        await step(prof, "Planning des examens et convocations", async () => {
            await explorePage(prof, "/dashboard/exams/planning");
            await expectEffect(prof, prof.page.getByRole("button", { name: /convocations pdf/i }), "« Convocations PDF »");
        });
    } finally {
        await prof.close();
    }
    const kate = await acteur(browser, "06-examens-en-ligne", "eleve-kate", "Kate Agbossou (élève)");
    try {
        await step(kate, "Examens disponibles", async () => explorePage(kate, "/dashboard/exams"));
        await step(kate, "Passage du quiz", async () => {
            await goto(kate, `${etat.get("url:exam-fractions")}/take`);
            await pause(kate, 2500);
            await scrollThrough(kate);
            const commencer = kate.page.getByRole("button", { name: /commencer|démarrer/i }).first();
            if (await commencer.isVisible().catch(() => false)) await commencer.click();
            await pause(kate, 2000);
            await expect(kate.page.getByRole("button", { name: /aller à la question 1/i }), "le quiz doit comporter au moins une question").toBeVisible({ timeout: 8000 });
        });
    } finally {
        await kate.close();
    }
});

test("07 · cours en ligne et ressources pédagogiques", async ({ browser }) => {
    const prof = await acteur(browser, "07-cours-et-ressources", "prof-svt", "Estelle Gbaguidi (enseignante)");
    try {
        await step(prof, "Nouveau cours « La cellule » (2 modules, publié)", async () => {
            await goto(prof, "/dashboard/courses/new");
            await prof.page.getByLabel("Titre du cours").fill("La cellule, unité du vivant");
            await choose(prof, prof.page, /matière & classe/i, /Sciences de la Vie/);
            await prof.page.getByLabel("Description du cours").fill("Découvrir la cellule animale et végétale, observer au microscope.");
            await prof.page.getByRole("switch", { name: /publier immédiatement/i }).click();
            await prof.page.getByLabel("Titre du module 1").fill("Observer la cellule");
            await prof.page.getByLabel("Titre de la leçon 1").fill("Le microscope optique");
            await prof.page.getByLabel("Contenu de la leçon 1").fill("Le microscope grossit jusqu'à 1000 fois. On règle d'abord le plus faible grossissement.");
            await prof.page.getByRole("button", { name: /ajouter un module/i }).click();
            await pause(prof, 800);
            const titre2 = prof.page.getByLabel("Titre du module 2");
            if (await titre2.isVisible().catch(() => false)) await titre2.fill("Cellule animale et végétale");
            await prof.page.getByRole("button", { name: /enregistrer le cours/i }).click();
            await pause(prof, 3000);
            const messages = await prof.page.locator('[role="alert"], [data-sonner-toast], [aria-invalid="true"]').allInnerTexts().catch(() => []);
            constat(prof, "Messages après « Enregistrer le cours »", messages.join(" | ") || "aucun message");
            await prof.page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 20_000 });
        });
        await step(prof, "Ressource pédagogique : ajout", async () => {
            await goto(prof, "/dashboard/resources");
            await prof.page.getByRole("button", { name: /ajouter une ressource/i }).first().click();
            await pause(prof, 1200);
            const d = prof.page.getByRole("dialog");
            await expect(d, "« Ajouter une ressource » doit ouvrir un formulaire").toHaveCount(1, { timeout: 8000 });
            await d.getByRole("textbox").first().fill("Schéma de la cellule (planche)");
            await d.getByRole("button", { name: /ajouter|enregistrer|créer|publier/i }).last().click();
            await pause(prof, 2000);
        });
    } finally {
        await prof.close();
    }
    const gloria = await acteur(browser, "07-cours-et-ressources", "eleve-gloria", "Gloria Akakpo (Tle D)");
    try {
        await step(gloria, "Cours disponibles", async () => explorePage(gloria, "/dashboard/courses"));
        await step(gloria, "Ouverture du cours et d'une leçon", async () => {
            await gloria.page.getByText(/la cellule/i).first().click();
            await pause(gloria, 2000);
            await scrollThrough(gloria);
            const lecon = gloria.page.getByText(/microscope/i).first();
            await expect(lecon, "la leçon doit être accessible à l'élève").toBeVisible();
            await lecon.click();
            await pause(gloria, 2000);
        });
        await step(gloria, "Ressources", async () => explorePage(gloria, "/dashboard/resources"));
    } finally {
        await gloria.close();
    }
});

test("08 · récompenses (gamification) et préparation au BEPC", async ({ browser }) => {
    const dir = await acteur(browser, "08-recompenses-et-bepc", "admin-cocotiers", "Direction Les Cocotiers");
    try {
        await step(dir, "Gamification : « Récompenser un élève »", async () => {
            await goto(dir, "/dashboard/gamification");
            await expectEffect(dir, dir.page.getByRole("button", { name: /récompenser un élève/i }), "« Récompenser un élève »");
        });
    } finally {
        await dir.close();
    }
    const fiacre = await acteur(browser, "08-recompenses-et-bepc", "eleve-fiacre", "Fiacre Dossa (élève de 3ème)");
    try {
        await step(fiacre, "Préparation BEPC", async () => explorePage(fiacre, "/dashboard/bepc-prep"));
        await step(fiacre, "Gamification côté élève", async () => explorePage(fiacre, "/dashboard/gamification"));
    } finally {
        await fiacre.close();
    }
});
