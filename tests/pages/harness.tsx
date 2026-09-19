/**
 * Harnais commun des tests de pages et de composants client.
 *
 * Usage (dans un fichier « // @vitest-environment jsdom ») :
 *
 *   vi.mock("next/navigation", async () => (await import("../pages/harness")).navigationMock);
 *   vi.mock("@/components/providers/school-provider", async () => (await import("../pages/harness")).schoolMock);
 *   import { asRole, mockApi, renderPage, navigation, school } from "../pages/harness";
 *
 *   asRole("TEACHER");                       // session next-auth (useSession)
 *   const api = mockApi({ "GET /api/classes": { data: [] }, "POST /api/x": (req) => ({ ok: true }) });
 *   renderPage(<Page />);                     // SWR isolé, dédoublonnage désactivé
 *   expect(api.calls("POST /api/x")[0].body).toEqual({...});
 *
 * Le vrai PageGuard reste actif : il lit la session posée par asRole().
 */
import { vi } from "vitest";
import type { ReactElement } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { SWRConfig } from "swr";
import { useSession } from "next-auth/react";

// ── Navigation ────────────────────────────────────────────────────────────
export const navigation = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    pathname: "/dashboard",
    params: {} as Record<string, string>,
    searchParams: new URLSearchParams(),
};

export const navigationMock = {
    useRouter: () => ({
        push: navigation.push,
        replace: navigation.replace,
        back: navigation.back,
        refresh: navigation.refresh,
        prefetch: navigation.prefetch,
        forward: vi.fn(),
    }),
    usePathname: () => navigation.pathname,
    useParams: () => navigation.params,
    useSearchParams: () => navigation.searchParams,
    redirect: vi.fn((url: string) => {
        throw new Error(`redirect:${url}`);
    }),
    notFound: vi.fn(() => {
        throw new Error("notFound");
    }),
};

// ── École active (SchoolProvider) ─────────────────────────────────────────
export const school = {
    schoolId: "school-a" as string | null,
    academicYearId: "year-1" as string | null,
    periodId: "period-1" as string | null,
    setAcademicYearId: vi.fn(),
    setPeriodId: vi.fn(),
    setActiveSchoolId: vi.fn(async () => {}),
    schoolName: "Collège Saint-Michel" as string | null,
    currentPeriodName: "1er Trimestre" as string | null,
    accessibleSchools: [] as Array<{ id: string; name: string; code: string; isActive: boolean }>,
    offeredLevels: [] as string[],
    enabledModules: [] as string[],
    isLoading: false,
    isSwitchingSchool: false,
    error: null as unknown,
    isOffline: false,
};

export const schoolMock = {
    useSchool: () => school,
    SchoolProvider: ({ children }: { children: React.ReactNode }) => children,
};

// ── Session ───────────────────────────────────────────────────────────────
export type Role =
    | "SUPER_ADMIN" | "NETWORK_ADMIN" | "SCHOOL_ADMIN" | "DIRECTOR" | "TEACHER"
    | "STUDENT" | "PARENT" | "ACCOUNTANT" | "STAFF";

export function asRole(role: Role | null, overrides: Record<string, unknown> = {}) {
    const data = role
        ? {
              user: {
                  id: `user-${role.toLowerCase()}`,
                  email: `${role.toLowerCase()}@ecole.test`,
                  name: `Test ${role}`,
                  firstName: "Test",
                  lastName: role,
                  role,
                  roles: [role],
                  schoolId: school.schoolId,
                  accessibleSchoolIds: school.schoolId ? [school.schoolId] : [],
                  isTwoFactorEnabled: false,
                  isTwoFactorAuthenticated: false,
                  ...overrides,
              },
              expires: new Date(Date.now() + 3_600_000).toISOString(),
          }
        : null;
    vi.mocked(useSession).mockReturnValue({
        data,
        status: role ? "authenticated" : "unauthenticated",
        update: vi.fn(async () => data),
    } as unknown as ReturnType<typeof useSession>);
    return data;
}

// ── API simulée ───────────────────────────────────────────────────────────
type Handler = unknown | ((req: { url: string; method: string; body: unknown; query: URLSearchParams }) => unknown);
type Route = { status?: number; body: Handler };

export interface ApiCall {
    method: string;
    url: string;
    path: string;
    query: URLSearchParams;
    body: unknown;
}

/**
 * Clés : « GET /api/x » (chemin exact, requête ignorée) ou « GET /api/x?y=1 »
 * (requête exacte). Valeur : corps JSON, fonction, ou { status, body } via
 * apiError()/apiStatus(). Toute route non déclarée répond 404 et est notée.
 */
export function mockApi(routes: Record<string, Handler | Route> = {}) {
    const calls: ApiCall[] = [];
    const unmatched: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const url = new URL(raw, "http://localhost");
        const method = (init?.method ?? "GET").toUpperCase();
        let body: unknown = undefined;
        if (typeof init?.body === "string") {
            try {
                body = JSON.parse(init.body);
            } catch {
                body = init.body;
            }
        } else if (init?.body !== undefined) {
            body = init.body;
        }
        calls.push({ method, url: `${url.pathname}${url.search}`, path: url.pathname, query: url.searchParams, body });
        const exact = routes[`${method} ${url.pathname}${url.search}`];
        const byPath = routes[`${method} ${url.pathname}`];
        const route = exact !== undefined ? exact : byPath;
        if (route === undefined) {
            unmatched.push(`${method} ${url.pathname}${url.search}`);
            return jsonResponse({ error: "Not found (mockApi)" }, 404);
        }
        const isRoute = typeof route === "object" && route !== null && "__route" in (route as object);
        const status = isRoute ? (route as Route & { __route: true }).status ?? 200 : 200;
        const handler = isRoute ? (route as Route).body : route;
        const payload =
            typeof handler === "function"
                ? await (handler as (r: unknown) => unknown)({ url: raw, method, body, query: url.searchParams })
                : handler;
        if (payload instanceof Response) return payload;
        // Une fonction de route peut renvoyer apiStatus()/apiError() pour choisir son statut.
        if (payload && typeof payload === "object" && "__route" in (payload as object)) {
            const r = payload as Route;
            return jsonResponse(r.body, r.status ?? 200);
        }
        return jsonResponse(payload, status);
    });
    vi.stubGlobal("fetch", fetchMock);
    return {
        fetch: fetchMock,
        calls: (key?: string) =>
            key
                ? calls.filter((c) => `${c.method} ${c.path}` === key || `${c.method} ${c.url}` === key)
                : calls,
        unmatched,
    };
}

export function apiStatus(status: number, body: unknown = {}): Route & { __route: true } {
    return { __route: true, status, body };
}

export function apiError(status: number, error = "Erreur"): Route & { __route: true } {
    return apiStatus(status, { error });
}

function jsonResponse(payload: unknown, status: number): Response {
    const text = payload === undefined ? "" : JSON.stringify(payload);
    return new Response(text, { status, headers: { "Content-Type": "application/json" } });
}

// ── Rendu ─────────────────────────────────────────────────────────────────
export function renderPage(ui: ReactElement): RenderResult {
    return render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false, errorRetryCount: 0 }}>
            {ui}
        </SWRConfig>,
    );
}

/** Réinitialise l'état partagé entre deux tests (à appeler dans afterEach). */
export function resetHarness() {
    navigation.pathname = "/dashboard";
    navigation.params = {};
    navigation.searchParams = new URLSearchParams();
    Object.assign(school, {
        schoolId: "school-a",
        academicYearId: "year-1",
        periodId: "period-1",
        schoolName: "Collège Saint-Michel",
        offeredLevels: [],
        enabledModules: [],
        isLoading: false,
        error: null,
        accessibleSchools: [],
    });
    vi.unstubAllGlobals();
}
