/**
 * Étape 07 — Vie scolaire : appel (collège et primaire) avec absences,
 * retards et observations, alertes envoyées aux familles (SMS et courriel
 * réels, captés par les boîtes de test), justification par le parent, suivi
 * par la direction, incident signalé par un enseignant puis sanctionné et
 * clôturé, infirmerie, contrôle d'accès et badges, cellule d'écoute, rendez-vous.
 */
import { expect, test } from "@playwright/test";
import {
    choose,
    constat,
    etat,
    expectEffect,
    explorePage,
    goto,
    loginToDashboard,
    openActor,
    pause,
    scrollThrough,
    showMail,
    showSms,
    step,
    type Actor,
} from "./kit";
import { ELEVES, mail } from "./donnees";

const ETAPE = "07-vie-scolaire";
/** Vendredi de la semaine écoulée : jour de classe, déjà passé. */
const JOUR_APPEL = "2026-09-25";

const eleve = (key: string) => ELEVES.find((e) => e.key === key)!;
const nomComplet = (key: string) => `${eleve(key).prenom} ${eleve(key).nom}`;

async function acteur(browser: import("@playwright/test").Browser, scenario: string, key: string, label: string, name = key): Promise<Actor> {
    const a = await openActor(browser, { etape: ETAPE, scenario, name, label });
    await step(a, "Connexion", async () => loginToDashboard(a, etat.account(key)), { critical: true });
    return a;
}

/** Marque un élève sur la feuille d'appel (bouton P / R / E / A de sa ligne). */
async function marquer(a: Actor, key: string, statut: "Présent" | "Retard" | "Excusé" | "Absent") {
    const ligne = a.page.locator("tr").filter({ hasText: eleve(key).nom }).filter({ hasText: eleve(key).prenom }).first();
    await ligne.getByRole("button", { name: new RegExp(`^${statut}`, "i") }).click();
    await pause(a, 500);
}

async function ouvrirAppel(a: Actor, classe: string) {
    await goto(a, "/dashboard/attendance");
    await choose(a, a.page, /^classe$/i, classe);
    const date = a.page.getByLabel("Date de l'appel");
    await date.fill(JOUR_APPEL);
    await date.press("Tab");
    await a.page.waitForLoadState("networkidle").catch(() => undefined);
    await pause(a, 1500);
}

async function enregistrerAppel(a: Actor) {
    await a.page.getByRole("button", { name: /enregistrer l.appel|enregistrer/i }).last().click();
    await expect(a.page.getByText(/appel enregistré|enregistré/i).first()).toBeVisible({ timeout: 20_000 });
    await pause(a, 1500);
}

test("01 · appel de la 6ème A par le professeur de mathématiques", async ({ browser }) => {
    const prof = await acteur(browser, "01-appel-college", "prof-maths", "Koffi Dossou (enseignant)");
    try {
        await step(prof, "Feuille d'appel : aucune classe choisie", async () => explorePage(prof, "/dashboard/attendance"));
        await step(prof, `6ème A, ${JOUR_APPEL} : liste des élèves`, async () => {
            await ouvrirAppel(prof, "6ème A");
            for (const k of ["eleve-kate", "eleve-ismael", "eleve-divine", "eleve-junior"]) {
                await expect(prof.page.getByText(eleve(k).nom).first()).toBeVisible();
            }
        });
        await step(prof, "Recherche d'un élève dans la feuille", async () => {
            const search = prof.page.getByRole("searchbox", { name: /rechercher un élève dans la classe/i });
            await search.fill("ZINS");
            await pause(prof, 1200);
            await search.fill("");
        });
        await step(prof, "« Tous présents » : un appel sans absent peut être enregistré", async () => {
            await prof.page.getByRole("button", { name: /tous présents/i }).click();
            await pause(prof, 800);
            const enregistrer = prof.page.getByRole("button", { name: /enregistrer|aucune modification/i }).last();
            constat(prof, "Bouton d'enregistrement après « Tous présents »", (await enregistrer.innerText()).trim());
            await expect(enregistrer, "une classe entièrement présente doit pouvoir être enregistrée").toBeEnabled({ timeout: 3000 });
        });
        await step(prof, `${nomComplet("eleve-divine")} absente, ${nomComplet("eleve-ismael")} en retard (observation)`, async () => {
            await marquer(prof, "eleve-divine", "Absent");
            await marquer(prof, "eleve-ismael", "Retard");
            await prof.page.locator("tr").filter({ hasText: eleve("eleve-ismael").nom }).first().getByRole("textbox").fill("Arrivé à 8 h 25, embouteillage à Fidjrossè");
            await pause(prof, 800);
        });
        await step(prof, "Enregistrement de l'appel", async () => enregistrerAppel(prof), { critical: true });
        await step(prof, "Rechargement : l'appel est conservé", async () => {
            await ouvrirAppel(prof, "6ème A");
            const ligne = prof.page.locator("tr").filter({ hasText: eleve("eleve-divine").nom }).first();
            await expect(ligne.getByRole("button", { name: /^absent/i })).toHaveAttribute("aria-pressed", "true");
        });
        await step(prof, "Correction : Ismaël finalement excusé, réenregistrement", async () => {
            await marquer(prof, "eleve-ismael", "Excusé");
            await enregistrerAppel(prof);
        });
    } finally {
        await prof.close();
    }

    const boites = await openActor(browser, { etape: ETAPE, scenario: "01-appel-college", name: "boites-de-reception", label: "Boîtes de réception des familles" });
    try {
        await step(boites, `SMS d'absence reçu par ${eleve("eleve-divine").responsable.firstName} Zinsou`, async () => {
            const sms = await showSms(boites, eleve("eleve-divine").responsable.phone);
            constat(boites, "SMS reçus par le parent de Divine", sms.map((s) => s.message).join(" | ") || "aucun");
            expect(sms.length, "au moins un SMS d'absence").toBeGreaterThan(0);
        });
        await step(boites, "Courriel d'absence reçu par le parent de Divine", async () => {
            const m = await showMail(boites, mail("parent-zinsou"), /absen/i);
            constat(boites, "Courriel reçu", m.subject);
        });
    } finally {
        await boites.close();
    }
});

test("02 · appel du CM2 A (primaire) par l'instituteur", async ({ browser }) => {
    const instit = await acteur(browser, "02-appel-primaire", "instit-cm2", "Romaric Dègla (instituteur CM2)");
    try {
        await step(instit, `CM2 A, ${JOUR_APPEL}`, async () => ouvrirAppel(instit, "CM2 A"));
        await step(instit, `Tous présents sauf ${nomComplet("eleve-emmanuel")} (absent)`, async () => {
            await instit.page.getByRole("button", { name: /tous présents/i }).click();
            await marquer(instit, "eleve-emmanuel", "Absent");
            await enregistrerAppel(instit);
        });
        await step(instit, "Impression de la feuille d'appel", async () => {
            await instit.page.evaluate(() => {
                (window as unknown as { print: () => void }).print = () => document.body.setAttribute("data-imprime", "1");
            });
            await instit.page.getByRole("button", { name: /^imprimer$/i }).click();
            await expect(instit.page.locator("body")).toHaveAttribute("data-imprime", "1");
        });
    } finally {
        await instit.close();
    }
});

test("03 · le parent voit l'absence et la justifie", async ({ browser }) => {
    const parent = await acteur(browser, "03-justification-parent", "parent-zinsou", "Célestin Zinsou (parent, deux enfants)");
    try {
        await step(parent, "Notifications : absence signalée", async () => explorePage(parent, "/dashboard/notifications"));
        await step(parent, "Accueil : absences de ses deux enfants", async () => {
            await goto(parent, "/dashboard");
            await scrollThrough(parent);
        });
        await step(parent, "Assiduité de ses enfants", async () => explorePage(parent, "/dashboard/attendance"));
        await step(parent, "Justification de l'absence de Divine (certificat)", async () => {
            const bouton = parent.page.getByRole("button", { name: /justifier/i }).first();
            await expect(bouton, "un bouton « Justifier » doit être proposé au parent").toBeVisible({ timeout: 15_000 });
            await bouton.click();
            await pause(parent, 800);
            const zone = parent.page.getByRole("dialog").or(parent.page.locator("main")).last();
            await zone.getByRole("textbox").first().fill("Fièvre, consultation au centre de santé de Kpota. Certificat remis au secrétariat.");
            await zone.getByRole("button", { name: /envoyer|justifier|valider|enregistrer/i }).last().click();
            await expect(parent.page.getByText(/justifi/i).first()).toBeVisible();
        });
        await step(parent, "Cahier de liaison", async () => explorePage(parent, "/dashboard/liaison"));
    } finally {
        await parent.close();
    }
});

test("04 · la direction suit l'assiduité et traite les justificatifs", async ({ browser }) => {
    const dir = await acteur(browser, "04-suivi-direction", "directeur-cocotiers", "Clarisse Hounkpatin (directrice des études)");
    try {
        await step(dir, "Feuille d'appel de la 6ème A du jour (lecture)", async () => ouvrirAppel(dir, "6ème A"));
        await step(dir, "Justificatifs en attente : validation", async () => {
            await goto(dir, "/dashboard/attendance");
            await scrollThrough(dir);
            const valider = dir.page.getByRole("button", { name: /valider|accepter|approuver/i }).first();
            await expect(valider, "le justificatif du parent doit être proposé à la validation").toBeVisible({ timeout: 15_000 });
            await valider.click();
            await pause(dir, 2000);
        });
        await step(dir, `Fiche de ${nomComplet("eleve-divine")} : assiduité`, async () => explorePage(dir, etat.get("url:eleve-divine")));
        await step(dir, "Risques de décrochage", async () => explorePage(dir, "/dashboard/risks/dropout"));
        await step(dir, "Alertes élèves à risque", async () => explorePage(dir, "/dashboard/alerts/risks"));
        await step(dir, "Alertes : bouton « Profil » d'un élève", async () => {
            const profil = dir.page.getByRole("button", { name: /^profil$/i }).first();
            if (!(await profil.isVisible().catch(() => false))) {
                constat(dir, "Aucune alerte affichée", "bouton « Profil » non testable");
                return;
            }
            await expectEffect(dir, profil, "« Profil »");
        });
    } finally {
        await dir.close();
    }
});

test("05 · incident signalé par un enseignant, sanction puis clôture par la direction", async ({ browser }) => {
    const cible = eleve("eleve-junior");
    const prof = await acteur(browser, "05-incident-et-sanction", "prof-francais", "Awa Hountondji (enseignante)");
    try {
        await step(prof, "Formulaire d'incident soumis vide : refus", async () => {
            await goto(prof, "/dashboard/incidents/new");
            await prof.page.getByRole("button", { name: /enregistrer|signaler|déclarer|créer/i }).last().click();
            await pause(prof, 1500);
            await expect(prof.page).toHaveURL(/incidents\/new/);
        }, { refusAttendu: true });
        await step(prof, `Incident : ${cible.prenom} ${cible.nom}, perturbation de cours (gravité moyenne)`, async () => {
            await goto(prof, "/dashboard/incidents/new");
            await choose(prof, prof.page, /élève concerné/i, cible.nom);
            await choose(prof, prof.page, /type d'incident/i, "Perturbation de cours");
            await choose(prof, prof.page, /gravité/i, "Moyen");
            await prof.page.getByLabel(/date et heure/i).fill(`${JOUR_APPEL}T10:40`);
            await prof.page.getByLabel(/lieu de l'incident/i).fill("Salle 101");
            await prof.page.getByLabel(/description détaillée/i).fill("Bavardages répétés et refus de ranger son téléphone malgré trois rappels pendant le cours de français.");
            await prof.page.getByLabel(/mesure\(s\) conservatoire/i).fill("Téléphone confisqué jusqu'à la fin de la journée");
            await pause(prof, 800);
            await prof.page.getByRole("button", { name: /enregistrer|signaler|déclarer|créer/i }).last().click();
            await prof.page.waitForURL((u) => !u.pathname.endsWith("/incidents/new"), { timeout: 20_000 });
        }, { critical: true });
        await step(prof, "Liste des incidents : recherche", async () => {
            await goto(prof, "/dashboard/incidents");
            await expect(prof.page.getByText(cible.nom).first()).toBeVisible();
            await prof.page.getByPlaceholder(/rechercher un élève/i).first().fill(cible.nom);
            await pause(prof, 1500);
        });
    } finally {
        await prof.close();
    }

    const dir = await acteur(browser, "05-incident-et-sanction", "admin-cocotiers", "Direction Les Cocotiers");
    try {
        await step(dir, "Discipline : tableau de bord", async () => explorePage(dir, "/dashboard/discipline"));
        await step(dir, "« Nouveau rapport » depuis la discipline", async () => {
            await goto(dir, "/dashboard/discipline");
            await expectEffect(dir, dir.page.getByRole("button", { name: /nouveau rapport/i }).first(), "« Nouveau rapport »");
        });
        await step(dir, "Incident déclaré par la direction si l'enseignante n'a pas pu le faire", async () => {
            await goto(dir, "/dashboard/incidents");
            if (await dir.page.getByText(cible.nom).first().isVisible().catch(() => false)) {
                constat(dir, "Incident déjà déclaré par l'enseignante", "aucune reprise nécessaire");
                return;
            }
            await goto(dir, "/dashboard/incidents/new");
            await choose(dir, dir.page, /élève concerné/i, cible.nom);
            await choose(dir, dir.page, /type d'incident/i, "Perturbation de cours");
            await choose(dir, dir.page, /gravité/i, "Moyen");
            await dir.page.getByLabel(/date et heure/i).fill(`${JOUR_APPEL}T10:40`);
            await dir.page.getByLabel(/lieu de l'incident/i).fill("Salle 101");
            await dir.page.getByLabel(/description détaillée/i).fill("Signalé oralement par Mme Hountondji : bavardages répétés et refus de ranger son téléphone.");
            await dir.page.getByRole("button", { name: /enregistrer|signaler|déclarer|créer/i }).last().click();
            await dir.page.waitForURL((u) => !u.pathname.endsWith("/incidents/new"), { timeout: 20_000 });
        });
        await step(dir, "Ouverture de l'incident", async () => {
            await goto(dir, "/dashboard/incidents");
            await dir.page.getByRole("link", { name: /ouvrir l'incident/i }).or(dir.page.getByRole("button", { name: /ouvrir l'incident/i })).first().click();
            await dir.page.waitForURL(/\/incidents\/[^/]+$/);
            etat.set("url:incident-junior", new URL(dir.page.url()).pathname);
            await scrollThrough(dir);
        });
        await step(dir, "Sanction : retenue le mercredi après-midi", async () => {
            await dir.page.getByRole("button", { name: /nouvelle sanction disciplinaire/i }).click();
            await pause(dir, 800);
            await choose(dir, dir.page, /type de sanction/i, /retenue|consigne/i);
            await dir.page.getByLabel("Description de la sanction").fill("Retenue de 2 heures, travail écrit sur le respect des règles de la classe.");
            await dir.page.getByLabel("Date de début de la sanction").fill("2026-09-30");
            await dir.page.getByLabel("Date de fin de la sanction").fill("2026-09-30");
            await dir.page.getByRole("button", { name: /valider la sanction/i }).click();
            await pause(dir, 2000);
            await expect(dir.page.getByText(/retenue/i).first()).toBeVisible();
        });
        await step(dir, "Clôture du dossier avec conclusions", async () => {
            await dir.page.getByRole("button", { name: /clôturer le dossier/i }).click();
            await dir.page.getByLabel("Notes de clôture de l'incident").fill("Entretien avec le tuteur le 29/09. Engagement écrit de l'élève. Dossier clos.");
            await dir.page.getByRole("button", { name: /confirmer la clôture/i }).click();
            await pause(dir, 2000);
            await expect(dir.page.getByText(/clôtur|résolu/i).first()).toBeVisible();
        });
        await step(dir, "Liste des incidents après clôture", async () => {
            await goto(dir, "/dashboard/incidents");
            await scrollThrough(dir);
        });
    } finally {
        await dir.close();
    }
});

test("06 · infirmerie et dossier médical", async ({ browser }) => {
    const dir = await acteur(browser, "06-infirmerie", "admin-cocotiers", "Direction Les Cocotiers");
    try {
        await step(dir, "Infirmerie : registre des élèves", async () => explorePage(dir, "/dashboard/medical"));
        await step(dir, `Dossier médical de ${nomComplet("eleve-kate")}`, async () => {
            await dir.page.getByRole("textbox", { name: /rechercher un élève/i }).fill(eleve("eleve-kate").nom);
            await pause(dir, 1500);
            await dir.page.getByText(eleve("eleve-kate").nom).first().click();
            await pause(dir, 2000);
            await scrollThrough(dir);
        });
        await step(dir, "Saisie : groupe sanguin, allergie", async () => {
            const zone = dir.page.getByRole("dialog").or(dir.page.locator("main")).last();
            const edit = zone.getByRole("button", { name: /modifier|compléter|éditer|mettre à jour|ajouter/i }).first();
            if (await edit.isVisible().catch(() => false)) await edit.click();
            await pause(dir, 800);
            const champs = dir.page.getByRole("dialog").or(dir.page.locator("main")).last();
            const groupe = champs.getByLabel(/groupe sanguin/i).first();
            await expect(groupe, "champ « groupe sanguin » du dossier médical").toBeVisible({ timeout: 10_000 });
            const tag = await groupe.evaluate((e) => e.tagName);
            if (tag === "SELECT") await groupe.selectOption({ label: "O+" }).catch(async () => groupe.selectOption({ index: 1 }));
            else if ((await groupe.getAttribute("role")) === "combobox") await choose(dir, champs, /groupe sanguin/i, /O\s?\+/);
            else await groupe.fill("O+");
            const allergies = champs.getByLabel(/allergi/i).first();
            if (await allergies.isVisible().catch(() => false)) await allergies.fill("Arachides");
            await champs.getByRole("button", { name: /enregistrer|sauvegarder|valider/i }).last().click();
            await pause(dir, 2000);
        });
        await step(dir, "Passage à l'infirmerie", async () => {
            const passage = dir.page.getByRole("button", { name: /passage|visite|consultation|nouvelle/i }).first();
            await expect(passage, "bouton pour enregistrer un passage à l'infirmerie").toBeVisible({ timeout: 10_000 });
            await passage.click();
            await pause(dir, 1500);
        });
    } finally {
        await dir.close();
    }
});

test("07 · contrôle d'accès, badges QR et cartes scolaires", async ({ browser }) => {
    const dir = await acteur(browser, "07-controle-acces-et-cartes", "admin-cocotiers", "Direction Les Cocotiers");
    const page = dir.page;
    try {
        for (const p of [
            { nom: "Portail principal", type: /entrée|portail|entry|./i, lieu: "Entrée rue Haie Vive" },
            { nom: "Cantine", type: /cantine|restau|./i, lieu: "Bâtiment B, RDC" },
        ]) {
            await step(dir, `Point de scan « ${p.nom} »`, async () => {
                await goto(dir, "/dashboard/access-control");
                await page.getByRole("button", { name: /nouveau point de scan/i }).click();
                const d = page.getByRole("dialog", { name: /nouveau point de scan/i });
                await d.getByPlaceholder("Portail principal").fill(p.nom);
                await choose(dir, d, /type de point de scan/i, p.type);
                await d.getByPlaceholder("Bâtiment A, RDC").fill(p.lieu);
                await d.getByRole("button", { name: /^créer$/i }).click();
                await expect(d).toBeHidden({ timeout: 20_000 });
                await expect(page.getByText(p.nom).first()).toBeVisible();
            });
        }
        await step(dir, "Régénération des badges de la 6ème A", async () => {
            await page.getByRole("button", { name: /régénérer badges classe/i }).click();
            await pause(dir, 1000);
            const d = page.getByRole("dialog");
            if (await d.count()) {
                await choose(dir, d.last(), /classe/i, "6ème A");
                await d.last().getByRole("button", { name: /régénérer|confirmer|valider/i }).last().click();
            }
            await pause(dir, 2500);
        });
        await step(dir, "Point de scan : impression activée", async () => {
            await scrollThrough(dir);
            await expect(page.getByRole("button", { name: /^imprimer$/i }), "« Imprimer » actif une fois un point de scan créé").toBeEnabled({ timeout: 10_000 });
        });
        await step(dir, "Badge : date de validité conforme à l'année scolaire (30 juin 2027)", async () => {
            const texte = await page.locator("main").innerText();
            constat(dir, "Validité affichée sur le badge", texte.match(/valide jusqu'au[^\n]*/i)?.[0] ?? "(non affichée)");
            expect(texte, "le badge doit être valable jusqu'à la fin de l'année 2026-2027").toMatch(/valide jusqu'au[^\n]*2027/i);
        });
        await step(dir, "Cartes scolaires de la 6ème A (depuis la fiche de la classe)", async () => {
            await goto(dir, etat.get("url:classe:cocotiers:6ème A"));
            const popup = dir.context.waitForEvent("page", { timeout: 15_000 });
            await page.getByRole("button", { name: /cartes scolaires/i }).click();
            const cartes = await popup;
            await cartes.waitForLoadState("networkidle").catch(() => undefined);
            await cartes.waitForTimeout(2500);
            await cartes.screenshot({ path: `${dir.dir}/admin-cocotiers-cartes-scolaires-6eme-a.png`, fullPage: true });
            await expect(cartes.getByText(eleve("eleve-kate").nom).first(), "la carte de Kate doit apparaître").toBeVisible();
            await cartes.close();
        });
    } finally {
        await dir.close();
    }
});

test("08 · cellule d'écoute (signalements) et rendez-vous parent-école", async ({ browser }) => {
    const prof = await acteur(browser, "08-ecoute-et-rendez-vous", "prof-svt", "Estelle Gbaguidi (enseignante)");
    try {
        await step(prof, "Signalement enseignant, priorité P1", async () => {
            await goto(prof, "/dashboard/wellbeing/new");
            await prof.page.getByRole("radio", { name: /^enseignant/i }).click();
            await choose(prof, prof.page, /catégorie/i, /./);
            await prof.page.getByRole("textbox", { name: /description du signalement/i }).fill("Élève de Tle D isolée, pleure en classe depuis une semaine, résultats en chute.");
            await prof.page.getByRole("button", { name: /ouvrir le dossier|envoyer le signalement/i }).click();
            await prof.page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 20_000 });
        });
    } finally {
        await prof.close();
    }
    const gloria = await acteur(browser, "08-ecoute-et-rendez-vous", "eleve-gloria", "Gloria Akakpo (élève de Tle D)");
    try {
        await step(gloria, "Signalement anonyme par une élève", async () => {
            await goto(gloria, "/dashboard/wellbeing/new");
            await gloria.page.getByRole("radio", { name: /^anonyme/i }).click();
            await choose(gloria, gloria.page, /catégorie/i, /./);
            await gloria.page.getByRole("textbox", { name: /description du signalement/i }).fill("Moqueries répétées sur les réseaux sociaux par des élèves de la classe.");
            await gloria.page.getByRole("button", { name: /ouvrir le dossier|envoyer le signalement/i }).click();
            await gloria.page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 20_000 });
        });
    } finally {
        await gloria.close();
    }
    const dir = await acteur(browser, "08-ecoute-et-rendez-vous", "admin-cocotiers", "Direction Les Cocotiers");
    try {
        await step(dir, "Dossier ouvert par la direction (signalement remonté oralement)", async () => {
            await goto(dir, "/dashboard/wellbeing/new");
            await dir.page.getByRole("radio", { name: /^enseignant/i }).click();
            await choose(dir, dir.page, /catégorie/i, /./);
            await dir.page.getByRole("textbox", { name: /description du signalement/i }).fill("Remonté par Mme Gbaguidi : élève de Tle D isolée, pleure en classe depuis une semaine.");
            await dir.page.getByRole("button", { name: /ouvrir le dossier/i }).click();
            await dir.page.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 20_000 });
        });
        await step(dir, "Cellule d'écoute : dossiers reçus", async () => explorePage(dir, "/dashboard/wellbeing"));
        await step(dir, "Dossier : prise en charge", async () => {
            await dir.page.locator('main a[href*="/dashboard/wellbeing/"]:not([href$="/new"])').first().click();
            await dir.page.waitForURL(/wellbeing\/[^/]+$/);
            await scrollThrough(dir);
            const action = dir.page.getByRole("button", { name: /prendre en charge|assigner|mettre à jour|statut|enregistrer/i }).first();
            if (await action.isVisible().catch(() => false)) await action.click();
            await pause(dir, 1500);
        });
        await step(dir, "« Rapport climat »", async () => {
            await goto(dir, "/dashboard/wellbeing");
            await expectEffect(dir, dir.page.getByRole("button", { name: /rapport climat/i }), "« Rapport climat »");
        });
    } finally {
        await dir.close();
    }
    const parent = await acteur(browser, "08-ecoute-et-rendez-vous", "parent-agbossou", "Fabrice Agbossou (parent de Kate)");
    try {
        await step(parent, "Demande de rendez-vous avec le professeur principal", async () => {
            await explorePage(parent, "/dashboard/appointments");
            const demander = parent.page.getByRole("button", { name: /demander|nouveau|prendre rendez-vous/i }).first();
            await expect(demander, "un parent doit pouvoir demander un rendez-vous").toBeVisible({ timeout: 10_000 });
            await demander.click();
        });
    } finally {
        await parent.close();
    }
    const dir2 = await acteur(browser, "08-ecoute-et-rendez-vous", "admin-cocotiers", "Direction Les Cocotiers (agenda)", "admin-cocotiers-agenda");
    try {
        await step(dir2, "Agenda des rendez-vous : filtres et export CSV", async () => {
            await goto(dir2, "/dashboard/appointments");
            for (const f of ["En attente", "Confirmé", "Terminé", "Annulé", "Tous"]) {
                await dir2.page.getByRole("button", { name: new RegExp(`^${f}$`) }).click();
                await pause(dir2, 700);
            }
            await expectEffect(dir2, dir2.page.getByRole("button", { name: /exporter csv/i }), "« Exporter CSV »");
        });
    } finally {
        await dir2.close();
    }
});
