// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", async () => (await import("./harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("./harness")).schoolMock);
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

import { asRole, mockApi, renderPage, resetHarness, apiError, navigation } from "./harness";
import TeacherAvailabilityPage from "@/app/(dashboard)/dashboard/teachers/[teacherId]/availability/page";

const BASE = "/api/teachers/t1/availability";
const SLOTS = {
  availabilities: [
    { id: "a1", teacherId: "t1", dayOfWeek: 1, startTime: "08:00", endTime: "10:00", isActive: true },
    { id: "a2", teacherId: "t1", dayOfWeek: 2, startTime: "10:00", endTime: "12:00", isActive: true },
  ],
};

afterEach(() => {
  cleanup();
  resetHarness();
  toastError.mockReset();
});

async function editGrid() {
  // Retire lundi 08:00, ajoute mercredi 13:00 ; mardi 10:00 reste inchangé.
  fireEvent.click(await screen.findByRole("button", { name: "Lundi 08:00 : disponible" }));
  fireEvent.click(screen.getByRole("button", { name: "Mercredi 13:00 : indisponible" }));
  fireEvent.click(screen.getByRole("button", { name: /Enregistrer la grille/ }));
}

describe("Page Disponibilités enseignant", () => {
  it("n'envoie que la différence : les créneaux inchangés ne sont jamais supprimés", async () => {
    asRole("SCHOOL_ADMIN");
    const api = mockApi({ [`GET ${BASE}`]: SLOTS, [`DELETE ${BASE}`]: { ok: true }, [`POST ${BASE}`]: { id: "a3" } });
    // Segment lu par useParams (Next 16) — la prop `params` synchrone donnait undefined en production.
    navigation.params = { teacherId: "t1" };
    renderPage(<TeacherAvailabilityPage />);
    await editGrid();

    await waitFor(() => expect(api.calls(`POST ${BASE}`)).toHaveLength(1));
    const deletes = api.calls(`DELETE ${BASE}`);
    expect(deletes).toHaveLength(1);
    expect(deletes[0].query.get("availabilityId")).toBe("a1");
    expect(api.calls(`POST ${BASE}`)[0].body).toMatchObject({ dayOfWeek: 3, startTime: "13:00", endTime: "15:00" });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("signale un enregistrement incomplet et recharge l'état réel du serveur", async () => {
    asRole("SCHOOL_ADMIN");
    const api = mockApi({ [`GET ${BASE}`]: SLOTS, [`DELETE ${BASE}`]: { ok: true }, [`POST ${BASE}`]: apiError(500) });
    // Segment lu par useParams (Next 16) — la prop `params` synchrone donnait undefined en production.
    navigation.params = { teacherId: "t1" };
    renderPage(<TeacherAvailabilityPage />);
    await editGrid();

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/Enregistrement incomplet/);
    // Rechargement après l'échec : au moins un GET de plus que le chargement initial.
    await waitFor(() => expect(api.calls(`GET ${BASE}`).length).toBeGreaterThan(1));
  });
});
