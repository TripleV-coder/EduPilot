// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SWRConfig } from "swr";

/**
 * Audit R-CA-05 : pendant un changement d'école, les données de contexte
 * encore en cache sont celles de l'école précédente. Le fournisseur ne doit
 * jamais en déduire l'année scolaire de la nouvelle école (reproduit dans
 * Chrome : l'année de A partait avec les requêtes de B).
 */
const state = vi.hoisted(() => ({
    session: { user: { id: "u1", role: "TEACHER", schoolId: "ecole-B", isTwoFactorEnabled: false, mustChangePassword: false } },
    context: {} as Record<string, unknown>,
}));
const update = vi.hoisted(() => ({ fn: (() => Promise.resolve(null)) as (data?: unknown) => Promise<unknown> }));
vi.mock("next-auth/react", () => ({
    useSession: () => ({ data: state.session, status: "authenticated", update: (d?: unknown) => update.fn(d) }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("@/lib/fetcher", () => ({
    fetcher: vi.fn(async (url: string) => {
        if (url.startsWith("/api/schools/context")) return state.context;
        if (url.startsWith("/api/periods")) return [];
        return [];
    }),
}));

import { SchoolProvider, useSchool } from "@/components/providers/school-provider";

function Probe() {
    const { academicYearId, setActiveSchoolId } = useSchool();
    return (
        <>
            <span data-testid="year">{academicYearId ?? "aucune"}</span>
            <button onClick={() => void setActiveSchoolId("ecole-B")}>vers B</button>
        </>
    );
}

function renderProvider() {
    return render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
            <SchoolProvider>
                <Probe />
            </SchoolProvider>
        </SWRConfig>,
    );
}

beforeEach(() => {
    document.cookie = "edupilot_year_id=; max-age=0; path=/";
});
afterEach(() => {
    cleanup();
    state.session.user.schoolId = "ecole-B";
    update.fn = () => Promise.resolve(null);
});

describe("SchoolProvider — année scolaire de l'école active seulement", () => {
    it("ignore les années d'une autre école (données en cache de l'école précédente)", async () => {
        state.context = { activeSchoolId: "ecole-A", schools: [], academicYears: [{ id: "annee-A", name: "2025-2026", isCurrent: true }] };
        renderProvider();
        await new Promise((r) => setTimeout(r, 50));
        expect(screen.getByTestId("year")).toHaveTextContent("aucune");
    });

    it("sélectionne l'année courante de l'école active", async () => {
        state.context = { activeSchoolId: "ecole-B", schools: [], academicYears: [{ id: "annee-B", name: "2025-2026", isCurrent: true }] };
        renderProvider();
        await waitFor(() => expect(screen.getByTestId("year")).toHaveTextContent("annee-B"));
    });

    it("pendant la bascule vers B, ne resélectionne pas l'année de l'école quittée", async () => {
        state.session.user.schoolId = "ecole-A";
        state.context = { activeSchoolId: "ecole-A", schools: [], academicYears: [{ id: "annee-A", name: "2025-2026", isCurrent: true }] };
        update.fn = () => new Promise(() => {}); // mise à jour de session encore en cours
        renderProvider();
        await waitFor(() => expect(screen.getByTestId("year")).toHaveTextContent("annee-A"));

        fireEvent.click(screen.getByText("vers B"));
        await act(() => new Promise((r) => setTimeout(r, 100)));

        expect(screen.getByTestId("year")).toHaveTextContent("aucune");
    });
});
