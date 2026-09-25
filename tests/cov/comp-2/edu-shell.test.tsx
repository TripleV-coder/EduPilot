// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { screen, cleanup, fireEvent, waitFor, within, act, render } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { signOut } from "next-auth/react";

vi.mock("next/navigation", async () => (await import("../../pages/harness")).navigationMock);
vi.mock("@/components/providers/school-provider", async () => (await import("../../pages/harness")).schoolMock);

// Contexte de la barre latérale contrôlé par le test (le vrai contexte n'est pas exporté).
const sidebar = vi.hoisted(() => ({
    isOpen: true,
    isMobileOpen: false,
    toggle: (() => {}) as () => void,
    setIsMobileOpen: ((_v: boolean) => {}) as (v: boolean) => void,
}));
vi.mock("@/components/dashboard/DashboardLayoutClient", () => ({
    useSidebar: () => sidebar,
    SIDEBAR_EXPANDED_WIDTH: 220,
    SIDEBAR_COLLAPSED_WIDTH: 56,
}));

import { asRole, mockApi, renderPage, resetHarness, navigation, school, type Role } from "../../pages/harness";
import { EduCommandPalette } from "@/components/edu-shell/EduCommandPalette";
import { CommandPaletteProvider, useCommandPalette } from "@/components/edu-shell/CommandPaletteProvider";
import { EduTopBar } from "@/components/edu-shell/EduTopBar";
import { EduMobileNav } from "@/components/edu-shell/EduMobileNav";
import { EduSidebar } from "@/components/edu-shell/EduSidebar";
import {
    navGroupsForRole,
    navForRole,
    visibleNavGroups,
    isActiveLink,
    canUseAiAssistant,
    AI_ASSISTANT_NAV_LINK,
} from "@/components/edu-shell/role-nav";

beforeEach(() => {
    sidebar.isOpen = true;
    sidebar.isMobileOpen = false;
    sidebar.toggle = vi.fn();
    sidebar.setIsMobileOpen = vi.fn();
    navigation.push.mockClear();
});

afterEach(() => {
    cleanup();
    resetHarness();
    vi.mocked(signOut).mockReset();
    document.documentElement.classList.remove("dark");
    vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
describe("Palette de commandes (EduCommandPalette)", () => {
    it("n'affiche rien quand elle est fermée", () => {
        asRole("TEACHER");
        const { container } = renderPage(<EduCommandPalette open={false} onOpenChange={vi.fn()} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("liste les actions rapides de l'enseignant, sa navigation et donne le focus au champ", async () => {
        asRole("TEACHER");
        renderPage(<EduCommandPalette open onOpenChange={vi.fn()} />);
        const dialog = screen.getByRole("dialog", { name: "Palette de commandes" });
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(screen.getByRole("option", { name: /Faire l'appel/ })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: /Saisir des notes/ })).toBeInTheDocument();
        expect(screen.getByText("Navigation")).toBeInTheDocument();
        // La première option est présélectionnée.
        expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
        await waitFor(() => expect(screen.getByRole("textbox", { name: "Saisir une commande" })).toHaveFocus());
    });

    it.each<[Role, string]>([
        ["DIRECTOR", "Encaisser un paiement"],
        ["SCHOOL_ADMIN", "Voir les effectifs"],
        ["PARENT", "Payer les frais"],
        ["ACCOUNTANT", "Saisie comptable OHADA"],
    ])("propose l'action rapide propre au rôle %s", (role, label) => {
        asRole(role);
        renderPage(<EduCommandPalette open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("option", { name: new RegExp(label) })).toBeInTheDocument();
    });

    it("n'offre pas l'Assistant IA au comptable (page refusée par la garde)", () => {
        asRole("ACCOUNTANT");
        renderPage(<EduCommandPalette open onOpenChange={vi.fn()} />);
        expect(screen.queryByRole("option", { name: /Assistant IA/ })).not.toBeInTheDocument();
    });

    it("sans rôle connu, ne propose que les actions génériques", () => {
        asRole(null);
        renderPage(<EduCommandPalette open onOpenChange={vi.fn()} />);
        expect(screen.getByRole("option", { name: /Mon compte/ })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: /Se déconnecter/ })).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: /Assistant IA/ })).not.toBeInTheDocument();
    });

    it("masque les actions menant à un module éteint", () => {
        asRole("TEACHER");
        school.enabledModules = ["students", "grades"];
        renderPage(<EduCommandPalette open onOpenChange={vi.fn()} />);
        expect(screen.queryByRole("option", { name: /Faire l'appel/ })).not.toBeInTheDocument();
        expect(screen.getByRole("option", { name: /Saisir des notes/ })).toBeInTheDocument();
    });

    it("filtre par saisie et ajoute la recherche d'élèves, puis y navigue", async () => {
        asRole("TEACHER");
        const onOpenChange = vi.fn();
        renderPage(<EduCommandPalette open onOpenChange={onOpenChange} />);
        const input = screen.getByRole("textbox", { name: "Saisir une commande" });
        fireEvent.change(input, { target: { value: "zzz introuvable" } });
        // Aucune action ne correspond : seule la recherche élève reste.
        const options = screen.getAllByRole("option");
        expect(options).toHaveLength(1);
        expect(options[0]).toHaveTextContent("Rechercher « zzz introuvable » dans les élèves");
        expect(screen.getByText("Recherche")).toBeInTheDocument();
        fireEvent.keyDown(document, { key: "Enter" });
        expect(navigation.push).toHaveBeenCalledWith("/dashboard/students?search=zzz%20introuvable");
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("navigue au clavier avec les flèches et exécute avec Entrée", () => {
        asRole("TEACHER");
        const onOpenChange = vi.fn();
        renderPage(<EduCommandPalette open onOpenChange={onOpenChange} />);
        fireEvent.keyDown(document, { key: "ArrowUp" }); // reste sur le premier
        expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");
        fireEvent.keyDown(document, { key: "ArrowDown" });
        const opts = screen.getAllByRole("option");
        expect(opts[1]).toHaveAttribute("aria-selected", "true");
        expect(opts[0]).toHaveAttribute("aria-selected", "false");
        // Descendre au-delà de la fin reste sur la dernière option.
        for (let i = 0; i < 100; i++) fireEvent.keyDown(document, { key: "ArrowDown" });
        const last = screen.getAllByRole("option").at(-1)!;
        expect(last).toHaveAttribute("aria-selected", "true");
        // La dernière entrée est le dernier lien de navigation (son indice = son chemin).
        const href = navForRole("TEACHER").at(-1)!.href;
        expect(last).toHaveTextContent(href);
        fireEvent.keyDown(document, { key: "Enter" });
        expect(navigation.push).toHaveBeenCalledWith(href);
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("« Aide & support » mène aux paramètres", () => {
        asRole("TEACHER");
        renderPage(<EduCommandPalette open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole("option", { name: /Aide & support/ }));
        expect(navigation.push).toHaveBeenCalledWith("/dashboard/settings");
    });

    it("sélectionne au survol et exécute au clic", () => {
        asRole("TEACHER");
        renderPage(<EduCommandPalette open onOpenChange={vi.fn()} />);
        const opt = screen.getByRole("option", { name: /Saisir des notes/ });
        fireEvent.mouseEnter(opt);
        expect(opt).toHaveAttribute("aria-selected", "true");
        fireEvent.click(opt);
        expect(navigation.push).toHaveBeenCalledWith("/dashboard/grades/entry");
    });

    it("déconnecte via l'action « Se déconnecter »", () => {
        asRole("PARENT");
        renderPage(<EduCommandPalette open onOpenChange={vi.fn()} />);
        fireEvent.click(screen.getByRole("option", { name: /Se déconnecter/ }));
        expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
        expect(navigation.push).not.toHaveBeenCalled();
    });

    it("se ferme avec Échap ou un clic sur le voile et rend le focus au déclencheur", async () => {
        asRole("TEACHER");
        const onOpenChange = vi.fn();
        const trigger = document.createElement("button");
        trigger.textContent = "déclencheur";
        document.body.appendChild(trigger);
        trigger.focus();
        const view = renderPage(<EduCommandPalette open={false} onOpenChange={onOpenChange} />);
        view.rerender(<EduCommandPalette open onOpenChange={onOpenChange} />);
        await waitFor(() => expect(screen.getByRole("textbox")).toHaveFocus());
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onOpenChange).toHaveBeenCalledWith(false);
        await waitFor(() => expect(trigger).toHaveFocus());

        onOpenChange.mockClear();
        const overlay = screen.getByRole("dialog").querySelector("[aria-hidden]") as HTMLElement;
        fireEvent.click(overlay);
        expect(onOpenChange).toHaveBeenCalledWith(false);
        trigger.remove();
    });

    it("piège le focus avec Tab et Maj+Tab dans le panneau", () => {
        asRole("TEACHER");
        renderPage(<EduCommandPalette open onOpenChange={vi.fn()} />);
        const input = screen.getByRole("textbox");
        const options = screen.getAllByRole("option");
        const last = options.at(-1)!;
        last.focus();
        fireEvent.keyDown(document, { key: "Tab" });
        expect(input).toHaveFocus();
        fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
        expect(last).toHaveFocus();
        // Au milieu : le navigateur garde la main.
        options[1].focus();
        fireEvent.keyDown(document, { key: "Tab" });
        expect(options[1]).toHaveFocus();
        // Une autre touche est ignorée par le piège.
        fireEvent.keyDown(document, { key: "a" });
        expect(options[1]).toHaveFocus();
    });
});

// ─────────────────────────────────────────────────────────────────────────
function PaletteProbe() {
    const p = useCommandPalette();
    return (
        <div>
            <span data-testid="etat">{p.isOpen ? "ouverte" : "fermée"}</span>
            <button onClick={p.open}>ouvrir</button>
            <button onClick={p.close}>refermer</button>
            <button onClick={p.toggle}>basculer</button>
        </div>
    );
}

describe("CommandPaletteProvider", () => {
    it("hors fournisseur, le hook renvoie des fonctions neutres", () => {
        render(<PaletteProbe />);
        expect(screen.getByTestId("etat")).toHaveTextContent("fermée");
        fireEvent.click(screen.getByText("ouvrir"));
        fireEvent.click(screen.getByText("refermer"));
        fireEvent.click(screen.getByText("basculer"));
        expect(screen.getByTestId("etat")).toHaveTextContent("fermée");
    });

    it("ne charge la palette qu'à la première ouverture, puis Ctrl+K la bascule", async () => {
        asRole("TEACHER");
        renderPage(
            <CommandPaletteProvider>
                <PaletteProbe />
            </CommandPaletteProvider>,
        );
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.keyDown(document, { key: "k", ctrlKey: true });
        expect(screen.getByTestId("etat")).toHaveTextContent("ouverte");
        expect(await screen.findByRole("dialog", { name: "Palette de commandes" })).toBeInTheDocument();
        // Cmd+K (Mac) referme.
        fireEvent.keyDown(document, { key: "K", metaKey: true });
        expect(screen.getByTestId("etat")).toHaveTextContent("fermée");
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        // « k » seul ne fait rien.
        fireEvent.keyDown(document, { key: "k" });
        expect(screen.getByTestId("etat")).toHaveTextContent("fermée");
    });

    it("Ctrl+K fonctionne aussi depuis un champ de saisie ; les boutons du contexte pilotent l'état", async () => {
        asRole("TEACHER");
        renderPage(
            <CommandPaletteProvider>
                <input aria-label="champ" />
                <PaletteProbe />
            </CommandPaletteProvider>,
        );
        const field = screen.getByLabelText("champ");
        fireEvent.keyDown(field, { key: "k", ctrlKey: true });
        expect(screen.getByTestId("etat")).toHaveTextContent("ouverte");
        await screen.findByRole("dialog");
        // Échap dans la palette passe par onOpenChange du fournisseur.
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.getByTestId("etat")).toHaveTextContent("fermée");
        fireEvent.click(screen.getByText("basculer"));
        expect(screen.getByTestId("etat")).toHaveTextContent("ouverte");
        fireEvent.click(screen.getByText("refermer"));
        expect(screen.getByTestId("etat")).toHaveTextContent("fermée");
        fireEvent.click(screen.getByText("ouvrir"));
        expect(screen.getByTestId("etat")).toHaveTextContent("ouverte");
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Barre du haut (EduTopBar)", () => {
    it("affiche l'utilisateur, son rôle, le raccourci Ctrl+K et la pastille de notifications non lues", async () => {
        asRole("TEACHER", { name: "Awa Houénou" });
        const api = mockApi({ "GET /api/notifications": { unreadCount: 3 } });
        renderPage(<EduTopBar />);
        expect(screen.getByText("Awa Houénou")).toBeInTheDocument();
        expect(screen.getByText("Enseignant")).toBeInTheDocument();
        expect(screen.getByText("Ctrl+K")).toBeInTheDocument();
        const bell = screen.getByRole("link", { name: "Notifications" });
        expect(bell).toHaveAttribute("href", "/dashboard/notifications");
        await waitFor(() => expect(bell.querySelector("span.absolute")).not.toBeNull());
        expect(api.calls("GET /api/notifications")[0].url).toBe("/api/notifications?unread=true&limit=1");
        expect(screen.getByRole("link", { name: /Assistant IA/ })).toHaveAttribute("href", "/dashboard/ai");
    });

    it("sans session : libellés par défaut, pas d'appel réseau, pas de lien IA", () => {
        asRole(null);
        const api = mockApi({});
        renderPage(<EduTopBar />);
        expect(screen.getByText("Utilisateur")).toBeInTheDocument();
        expect(screen.getByText("Vie scolaire")).toBeInTheDocument();
        expect(api.calls()).toHaveLength(0);
        expect(screen.queryByRole("link", { name: /Assistant IA/ })).not.toBeInTheDocument();
    });

    it("affiche le code de rôle brut s'il est inconnu, et aucune pastille sans non-lus", async () => {
        asRole("TEACHER", { role: "INVITE", name: "" });
        const api = mockApi({ "GET /api/notifications": {} });
        renderPage(<EduTopBar />);
        expect(screen.getByText("INVITE")).toBeInTheDocument();
        await waitFor(() => expect(api.calls()).toHaveLength(1));
        expect(screen.getByRole("link", { name: "Notifications" }).querySelector("span.absolute")).toBeNull();
    });

    it("affiche ⌘K sur Mac", () => {
        vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh; Intel Mac OS X)");
        asRole("PARENT");
        mockApi({ "GET /api/notifications": { unreadCount: 0 } });
        renderPage(<EduTopBar />);
        expect(screen.getByText("⌘K")).toBeInTheDocument();
    });

    it("le bouton menu ouvre le tiroir sur mobile et replie la barre sur grand écran", () => {
        asRole("DIRECTOR");
        mockApi({ "GET /api/notifications": {} });
        renderPage(<EduTopBar />);
        const btn = screen.getByRole("button", { name: "Ouvrir ou replier le menu" });
        const original = window.innerWidth;
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 500 });
        fireEvent.click(btn);
        expect(sidebar.setIsMobileOpen).toHaveBeenCalledWith(true);
        expect(sidebar.toggle).not.toHaveBeenCalled();
        Object.defineProperty(window, "innerWidth", { configurable: true, value: 1280 });
        fireEvent.click(btn);
        expect(sidebar.toggle).toHaveBeenCalledTimes(1);
        Object.defineProperty(window, "innerWidth", { configurable: true, value: original });
    });

    it("bascule le thème clair/sombre et met à jour le libellé", () => {
        asRole("DIRECTOR");
        mockApi({ "GET /api/notifications": {} });
        renderPage(<EduTopBar />);
        fireEvent.click(screen.getByRole("button", { name: "Passer en mode sombre" }));
        expect(document.documentElement).toHaveClass("dark");
        fireEvent.click(screen.getByRole("button", { name: "Passer en mode clair" }));
        expect(document.documentElement).not.toHaveClass("dark");
        expect(screen.getByRole("button", { name: "Passer en mode sombre" })).toBeInTheDocument();
    });

    it("le champ de recherche ouvre la palette de commandes", async () => {
        asRole("TEACHER");
        mockApi({ "GET /api/notifications": {} });
        renderPage(
            <CommandPaletteProvider>
                <EduTopBar />
            </CommandPaletteProvider>,
        );
        fireEvent.click(screen.getByRole("button", { name: "Ouvrir la palette de commandes" }));
        expect(await screen.findByRole("dialog", { name: "Palette de commandes" })).toBeInTheDocument();
    });

    it("suit la connectivité : pastille « en ligne » retirée hors ligne", () => {
        asRole("TEACHER", { name: "Kossi" });
        mockApi({ "GET /api/notifications": {} });
        renderPage(<EduTopBar />);
        const profile = screen.getByRole("link", { name: /Kossi/ });
        const dots = () => profile.querySelectorAll('span[style*="border-radius: 50%"]').length;
        expect(dots()).toBe(1);
        act(() => {
            window.dispatchEvent(new Event("offline"));
        });
        expect(dots()).toBe(0);
        act(() => {
            window.dispatchEvent(new Event("online"));
        });
        expect(dots()).toBe(1);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Navigation mobile (EduMobileNav)", () => {
    it("ne s'affiche pas sans session", () => {
        asRole(null);
        const { container } = renderPage(<EduMobileNav />);
        expect(container).toBeEmptyDOMElement();
    });

    it.each<[Role, string[]]>([
        ["PARENT", ["Accueil", "Enfants", "Paiements", "IA", "Menu"]],
        ["STUDENT", ["Accueil", "Notes", "Devoirs", "IA", "Menu"]],
        ["TEACHER", ["Accueil", "Appel", "Notes", "IA", "Menu"]],
        ["ACCOUNTANT", ["Accueil", "Finance", "Portefeuille", "Menu"]],
        ["SUPER_ADMIN", ["Réseau", "Écoles", "Utilisateurs", "IA", "Menu"]],
        ["DIRECTOR", ["Accueil", "Élèves", "Finance", "IA", "Menu"]],
        ["STAFF", ["Accueil", "Élèves", "Finance", "Menu"]],
    ])("présente les entrées adaptées au rôle %s (IA seulement si autorisée)", (role, labels) => {
        asRole(role);
        const { container } = renderPage(<EduMobileNav />);
        // Masquée par la media query hors mobile : on la localise par son libellé ARIA.
        const nav = container.querySelector('nav[aria-label="Navigation mobile"]') as HTMLElement;
        const items = within(nav).getAllByRole("listitem", { hidden: true }).map((li) => li.textContent);
        expect(items).toEqual(labels);
    });

    it("marque la page courante (préfixe) avec aria-current et ouvre le menu complet", () => {
        asRole("TEACHER");
        navigation.pathname = "/dashboard/attendance/today";
        renderPage(<EduMobileNav />);
        expect(screen.getByRole("link", { name: "Appel", hidden: true })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("link", { name: "Accueil", hidden: true })).not.toHaveAttribute("aria-current");
        fireEvent.click(screen.getByRole("button", { name: "Ouvrir Menu", hidden: true }));
        expect(sidebar.setIsMobileOpen).toHaveBeenCalledWith(true);
    });

    it("l'accueil n'est actif que sur la correspondance exacte", () => {
        asRole("PARENT");
        navigation.pathname = "/dashboard";
        renderPage(<EduMobileNav />);
        expect(screen.getByRole("link", { name: "Accueil", hidden: true })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("link", { name: "Paiements", hidden: true })).not.toHaveAttribute("aria-current");
    });

    it("aucune entrée active si le chemin est inconnu", () => {
        asRole("PARENT");
        navigation.pathname = null as unknown as string;
        renderPage(<EduMobileNav />);
        expect(screen.getAllByRole("link", { hidden: true }).every((l) => !l.hasAttribute("aria-current"))).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe("Barre latérale (EduSidebar)", () => {
    it("déployée : titres de groupes, rôle, école, période et compteurs abrégés", async () => {
        asRole("SUPER_ADMIN");
        navigation.pathname = "/dashboard/users/42";
        const api = mockApi({ "GET /api/dashboard/nav-counts": { networkSchools: 12, networkUsers: 1534, networkAlerts: 0 } });
        renderPage(<EduSidebar />);
        const nav = screen.getByRole("navigation", { name: "Navigation principale" });
        expect(screen.getByText("Super Admin")).toBeInTheDocument();
        expect(screen.getByText("Collège Saint-Michel")).toBeInTheDocument();
        expect(screen.getByText("1er Trimestre")).toBeInTheDocument();
        expect(within(nav).getByRole("link", { name: /Utilisateurs/ })).toHaveAttribute("aria-current", "page");
        expect(await within(nav).findByText("1.5k")).toBeInTheDocument();
        expect(within(nav).getByText("12")).toBeInTheDocument();
        expect(api.calls("GET /api/dashboard/nav-counts")[0].url).toBe("/api/dashboard/nav-counts?role=SUPER_ADMIN");
    });

    it("repliée : pas de libellés, infobulle title sur les liens, valeurs par défaut de l'école", () => {
        asRole(null);
        sidebar.isOpen = false;
        school.schoolName = null;
        navigation.pathname = "" as string;
        const api = mockApi({});
        renderPage(<EduSidebar />);
        expect(api.calls()).toHaveLength(0);
        expect(screen.queryByText("EduPilot", { selector: "div" })).not.toBeInTheDocument();
        const links = within(screen.getByRole("navigation")).getAllByRole("link");
        expect(links.length).toBeGreaterThan(0);
        for (const l of links) expect(l).toHaveAttribute("title");
        expect(screen.queryByText("Établissement")).not.toBeInTheDocument();
    });

    it("déployée sans nom d'école ni période : libellés par défaut", () => {
        asRole("STAFF");
        school.schoolName = null;
        school.currentPeriodName = null;
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        renderPage(<EduSidebar />);
        expect(screen.getByText("Établissement")).toBeInTheDocument();
        expect(screen.getByText("Année en cours")).toBeInTheDocument();
        school.currentPeriodName = "1er Trimestre";
    });

    it("affiche le code de rôle brut s'il est inconnu", () => {
        asRole("TEACHER", { role: "INVITE" });
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        renderPage(<EduSidebar />);
        expect(screen.getByText("INVITE")).toBeInTheDocument();
    });

    it("tiroir mobile : Échap, clic sur le voile, clic sur un lien et le logo le ferment", () => {
        asRole("TEACHER");
        sidebar.isMobileOpen = true;
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        const { container } = renderPage(<EduSidebar />);
        fireEvent.keyDown(window, { key: "Enter" });
        expect(sidebar.setIsMobileOpen).not.toHaveBeenCalled();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(sidebar.setIsMobileOpen).toHaveBeenLastCalledWith(false);
        const overlay = container.querySelector('div[aria-hidden="false"]') as HTMLElement;
        fireEvent.click(overlay);
        const nav = screen.getByRole("navigation", { name: "Navigation principale" });
        fireEvent.click(within(nav).getAllByRole("link")[0]);
        fireEvent.click(screen.getByTitle("EduPilot"));
        expect(sidebar.setIsMobileOpen).toHaveBeenCalledTimes(4);
    });

    it("tiroir fermé : Échap n'a aucun effet", () => {
        asRole("TEACHER");
        mockApi({ "GET /api/dashboard/nav-counts": {} });
        renderPage(<EduSidebar />);
        fireEvent.keyDown(window, { key: "Escape" });
        expect(sidebar.setIsMobileOpen).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────────
describe("role-nav : navigation par rôle", () => {
    const ROLES = ["SUPER_ADMIN", "NETWORK_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF", "INCONNU", null, undefined];

    it.each(ROLES)("le rôle %s a une navigation non vide, sans lien IA s'il n'y a pas droit", (role) => {
        const links = navForRole(role);
        expect(links.length).toBeGreaterThan(0);
        const hasAi = links.includes(AI_ASSISTANT_NAV_LINK);
        if (!canUseAiAssistant(role)) expect(hasAi).toBe(false);
        for (const g of navGroupsForRole(role)) expect(g.links.length).toBeGreaterThan(0);
    });

    it("filtre par cycle et par module", () => {
        const all = visibleNavGroups("DIRECTOR", [], []);
        expect(all).toEqual(navGroupsForRole("DIRECTOR"));
        const primaire = visibleNavGroups("DIRECTOR", ["PRIMARY"], null).flatMap((g) => g.links);
        expect(primaire.every((l) => !l.requiresCycle || l.requiresCycle === "PRIMARY")).toBe(true);
        const sansIa = visibleNavGroups("TEACHER", null, ["students"]).flatMap((g) => g.links);
        expect(sansIa).not.toContain(AI_ASSISTANT_NAV_LINK);
    });

    it("isActiveLink : chemin vide, préfixe et correspondance exacte", () => {
        const link = { icon: "grid" as const, label: "x", href: "/dashboard/x", matchPrefix: true };
        expect(isActiveLink("", link)).toBe(false);
        expect(isActiveLink("/dashboard/x/1", link)).toBe(true);
        expect(isActiveLink("/dashboard/xy", link)).toBe(false);
        expect(isActiveLink("/dashboard/x/1", { ...link, matchPrefix: false })).toBe(false);
        expect(isActiveLink("/dashboard/x", { ...link, matchPrefix: false })).toBe(true);
    });
});
