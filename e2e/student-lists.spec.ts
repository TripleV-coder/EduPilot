import { test, expect } from "@playwright/test";

/**
 * N18 — listes d'élèves vides sur cinq écrans.
 *
 * `/api/students` renvoie `{ data, pagination }` ; l'appel, le médical, les
 * documents, la déclaration d'incident et l'enregistrement d'un paiement
 * lisaient une clé `students` qui n'existe pas : liste toujours vide, donc
 * appel, incident et paiement impossibles depuis l'interface. Les E2E
 * existants ne vérifiaient que l'affichage de la page.
 *
 * Compte : administrateur de Saint-Michel (storageState par défaut), école
 * seedée avec des classes et des élèves inscrits.
 */
test.describe("Listes d'élèves (N18)", () => {
    test("appel : choisir une classe affiche ses élèves", async ({ page }) => {
        await page.goto("/dashboard/attendance");
        const classSelect = page.getByLabel("Classe");
        await expect(classSelect.locator("option").nth(1)).toBeAttached();
        await classSelect.selectOption({ index: 1 });

        await expect(page.getByLabel(/^Observation pour /).first()).toBeVisible();
        await expect(page.getByText("Aucun élève à afficher")).toHaveCount(0);
    });

    test("médical : la liste des élèves est proposée", async ({ page }) => {
        await page.goto("/dashboard/medical");
        await expect(page.getByRole("button", { name: /^Ouvrir le dossier médical de / }).first()).toBeVisible();
        await expect(page.getByText("Aucun élève trouvé.")).toHaveCount(0);
    });

    test("documents : des élèves sont disponibles", async ({ page }) => {
        await page.goto("/dashboard/documents");
        await expect(page.getByLabel("Sélectionner un élève")).toBeVisible();
        await expect(page.getByText("Aucun élève disponible")).toHaveCount(0);
    });

    test("nouvel incident : le sélecteur propose des élèves", async ({ page }) => {
        await page.goto("/dashboard/incidents/new");
        const trigger = page.getByRole("combobox").filter({ hasText: /Sélectionner un élève/ });
        await expect(trigger).toBeVisible();
        await trigger.click();
        await expect(page.getByRole("option").first()).toBeVisible();
    });

    test("nouveau paiement : la recherche d'élève trouve des élèves", async ({ page }) => {
        await page.goto("/dashboard/finance/payments/new");
        await page.getByLabel("Rechercher un élève").fill("agb");
        // Résultats : liste défilante sous le champ (éléments cliquables sans rôle)
        await expect(page.locator("div.max-h-60").getByText(/agbossou/i).first()).toBeVisible();
    });
});
