// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PageError } from "@/components/layout/page-states";
import { FetchError } from "@/lib/http-error";

vi.mock("next/link", () => ({
    default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
        <a href={href} {...rest}>{children}</a>
    ),
}));

afterEach(cleanup);

/**
 * Audit AUD-12 : un refus d'accès s'affichait « Une erreur est survenue /
 * Réessayer » ; l'utilisateur réessayait en vain.
 */
describe("PageError selon le code HTTP", () => {
    it("403 : « Accès refusé », message du serveur, pas de Réessayer", () => {
        render(<PageError message="Impossible de charger les clubs." error={new FetchError(403, "Vous n'avez pas accès à cette fiche.")} onRetry={() => {}} />);
        expect(screen.getByText("Accès refusé")).toBeInTheDocument();
        expect(screen.getByText("Vous n'avez pas accès à cette fiche.")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Retour à l'accueil" })).toHaveAttribute("href", "/dashboard");
    });

    it("401 : session expirée avec lien de reconnexion", () => {
        render(<PageError message="x" error={new FetchError(401, "Votre session a expiré : reconnectez-vous.")} onRetry={() => {}} />);
        expect(screen.getByText("Session expirée")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Se reconnecter" })).toHaveAttribute("href", "/login");
    });

    it("panne (500) : erreur classique avec Réessayer", () => {
        render(<PageError message="Impossible de charger les clubs." error={new FetchError(500, "Erreur interne")} onRetry={() => {}} />);
        expect(screen.getByText("Une erreur est survenue")).toBeInTheDocument();
        expect(screen.getByText("Impossible de charger les clubs.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    });

    it("erreur sans code (chaîne d'état local) : comportement inchangé", () => {
        render(<PageError message="Erreur réseau" error="Erreur réseau" onRetry={() => {}} />);
        expect(screen.getByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    });
});
