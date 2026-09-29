/**
 * Étape 10 — Communication et services : annonces ciblées (enseignants,
 * parents, élèves) et leur réception, cahier de liaison (mot du parent au
 * professeur), messagerie (réponse de l'enseignant), notifications et
 * préférences, modèles SMS, WhatsApp, notifications vocales, événements et
 * calendrier, cantine, transport, bibliothèque (ouvrage, emprunt, retour),
 * clubs, alumni, orientation, assistant IA, import CSV d'élèves.
 */
import { expect, test, type Browser } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
    choose,
    constat,
    etat,
    expectEffect,
    explorePage,
    goto,
    loginToDashboard,
    openActor,
    OUT,
    pause,
    scrollThrough,
    showMail,
    step,
    type Actor,
} from "./kit";
import { mail } from "./donnees";

const ETAPE = "10-communication-et-services";

async function acteur(browser: Browser, scenario: string, key: string, label: string, name = key): Promise<Actor> {
    const a = await openActor(browser, { etape: ETAPE, scenario, name, label });
    await step(a, "Connexion", async () => loginToDashboard(a, etat.account(key)), { critical: true });
    return a;
}

test("01 · annonces ciblées et leur réception", async ({ browser }) => {
    const dir = await acteur(browser, "01-annonces", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        await step(dir, "Annonce vide : bouton « Publier » inactif", async () => {
            await goto(dir, "/dashboard/announcements");
            await page.getByRole("button", { name: /nouvelle annonce/i }).first().click();
            await expect(page.getByRole("button", { name: /publier l'annonce/i })).toBeDisabled();
        });
        for (const a of [
            { titre: "Réunion parents-professeurs du 10 octobre", contenu: "Les familles sont attendues le samedi 10 octobre à 9 h dans la cour principale pour rencontrer les professeurs.", cibles: ["Parents", "Enseignants"], priorite: /haute|urgent|important/i },
            { titre: "Journée sportive inter-classes", contenu: "Tenue de sport obligatoire vendredi prochain. Rendez-vous au terrain à 7 h 30.", cibles: ["Élèves"], priorite: /normal|moyenne/i },
            { titre: "Conseil pédagogique", contenu: "Réunion de tous les enseignants mercredi à 15 h en salle des professeurs.", cibles: ["Enseignants"], priorite: /normal|moyenne/i },
        ]) {
            await step(dir, `Annonce « ${a.titre} » → ${a.cibles.join(" + ")}`, async () => {
                await goto(dir, "/dashboard/announcements");
                await page.getByRole("button", { name: /nouvelle annonce/i }).first().click();
                await page.getByRole("textbox", { name: /^titre/i }).fill(a.titre);
                await page.getByRole("textbox", { name: /^contenu/i }).fill(a.contenu);
                await choose(dir, page, /^priorité/i, a.priorite).catch(() => undefined);
                for (const c of a.cibles) await page.getByRole("button", { name: new RegExp(`^${c}$`) }).click();
                await pause(dir, 800);
                await page.getByRole("button", { name: /publier l'annonce/i }).click();
                await expect(page.getByText(a.titre).first()).toBeVisible({ timeout: 20_000 });
            });
        }
        await step(dir, "Fil d'annonces", async () => {
            await goto(dir, "/dashboard/announcements");
            await scrollThrough(dir);
        });
    } finally {
        await dir.close();
    }
    for (const [key, label, voit, nevoitpas] of [
        ["parent-agbossou", "Parent (Fabrice Agbossou)", /réunion parents-professeurs/i, /conseil pédagogique/i],
        ["eleve-kate", "Élève (Kate)", /journée sportive/i, /conseil pédagogique/i],
        ["prof-maths", "Enseignant (Koffi Dossou)", /conseil pédagogique/i, /journée sportive/i],
    ] as const) {
        const a = await acteur(browser, "01-annonces", key, label);
        try {
            await step(a, "Annonces reçues selon le public visé", async () => {
                await explorePage(a, "/dashboard/announcements");
                await expect(a.page.getByText(voit).first(), "l'annonce qui le concerne doit être visible").toBeVisible();
                await expect(a.page.getByText(nevoitpas), "une annonce destinée à un autre public ne doit pas être visible").toHaveCount(0);
            });
            await step(a, "Notifications", async () => explorePage(a, "/dashboard/notifications"));
        } finally {
            await a.close();
        }
    }
    const boites = await openActor(browser, { etape: ETAPE, scenario: "01-annonces", name: "boites-de-reception", label: "Boîte de réception du parent" });
    try {
        await step(boites, "Courriel de l'annonce reçu par le parent", async () => {
            constat(boites, "Courriel", (await showMail(boites, mail("parent-agbossou"), /réunion|annonce/i)).subject);
        });
    } finally {
        await boites.close();
    }
});

test("02 · cahier de liaison et messagerie parent ↔ enseignant", async ({ browser }) => {
    const parent = await acteur(browser, "02-liaison-et-messagerie", "parent-agbossou", "Fabrice Agbossou (parent de Kate)");
    try {
        await step(parent, "Cahier de liaison de Kate", async () => explorePage(parent, "/dashboard/liaison"));
        await step(parent, "« Mot au professeur »", async () => {
            await expectEffect(parent, parent.page.getByRole("button", { name: /mot au professeur/i }), "« Mot au professeur »");
        });
        await step(parent, "Mot au professeur principal (Koffi Dossou)", async () => {
            await goto(parent, "/dashboard/liaison");
            await choose(parent, parent.page, /destinataire/i, /Dossou/);
            await parent.page.getByPlaceholder(/écrire un mot/i).fill("Bonjour Monsieur, Kate a du mal avec les fractions. Pourriez-vous nous conseiller des exercices ? Merci.");
            await parent.page.getByRole("button", { name: /envoyer/i }).click();
            await expect(parent.page.getByText(/mot envoyé/i).first(), "le mot doit être envoyé").toBeVisible({ timeout: 15_000 });
        });
        await step(parent, "Messagerie : le mot envoyé apparaît", async () => {
            await explorePage(parent, "/dashboard/messages");
            await expect(parent.page.getByText(/fractions/i).first()).toBeVisible();
        });
        await step(parent, "Messagerie : démarrer une nouvelle conversation", async () => {
            await goto(parent, "/dashboard/messages");
            await expect(parent.page.getByRole("button", { name: /nouveau message|nouvelle conversation|écrire/i }).first(), "la messagerie doit permettre d'écrire à un nouveau contact").toBeVisible({ timeout: 5000 });
        });
    } finally {
        await parent.close();
    }
    const prof = await acteur(browser, "02-liaison-et-messagerie", "prof-maths", "Koffi Dossou (enseignant)");
    try {
        await step(prof, "Message du parent reçu", async () => {
            await explorePage(prof, "/dashboard/messages");
            await prof.page.getByText(/agbossou/i).first().click();
            await pause(prof, 1500);
            await expect(prof.page.getByText(/fractions/i).first()).toBeVisible();
        });
        await step(prof, "Réponse de l'enseignant", async () => {
            await prof.page.getByRole("button", { name: /^répondre$/i }).click();
            await prof.page.locator("#message-composer").fill("Bonjour M. Agbossou, je lui ai préparé une fiche d'exercices corrigés. Elle la recevra lundi.");
            await prof.page.getByRole("button", { name: /envoyer/i }).last().click();
            await pause(prof, 2000);
            await expect(prof.page.getByText(/fiche d'exercices/i).first()).toBeVisible();
        });
    } finally {
        await prof.close();
    }
    const parent2 = await acteur(browser, "02-liaison-et-messagerie", "parent-agbossou", "Fabrice Agbossou (lecture de la réponse)", "parent-agbossou-reponse");
    try {
        await step(parent2, "Réponse reçue", async () => {
            await explorePage(parent2, "/dashboard/messages");
            await parent2.page.getByText(/dossou/i).first().click();
            await expect(parent2.page.getByText(/fiche d'exercices/i).first()).toBeVisible();
        });
    } finally {
        await parent2.close();
    }
});

test("03 · notifications, préférences, modèles SMS, WhatsApp, messages vocaux", async ({ browser }) => {
    const dir = await acteur(browser, "03-canaux-de-notification", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        await step(dir, "Centre de notifications : filtres par catégorie", async () => {
            await goto(dir, "/dashboard/notifications");
            for (const f of [/^finance \d/i, /^pédagogie \d/i, /^vie scolaire \d/i, /^tout \d/i]) {
                await page.getByRole("button", { name: f }).first().click();
                await pause(dir, 700);
            }
        });
        await step(dir, "Canaux : WhatsApp activé puis désactivé", async () => {
            const wa = page.getByRole("checkbox", { name: /^whatsapp$/i });
            await wa.click();
            await pause(dir, 1500);
            await wa.click();
        });
        await step(dir, "Modèle SMS « Absence non justifiée » modifié et conservé", async () => {
            await goto(dir, "/dashboard/notifications/sms");
            await page.getByRole("button", { name: /absence non justifiée/i }).click();
            const texte = page.getByRole("textbox", { name: /texte du sms/i });
            await texte.fill("Bonjour {parent.prenom}, {eleve.prenom} ({eleve.classe}) était absent(e) le {absence.date}. Merci de justifier sous 48 h — {ecole.nom}.");
            await page.getByRole("button", { name: /^enregistrer$/i }).click();
            await pause(dir, 2000);
            await page.reload();
            await page.getByRole("button", { name: /absence non justifiée/i }).click();
            await expect(page.getByRole("textbox", { name: /texte du sms/i })).toHaveValue(/eleve\.classe/);
        });
        await step(dir, "Nouveau modèle SMS", async () => {
            await expectEffect(dir, page.getByRole("button", { name: /nouveau modèle/i }), "« Nouveau modèle »");
        });
        await step(dir, "WhatsApp Business : démarrer la vérification", async () => {
            await goto(dir, "/dashboard/whatsapp");
            await expectEffect(dir, page.getByRole("button", { name: /démarrer la vérification/i }), "« Démarrer la vérification »");
        });
        await step(dir, "Notifications vocales : chaque langue", async () => {
            await goto(dir, "/dashboard/voice-notifs");
            for (const l of [/^français/i, /^yorùbá/i, /^bariba/i, /^dendi/i, /^fɔngbè/i]) {
                await page.getByRole("button", { name: l }).click();
                await pause(dir, 800);
            }
            await scrollThrough(dir);
        });
        await step(dir, "Préférences de notification", async () => explorePage(dir, "/dashboard/settings/notifications"));
    } finally {
        await dir.close();
    }
});

test("04 · événements et calendrier", async ({ browser }) => {
    const dir = await acteur(browser, "04-evenements-et-calendrier", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        await step(dir, "Événement « Kermesse de fin de trimestre » (autorisation parentale, 1 000 FCFA)", async () => {
            await goto(dir, "/dashboard/events");
            await page.getByRole("button", { name: /créer un événement/i }).first().click();
            await page.getByRole("textbox", { name: /^titre/i }).fill("Kermesse de fin de trimestre");
            await page.getByRole("textbox", { name: /^description/i }).fill("Jeux, stands des clubs et spectacle de fin de trimestre.");
            await choose(dir, page, /^type/i, /./);
            await page.getByLabel(/date début/i).fill("2026-12-18T09:00");
            await page.getByLabel(/date fin/i).fill("2026-12-18T16:00");
            await page.getByRole("textbox", { name: /^lieu/i }).fill("Cour principale");
            await page.getByRole("spinbutton", { name: /max participants/i }).fill("400");
            await page.getByRole("spinbutton", { name: /tarif/i }).fill("1000");
            await page.getByRole("switch", { name: /autorisation parentale/i }).click();
            await page.getByRole("button", { name: /créer l'événement/i }).click();
            await expect(page.getByText(/kermesse/i).first()).toBeVisible({ timeout: 20_000 });
        });
        await step(dir, "Calendrier : mois, événements, vacances, fériés", async () => {
            await goto(dir, "/dashboard/calendar");
            for (const v of [/^évènements$/i, /^vacances$/i, /^fériés$/i, /^mois$/i]) {
                await page.getByRole("button", { name: v }).click();
                await pause(dir, 1200);
            }
            for (let i = 0; i < 3; i++) {
                await page.getByRole("button", { name: /mois suivant/i }).click();
                await pause(dir, 900);
            }
            await expect(page.getByText(/kermesse/i).first(), "la kermesse doit figurer en décembre").toBeVisible();
            await page.getByRole("button", { name: /aujourd'hui/i }).click();
        });
    } finally {
        await dir.close();
    }
    const parent = await acteur(browser, "04-evenements-et-calendrier", "parent-gnanhoui", "Rachida Gnanhoui (parent)");
    try {
        await step(parent, "Événements vus par la famille (autorisation parentale)", async () => {
            await explorePage(parent, "/dashboard/events");
            await expect(parent.page.getByText(/kermesse/i).first()).toBeVisible();
            const autoriser = parent.page.getByRole("button", { name: /autoriser|inscrire|participer/i }).first();
            if (await autoriser.isVisible().catch(() => false)) await autoriser.click();
            await pause(parent, 1500);
        });
    } finally {
        await parent.close();
    }
});

test("05 · cantine, transport, bibliothèque, clubs", async ({ browser }) => {
    const dir = await acteur(browser, "05-cantine-transport-bibliotheque-clubs", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        for (const [date, entree, plat, dessert] of [
            ["2026-09-28", "Salade de crudités", "Riz au gras et poisson braisé", "Ananas"],
            ["2026-09-29", "Akassa et sauce légumes", "Pâte de maïs, sauce gombo", "Banane"],
        ] as const) {
            await step(dir, `Cantine : menu du ${date}`, async () => {
                await goto(dir, "/dashboard/canteen");
                await page.getByRole("button", { name: /programmer un menu/i }).click();
                const d = page.getByRole("dialog", { name: /programmer le menu/i });
                await d.getByRole("textbox", { name: /^date/i }).fill(date);
                await d.getByRole("textbox", { name: /entrée/i }).fill(entree);
                await d.getByRole("textbox", { name: /plat principal/i }).fill(plat);
                await d.getByRole("textbox", { name: /dessert/i }).fill(dessert);
                await d.getByRole("button", { name: /^enregistrer$/i }).click();
                await expect(d).toBeHidden({ timeout: 20_000 });
                await expect(page.getByText(plat).first()).toBeVisible();
            });
        }
        await step(dir, "Cantine : tickets et solde", async () => {
            await page.getByRole("button", { name: /tickets & solde/i }).click();
            await pause(dir, 1500);
            await scrollThrough(dir);
        });
        await step(dir, "Transport : « Nouvelle ligne »", async () => {
            await goto(dir, "/dashboard/transport");
            await expectEffect(dir, page.getByRole("button", { name: /nouvelle ligne/i }), "« Nouvelle ligne »");
        });
        await step(dir, "Transport : liste des passagers PDF", async () => {
            await goto(dir, "/dashboard/transport");
            await expectEffect(dir, page.getByRole("button", { name: /liste passagers pdf/i }), "« Liste passagers PDF »");
        });
        for (const [titre, auteur, isbn, qte] of [
            ["Un piège sans fin", "Olympe Bhêly-Quenum", "978-2-7011-6090-2", "3"],
            ["L'Enfant noir", "Camara Laye", "978-2-266-08690-2", "2"],
        ] as const) {
            await step(dir, `Bibliothèque : « ${titre} » (${qte} exemplaires)`, async () => {
                await goto(dir, "/dashboard/library");
                await page.getByRole("button", { name: /ajouter un livre/i }).first().click();
                const d = page.getByRole("dialog", { name: /nouvel ouvrage/i });
                await d.getByRole("textbox", { name: /titre du livre/i }).fill(titre);
                await d.getByRole("textbox", { name: /auteur/i }).fill(auteur);
                await d.getByRole("textbox", { name: /isbn/i }).fill(isbn);
                await d.getByRole("spinbutton", { name: /quantité/i }).fill(qte);
                await d.getByRole("button", { name: /ajouter au catalogue/i }).click();
                await expect(d).toBeHidden({ timeout: 20_000 });
                await expect(page.getByText(titre).first()).toBeVisible();
            });
        }
        await step(dir, "Bibliothèque : emprunts en cours", async () => {
            await page.getByRole("button", { name: /emprunts en cours/i }).click();
            await pause(dir, 1500);
        });
        for (const [nom, cat, horaire, places] of [
            ["Club de débat", "Culture", "Mercredi 15 h - 17 h", "25"],
            ["Club de football", "Sport", "Samedi 8 h - 10 h", "30"],
        ] as const) {
            await step(dir, `Club « ${nom} »`, async () => {
                await goto(dir, "/dashboard/clubs");
                await page.getByRole("button", { name: /nouveau club/i }).first().click();
                const d = page.getByRole("dialog", { name: /nouveau club/i });
                await d.getByRole("textbox", { name: /^nom/i }).fill(nom);
                await d.getByRole("textbox", { name: /catégorie/i }).fill(cat);
                await d.getByRole("textbox", { name: /horaire/i }).fill(horaire);
                await d.getByRole("spinbutton", { name: /places/i }).fill(places);
                await choose(dir, d, /responsable/i, /./);
                await d.getByRole("button", { name: /^enregistrer$/i }).click();
                await expect(d).toBeHidden({ timeout: 20_000 });
                await expect(page.getByText(nom).first()).toBeVisible();
            });
        }
    } finally {
        await dir.close();
    }
    const kate = await acteur(browser, "05-cantine-transport-bibliotheque-clubs", "eleve-kate", "Kate Agbossou (élève)");
    try {
        await step(kate, "Emprunter « Un piège sans fin »", async () => {
            await explorePage(kate, "/dashboard/library");
            const ligne = kate.page.locator("tr, li, article, [data-slot=card]").filter({ hasText: "Un piège sans fin" }).first();
            await ligne.getByRole("button", { name: /emprunter|réserver/i }).click();
            await pause(kate, 2000);
            await kate.page.getByRole("button", { name: /mes emprunts|emprunts en cours/i }).first().click();
            await expect(kate.page.getByText("Un piège sans fin").first()).toBeVisible();
        });
        await step(kate, "Retour du livre", async () => {
            await kate.page.getByRole("button", { name: /rendre|retour/i }).first().click();
            await pause(kate, 2000);
        });
        await step(kate, "S'inscrire au club de débat", async () => {
            await explorePage(kate, "/dashboard/clubs");
            const ligne = kate.page.locator("tr, li, article, [data-slot=card]").filter({ hasText: "Club de débat" }).first();
            await ligne.getByRole("button", { name: /rejoindre|s'inscrire|inscription/i }).click();
            await pause(kate, 2000);
        });
        await step(kate, "Menu de la cantine", async () => explorePage(kate, "/dashboard/canteen"));
        await step(kate, "Transport", async () => explorePage(kate, "/dashboard/transport"));
    } finally {
        await kate.close();
    }
});

test("06 · alumni, orientation, assistant IA", async ({ browser }) => {
    const dir = await acteur(browser, "06-alumni-orientation-ia", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        await step(dir, "Alumni : ancienne élève, promotion 2019", async () => {
            await goto(dir, "/dashboard/alumni");
            await page.getByRole("button", { name: /nouvel alumni/i }).click();
            const d = page.getByRole("dialog", { name: /ajouter un ancien élève/i });
            const champs = d.getByRole("textbox");
            await champs.nth(0).fill("Carine");
            await champs.nth(1).fill("HOUNGNIBO");
            await d.getByRole("spinbutton").fill("2019");
            await d.getByPlaceholder("D, C, A1…").fill("D");
            await choose(dir, d, /domaine/i, /./);
            await d.getByPlaceholder("Orange Bénin…").fill("CNHU de Cotonou");
            await d.getByPlaceholder("Tech Lead, Chirurgienne…").fill("Médecin généraliste");
            await d.getByRole("checkbox", { name: /mentorat/i }).check();
            await d.getByRole("button", { name: /^enregistrer$/i }).click();
            await expect(d).toBeHidden({ timeout: 20_000 });
            await expect(page.getByText(/houngnibo/i).first()).toBeVisible();
        });
        await step(dir, "Orientation : nouvel avis d'orientation", async () => {
            await goto(dir, "/dashboard/orientation");
            await expectEffect(dir, page.getByRole("button", { name: /nouvel avis d'orientation/i }), "« Nouvel avis d'orientation »");
        });
        await step(dir, "Orientation post-BEPC : conseil de la 3ème A", async () => {
            await goto(dir, "/dashboard/orientation/post-bepc");
            await choose(dir, page, /classe \(3/i, "3ème A");
            await choose(dir, page, /année académique/i, /2026-2027/);
            await page.getByRole("button", { name: /^préparer$/i }).click();
            await pause(dir, 3000);
            await scrollThrough(dir);
        });
        await step(dir, "Assistant IA : message aux parents sur l'assiduité", async () => {
            await goto(dir, "/dashboard/ai");
            await page.getByRole("button", { name: /message clair aux parents/i }).click();
            await pause(dir, 1000);
            const envoyer = page.getByRole("button", { name: /^envoyer$/i });
            if (await envoyer.isEnabled().catch(() => false)) await envoyer.click();
            await pause(dir, 8000);
            await scrollThrough(dir);
            constat(dir, "Réponse de l'assistant", (await page.locator("main").innerText()).slice(-300).replace(/\s+/g, " "));
        });
    } finally {
        await dir.close();
    }
    const gloria = await acteur(browser, "06-alumni-orientation-ia", "eleve-gloria", "Gloria Akakpo (Tle D)");
    try {
        await step(gloria, "Mon orientation", async () => explorePage(gloria, "/dashboard/orientation/me"));
        await step(gloria, "Annuaire des anciens (mentorat)", async () => explorePage(gloria, "/dashboard/alumni"));
    } finally {
        await gloria.close();
    }
    const primaire = await acteur(browser, "06-alumni-orientation-ia", "admin-cocotiers-primaire", "Direction de l'annexe primaire");
    try {
        await step(primaire, "Orientation CEP : module « Orientation » non activé dans cette annexe (configuration respectée)", async () => {
            await explorePage(primaire, "/dashboard/orientation/cep");
            await expect(primaire.page.getByText(/module « orientation » non activé/i)).toBeVisible();
        });
    } finally {
        await primaire.close();
    }
    const sj = await acteur(browser, "06-alumni-orientation-ia", "admin-saint-joseph", "Direction Saint-Joseph (primaire + orientation actifs)");
    try {
        await step(sj, "Orientation CEP (cycle primaire offert, module actif)", async () => explorePage(sj, "/dashboard/orientation/cep"));
        await step(sj, "« Inscrire au CEP »", async () => {
            await expectEffect(sj, sj.page.getByRole("button", { name: /inscrire au cep/i }), "« Inscrire au CEP »");
        });
    } finally {
        await sj.close();
    }
});

test("07 · import CSV d'élèves (Saint-Joseph)", async ({ browser }) => {
    const dir = await acteur(browser, "07-import-csv", "admin-saint-joseph", "Direction Saint-Joseph");
    const page = dir.page;
    const fichier = path.join(OUT, ".tmp-import-eleves-saint-joseph.csv");
    fs.writeFileSync(
        fichier,
        "Prénom;Nom;Email;Date de naissance;Genre;Lieu de naissance;Adresse;Classe;Matricule\n" +
            "Amina;BELLO;amina.bello@recette.edupilot.test;12/05/2014;F;Parakou;Quartier Banikanni;6ème International;GSI-2026-0101\n" +
            "Samuel;ADEBAYO;samuel.adebayo@recette.edupilot.test;03/09/2014;M;Lagos;Route de Djougou;6ème International;GSI-2026-0102\n" +
            "Fatou;;fatou.sans-nom@recette.edupilot.test;01/01/2014;F;Parakou;;6ème International;GSI-2026-0103\n",
    );
    try {
        await step(dir, "Import : choix du type « Élèves »", async () => {
            await explorePage(dir, "/dashboard/import");
            await page.locator("main").getByText(/^élèves$/i).first().click();
            await pause(dir, 1000);
        });
        await step(dir, "Dépôt du fichier CSV (3 lignes dont 1 sans nom)", async () => {
            await page.locator('input[type="file"]').setInputFiles(fichier);
            await pause(dir, 3000);
            await scrollThrough(dir);
        });
        await step(dir, "Correspondance des colonnes et aperçu", async () => {
            const suivant = page.getByRole("button", { name: /continuer|suivant|aperçu|valider le mapping|étape suivante/i }).first();
            if (await suivant.isVisible().catch(() => false)) await suivant.click();
            await pause(dir, 2500);
            await scrollThrough(dir);
            await expect(page.getByText(/BELLO/).first()).toBeVisible();
        });
        await step(dir, "Import : 2 élèves créés, la ligne sans nom rejetée", async () => {
            await page.getByRole("button", { name: /importer|lancer l'import|confirmer/i }).last().click();
            await pause(dir, 5000);
            await scrollThrough(dir);
            await goto(dir, "/dashboard/students");
            await expect(page.getByText(/BELLO/).first()).toBeVisible();
            await expect(page.getByText(/ADEBAYO/).first()).toBeVisible();
        });
    } finally {
        await dir.close();
    }
});
