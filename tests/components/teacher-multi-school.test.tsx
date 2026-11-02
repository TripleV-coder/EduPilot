// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SWRConfig } from "swr";

const setActiveSchoolId = vi.fn();
vi.mock("@/components/providers/school-provider", () => ({
    useSchool: () => ({ schoolId: "school-a", setActiveSchoolId }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { MySchoolsCard } from "@/components/teachers/my-schools-card";
import { TeacherInvitationsPanel } from "@/components/teachers/teacher-invitations-panel";

type Handler = (url: string, init?: RequestInit) => { status?: number; body: unknown };
function serve(handler: Handler) {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const { status = 200, body } = handler(String(input), init);
            return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
        }),
    );
}
const fresh = (ui: React.ReactElement) => render(<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{ui}</SWRConfig>);

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setActiveSchoolId.mockReset();
});

describe("Mes établissements (enseignant)", () => {
    it("liste l'école principale (non quittable) et une école rattachée (quittable, ouvrable)", async () => {
        serve(() => ({
            body: {
                teacherId: "t1",
                schools: [
                    { id: "school-a", name: "CEG Akpakpa", primary: true, since: null },
                    { id: "school-b", name: "Collège Saint-Joseph", primary: false, since: "2026-10-01T00:00:00.000Z" },
                ],
            },
        }));
        fresh(<MySchoolsCard />);
        expect(await screen.findByText("Collège Saint-Joseph")).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "Quitter" })).toHaveLength(1);
        fireEvent.click(screen.getByRole("button", { name: "Ouvrir" }));
        expect(setActiveSchoolId).toHaveBeenCalledWith("school-b");
        expect(screen.getByRole("link", { name: /Mes disponibilités/ })).toHaveAttribute("href", "/dashboard/my-availability");
    });

    it("affiche le motif d'un code refusé", async () => {
        serve((url, init) =>
            init?.method === "POST"
                ? { status: 400, body: { error: "Code invalide ou expiré. Demandez un nouveau code à l'établissement." } }
                : { body: { teacherId: "t1", schools: [] } },
        );
        fresh(<MySchoolsCard />);
        const input = await screen.findByLabelText("Code d'invitation de l'établissement");
        fireEvent.change(input, { target: { value: "k7m2q-prxa9" } });
        expect(input).toHaveValue("K7M2Q-PRXA9");
        fireEvent.click(screen.getByRole("button", { name: "Rejoindre" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Code invalide ou expiré");
    });
});

describe("Enseignants d'autres établissements (direction)", () => {
    it("montre le code créé une seule fois, puis les codes en circulation sans leur valeur", async () => {
        let created = false;
        serve((url, init) => {
            if (init?.method === "POST") {
                created = true;
                return { status: 201, body: { id: "inv1", code: "K7M2Q-PRXA9", expiresAt: "2026-11-09T10:00:00.000Z" } };
            }
            return {
                body: {
                    invitations: created ? [{ id: "inv1", createdAt: "2026-11-02T10:00:00.000Z", expiresAt: "2026-11-09T10:00:00.000Z" }] : [],
                    members: [{ teacherId: "t1", name: "Koffi Multi", email: "k@x.bj", primarySchoolName: "CEG Akpakpa", since: null }],
                },
            };
        });
        fresh(<TeacherInvitationsPanel />);
        expect(await screen.findByText("Koffi Multi")).toBeInTheDocument();
        expect(screen.getByText("École principale : CEG Akpakpa")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Créer un code" }));
        expect(await screen.findByText("K7M2Q-PRXA9")).toBeInTheDocument();
        expect(await screen.findByText("Codes en circulation · 1")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Retirer" }));
        expect(screen.getByRole("button", { name: "Confirmer le retrait" })).toBeInTheDocument();
    });
});
