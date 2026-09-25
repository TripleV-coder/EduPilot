// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", async () => (await import("../pages/harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("../pages/harness")).schoolMock);

import { mockApi, renderPage, resetHarness, apiError } from "../pages/harness";
import { PricingSection, annualSavingPercent } from "@/components/landing/PricingSection";

const PLANS = [
  { id: "a", code: "ESS", name: "Essentiel", description: "Pour démarrer", maxStudents: 100, maxTeachers: 5, maxStorageGB: 5, features: ["Bulletins"], priceMonthly: 0, priceYearly: 0, isFeatured: false, priceOnRequest: false },
  { id: "b", code: "PRO", name: "Professionnel", description: null, maxStudents: 800, maxTeachers: 60, maxStorageGB: 20, features: ["SMS parents"], priceMonthly: 25000, priceYearly: 240000, isFeatured: true, priceOnRequest: false },
  { id: "c", code: "ENT", name: "Entreprise", description: null, maxStudents: 5000, maxTeachers: 400, maxStorageGB: 200, features: [], priceMonthly: null, priceYearly: null, isFeatured: false, priceOnRequest: true },
];

// framer-motion (whileInView) s'appuie sur IntersectionObserver, absent de jsdom.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", NoopObserver);
});

afterEach(() => {
  cleanup();
  resetHarness();
});

describe("annualSavingPercent", () => {
  it("calcule la remise réelle de l'annuel", () => {
    expect(annualSavingPercent({ priceMonthly: 25000, priceYearly: 240000 })).toBe(20);
    expect(annualSavingPercent({ priceMonthly: 0, priceYearly: 0 })).toBe(0);
    expect(annualSavingPercent({ priceMonthly: null, priceYearly: null })).toBe(0);
  });
});

describe("PricingSection", () => {
  it("affiche les plans configurés en base, pas des tarifs figés", async () => {
    mockApi({ "GET /api/public/plans": { data: PLANS } });
    renderPage(<PricingSection />);

    expect(await screen.findByRole("heading", { name: "Professionnel" })).toBeInTheDocument();
    expect(screen.getByText("Gratuit")).toBeInTheDocument();
    expect(screen.getByText("Sur devis")).toBeInTheDocument();
    // Annuel par défaut : 240 000 / 12 = 20 000 par mois, remise calculée.
    expect(screen.getByText("20 000")).toBeInTheDocument();
    expect(screen.getByText("Jusqu'à −20 %")).toBeInTheDocument();
    expect(screen.getByText("Jusqu'à 800 élèves")).toBeInTheDocument();
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(expect.arrayContaining(["/setup?plan=ESS", "/setup?plan=PRO", "/setup?plan=ENT"]));
  });

  it("repasse au prix mensuel via la bascule", async () => {
    mockApi({ "GET /api/public/plans": { data: PLANS } });
    renderPage(<PricingSection />);
    await screen.findByRole("heading", { name: "Professionnel" });
    fireEvent.click(screen.getByRole("switch", { name: "Facturation annuelle" }));
    expect(screen.getByText("25 000")).toBeInTheDocument();
  });

  it("propose de réessayer si les tarifs ne se chargent pas", async () => {
    mockApi({ "GET /api/public/plans": apiError(500) });
    renderPage(<PricingSection />);
    expect(await screen.findByRole("button", { name: /Réessayer/ })).toBeInTheDocument();
  });

  it("reste honnête quand aucun plan n'est en vente", async () => {
    mockApi({ "GET /api/public/plans": { data: [] } });
    renderPage(<PricingSection />);
    expect(await screen.findByText(/communiqués sur demande/)).toBeInTheDocument();
  });
});
