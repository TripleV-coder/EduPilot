// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", async () => (await import("./harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("./harness")).schoolMock);

import { asRole, mockApi, renderPage, resetHarness, apiError } from "./harness";
import RootFinancePage from "@/app/(dashboard)/dashboard/root-control/finance/page";

const SUMMARY = {
  summary: { totalMonthlyRevenue: 450000, activeTenants: 3, averageRevenuePerTenant: 150000, collectionRate: 87.5 },
  distribution: [
    { name: "Essentiel", count: 2 },
    { name: "Premium", count: 1 },
  ],
  recentPayments: [{ id: "p1", schoolName: "CEG Akpakpa", amount: 150000, paidAt: "2026-09-01T10:00:00.000Z" }],
};

afterEach(() => {
  cleanup();
  resetHarness();
});

describe("Page Finances plateforme", () => {
  it("affiche les indicateurs réels, sans tendance inventée", async () => {
    asRole("SUPER_ADMIN");
    mockApi({ "GET /api/root/finance/summary": SUMMARY });
    renderPage(<RootFinancePage />);

    expect(await screen.findByText("Chiffre d'affaires mensuel (MRR)")).toBeInTheDocument();
    expect(screen.getByText("87,5 %")).toBeInTheDocument();
    expect(screen.getByText("Sur 3 établissements actifs")).toBeInTheDocument();
    // Part calculée sur le total de la répartition, pas sur une constante.
    expect(screen.getByText("2 écoles · 67 %")).toBeInTheDocument();
    expect(screen.getByText("CEG Akpakpa")).toBeInTheDocument();
    expect(screen.queryByText(/vs mois dernier/)).not.toBeInTheDocument();
    // Boutons sans action retirés.
    expect(screen.queryByRole("button", { name: /Rapport annuel/ })).not.toBeInTheDocument();
  });

  it("n'affiche pas de faux zéros en cas d'erreur", async () => {
    asRole("SUPER_ADMIN");
    mockApi({ "GET /api/root/finance/summary": apiError(500) });
    renderPage(<RootFinancePage />);

    expect(await screen.findByText("Impossible de charger les chiffres de la plateforme.")).toBeInTheDocument();
    expect(screen.queryByText(/FCFA/)).not.toBeInTheDocument();
  });

  it("affiche un état vide quand aucune école n'a d'abonnement", async () => {
    asRole("SUPER_ADMIN");
    mockApi({
      "GET /api/root/finance/summary": {
        ...SUMMARY,
        summary: { ...SUMMARY.summary, activeTenants: 0 },
        distribution: [],
        recentPayments: [],
      },
    });
    renderPage(<RootFinancePage />);

    expect(await screen.findByText("Aucun abonnement actif")).toBeInTheDocument();
    expect(screen.getByText("Aucune transaction récente disponible.")).toBeInTheDocument();
  });
});
