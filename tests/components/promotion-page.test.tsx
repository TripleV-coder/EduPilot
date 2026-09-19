// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { ReactNode } from "react";
import { SWRConfig } from "swr";

import PromotionPage from "@/app/(dashboard)/dashboard/settings/academic/promotion/page";

/**
 * La page exigeait une année de destination (« Année cible requise ») sans
 * offrir aucun champ pour la choisir : la promotion de fin d'année était
 * impossible depuis l'interface.
 */
vi.mock("@/components/guard/page-guard", () => ({
  PageGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const CLASSES = { data: [{ id: "c6a", name: "6e A" }] };
const CURRENT = { id: "y25", name: "2025-2026", isCurrent: true, startDate: "2025-09-15" };
const PAST = { id: "y24", name: "2024-2025", isCurrent: false, startDate: "2024-09-15" };
const NEXT = { id: "y26", name: "2026-2027", isCurrent: false, startDate: "2026-09-15" };

function renderWithYears(years: unknown[]) {
  const responses: Record<string, unknown> = {
    "/api/classes": CLASSES,
    "/api/academic-years": years,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => responses[url] ?? [] })),
  );
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PromotionPage />
    </SWRConfig>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Page Promotion — année de destination", () => {
  it("propose un sélecteur quand une année postérieure existe", async () => {
    renderWithYears([PAST, CURRENT, NEXT]);
    expect(await screen.findByRole("combobox", { name: "Année académique de destination" })).toBeInTheDocument();
    expect(screen.queryByText(/Aucune année postérieure/)).not.toBeInTheDocument();
  });

  it("explique comment créer l'année suivante quand il n'y en a pas", async () => {
    renderWithYears([PAST, CURRENT]);
    const link = await screen.findByRole("link", { name: "Créez l'année suivante" });
    expect(link).toHaveAttribute("href", "/dashboard/settings/academic");
    expect(screen.queryByRole("combobox", { name: "Année académique de destination" })).not.toBeInTheDocument();
  });

  it("n'affiche plus de bouton « Clôturer l'année » sans effet", async () => {
    renderWithYears([CURRENT, NEXT]);
    await screen.findByRole("combobox", { name: "Année académique de destination" });
    expect(screen.queryByRole("button", { name: /Clôturer/ })).not.toBeInTheDocument();
  });
});
