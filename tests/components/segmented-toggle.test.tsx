// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SegmentedToggle } from "@/components/grades/cahier/components";

/**
 * Calendrier à 375 px (audit 2026-10-25) : l'onglet « Fériés » débordait et
 * était coupé. Les options passent désormais à la ligne ; l'option active est
 * annoncée aux lecteurs d'écran.
 */
const options = [
    { value: "month", label: "Mois", icon: "grid" },
    { value: "events", label: "Évènements", icon: "calendar" },
    { value: "holidays", label: "Vacances", icon: "sun" },
    { value: "public", label: "Fériés", icon: "tag" },
] as const;

afterEach(cleanup);

describe("SegmentedToggle", () => {
    it("option active annoncée (aria-pressed), changement au clic", () => {
        const onChange = vi.fn();
        render(<SegmentedToggle value="month" onChange={onChange} options={[...options]} />);
        expect(screen.getByRole("button", { name: "Mois" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("button", { name: "Fériés" })).toHaveAttribute("aria-pressed", "false");
        fireEvent.click(screen.getByRole("button", { name: "Fériés" }));
        expect(onChange).toHaveBeenCalledWith("public");
    });

    it("retour à la ligne autorisé et largeur bornée au conteneur (pas d'onglet coupé)", () => {
        render(<SegmentedToggle value="month" onChange={vi.fn()} options={[...options]} />);
        const group = screen.getByRole("button", { name: "Mois" }).parentElement!;
        expect(group).toHaveClass("flex-wrap", "max-w-full");
    });
});
