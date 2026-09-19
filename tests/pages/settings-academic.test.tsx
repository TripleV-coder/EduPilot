// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", async () => (await import("./harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("./harness")).schoolMock);

import { asRole, mockApi, renderPage, resetHarness, apiStatus } from "./harness";
import AcademicSettingsPage from "@/app/(dashboard)/dashboard/settings/academic/page";

const OPEN = { id: "y1", name: "2025-2026", startDate: "2025-09-15", endDate: "2026-07-15", isCurrent: true, status: "ACTIVE" };
const CLOSED = { id: "y0", name: "2024-2025", startDate: "2024-09-15", endDate: "2025-07-15", isCurrent: false, status: "CLOSED" };

afterEach(() => {
  cleanup();
  resetHarness();
});

describe("Page Années académiques", () => {
  it("affiche le statut et propose Clôturer / Rouvrir selon le rôle", async () => {
    asRole("SCHOOL_ADMIN");
    mockApi({ "GET /api/academic-years": [OPEN, CLOSED] });
    renderPage(<AcademicSettingsPage />);
    expect(await screen.findByText("2025-2026")).toBeInTheDocument();
    expect(screen.getByText("Clôturée")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Clôturer/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rouvrir/ })).toBeInTheDocument();
  });

  it("un directeur clôture mais ne rouvre pas", async () => {
    asRole("DIRECTOR");
    mockApi({ "GET /api/academic-years": [OPEN, CLOSED] });
    renderPage(<AcademicSettingsPage />);
    expect(await screen.findByRole("button", { name: /Clôturer/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Rouvrir/ })).not.toBeInTheDocument();
  });

  it("demande confirmation quand des élèves ne sont pas promus, puis clôture avec force", async () => {
    asRole("SCHOOL_ADMIN");
    let attempt = 0;
    const api = mockApi({
      "GET /api/academic-years": () => (attempt >= 2 ? [{ ...OPEN, status: "CLOSED", isCurrent: false }] : [OPEN]),
      "PATCH /api/academic-years/y1/status": () => {
        attempt += 1;
        return attempt === 1
          ? apiStatus(409, { code: "ACTIVE_ENROLLMENTS", activeEnrollments: 4, error: "Élèves non promus" })
          : { id: "y1", status: "CLOSED" };
      },
    });
    renderPage(<AcademicSettingsPage />);
    fireEvent.click(await screen.findByRole("button", { name: /Clôturer/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Clôturer" }));

    // 409 : l'avertissement apparaît, le bouton devient « Clôturer quand même ».
    expect(await within(dialog).findByText(/4 inscription\(s\) sont encore actives/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Clôturer quand même" }));

    await waitFor(() => expect(api.calls("PATCH /api/academic-years/y1/status")).toHaveLength(2));
    const [first, second] = api.calls("PATCH /api/academic-years/y1/status");
    expect(first.body).toEqual({ action: "close", force: false });
    expect(second.body).toEqual({ action: "close", force: true });
    expect(await screen.findByText("Année 2025-2026 clôturée")).toBeInTheDocument();
  });

  it("affiche l'erreur de chargement", async () => {
    asRole("SCHOOL_ADMIN");
    mockApi({ "GET /api/academic-years": apiStatus(500, { error: "Base indisponible" }) });
    renderPage(<AcademicSettingsPage />);
    expect(await screen.findByText("Base indisponible")).toBeInTheDocument();
  });

  it("refuse l'accès sans permission de gestion d'école", async () => {
    asRole("PARENT");
    mockApi({});
    renderPage(<AcademicSettingsPage />);
    expect(await screen.findByRole("heading", { name: "Accès refusé" })).toBeInTheDocument();
  });
});
