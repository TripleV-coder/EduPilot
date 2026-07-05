// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SaveStatus } from "@/components/edu/save-status";

afterEach(cleanup);

describe("SaveStatus", () => {
    it("affiche l'état d'enregistrement en cours", () => {
        render(<SaveStatus status="saving" />);
        expect(screen.getByText("Enregistrement…")).toBeInTheDocument();
    });

    it("affiche l'heure d'enregistrement en état saved", () => {
        const at = new Date("2026-07-03T14:32:00");
        render(<SaveStatus status="saved" lastSavedAt={at} />);
        expect(screen.getByText(/Enregistré à/)).toBeInTheDocument();
    });

    it("affiche les modifications non enregistrées en état dirty", () => {
        render(<SaveStatus status="dirty" />);
        expect(screen.getByText("Modifications non enregistrées")).toBeInTheDocument();
    });

    it("affiche l'erreur et déclenche onRetry", () => {
        const onRetry = vi.fn();
        render(<SaveStatus status="error" error="Échec réseau" onRetry={onRetry} />);
        expect(screen.getByText("Échec réseau")).toBeInTheDocument();
        fireEvent.click(screen.getByText("Réessayer"));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("indique l'état hors ligne en priorité", () => {
        render(<SaveStatus status="saving" isOnline={false} />);
        expect(screen.getByText(/Hors ligne/)).toBeInTheDocument();
    });

    it("expose un role=status pour les lecteurs d'écran", () => {
        render(<SaveStatus status="saved" lastSavedAt={new Date()} />);
        expect(screen.getByRole("status")).toBeInTheDocument();
    });
});
