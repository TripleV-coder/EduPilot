import { test, expect } from "@playwright/test";

/**
 * N25 — listes de classes illisibles sur trois écrans.
 *
 * `/api/classes` renvoie `{ data, pagination }` ; le nouvel emploi du temps
 * lisait `classes` (sélecteur vide), la page « matières par classe » et la
 * fiche de création d'évaluation traitaient la réponse comme un tableau
 * (section vide ; `.map` sur un objet à l'ouverture de la fiche).
 *
 * Compte : administrateur de Saint-Michel (storageState par défaut), école
 * seedée avec des classes.
 */
test.describe("Listes de classes (N25)", () => {
    test("nouvel emploi du temps : le sélecteur propose les classes", async ({ page }) => {
        await page.goto("/dashboard/schedule/new");
        const select = page.getByLabel("Sélectionner une classe");
        await expect(select).toBeVisible();
        await expect(select.locator("option:not([value=''])").first()).toBeAttached();
    });

    test("matières par classe : les classes sont proposées", async ({ page }) => {
        await page.goto("/dashboard/settings/class-subjects");
        await expect(page.getByText("Sélectionner une classe")).toBeVisible();
        await expect(page.getByText("Aucune classe disponible")).toHaveCount(0);
    });

    test("page Notes : la fiche « Nouvelle évaluation » s'ouvre et propose les classes", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));

        await page.goto("/dashboard/grades");
        await page.getByRole("button", { name: /Nouvelle évaluation/ }).first().click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await dialog.getByRole("combobox").first().click();
        await expect(page.getByRole("option").first()).toBeVisible();
        expect(errors).toEqual([]);
    });
});
