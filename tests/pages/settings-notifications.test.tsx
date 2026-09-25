// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", async () => (await import("./harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("./harness")).schoolMock);
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() } }));

import { asRole, mockApi, renderPage, resetHarness, apiError } from "./harness";
import NotificationsSettingsPage from "@/app/(dashboard)/dashboard/settings/notifications/page";

const PROFILE = { preferences: { theme: "dark", consents: { analytics: true } } };

afterEach(() => {
  cleanup();
  resetHarness();
  toastError.mockReset();
});

describe("Page Préférences de notifications", () => {
  it("n'envoie que la section notifications (le serveur fusionne)", async () => {
    asRole("PARENT");
    const api = mockApi({
      "GET /api/user/profile": PROFILE,
      "GET /api/notifications": { unreadCount: 0 },
      "PATCH /api/user/profile": { ok: true },
    });
    renderPage(<NotificationsSettingsPage />);

    const save = await screen.findByRole("button", { name: /Enregistrer les préférences/ });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(api.calls("PATCH /api/user/profile")).toHaveLength(1));
    const body = api.calls("PATCH /api/user/profile")[0].body as { preferences: Record<string, unknown> };
    expect(Object.keys(body.preferences)).toEqual(["notifications"]);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("signale un échec d'enregistrement au lieu d'afficher « enregistré »", async () => {
    asRole("PARENT");
    mockApi({
      "GET /api/user/profile": PROFILE,
      "GET /api/notifications": { unreadCount: 0 },
      "PATCH /api/user/profile": apiError(500),
    });
    renderPage(<NotificationsSettingsPage />);

    const save = await screen.findByRole("button", { name: /Enregistrer les préférences/ });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Vos préférences n'ont pas été enregistrées. Réessayez."));
  });

  it("bloque l'enregistrement tant que le profil n'est pas chargé", async () => {
    asRole("PARENT");
    mockApi({
      "GET /api/user/profile": apiError(500),
      "GET /api/notifications": { unreadCount: 0 },
    });
    renderPage(<NotificationsSettingsPage />);

    expect(await screen.findByText("Impossible de charger vos préférences.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enregistrer les préférences/ })).toBeDisabled();
  });
});
