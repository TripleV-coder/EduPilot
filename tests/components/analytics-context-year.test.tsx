// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { AnalyticsProvider, useAnalytics } from "@/components/analytics/AnalyticsContext";

/**
 * Audit R-CA-05 : au changement d'école, l'année de la nouvelle école n'est
 * connue qu'après le remontage de la page. Les filtres d'analyse doivent la
 * suivre (et non garder celle de l'école précédente), sauf choix explicite.
 */
function Probe() {
    const { academicYearId, setAcademicYearId } = useAnalytics();
    return (
        <>
            <span data-testid="year">{academicYearId}</span>
            <button onClick={() => setAcademicYearId("annee-choisie")}>choisir</button>
        </>
    );
}
const tree = (year?: string) => (
    <AnalyticsProvider initialAcademicYearId={year}>
        <Probe />
    </AnalyticsProvider>
);

afterEach(() => cleanup());

describe("AnalyticsProvider — année suivie tant qu'elle n'est pas choisie", () => {
    it("adopte l'année de l'établissement quand elle arrive après le montage", () => {
        const { rerender } = render(tree(undefined));
        expect(screen.getByTestId("year")).toHaveTextContent("ALL");
        rerender(tree("annee-B"));
        expect(screen.getByTestId("year")).toHaveTextContent("annee-B");
    });

    it("garde le choix explicite de la personne", () => {
        const { rerender } = render(tree("annee-B"));
        fireEvent.click(screen.getByText("choisir"));
        rerender(tree("annee-C"));
        expect(screen.getByTestId("year")).toHaveTextContent("annee-choisie");
    });
});
