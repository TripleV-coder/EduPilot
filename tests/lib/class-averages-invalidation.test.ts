import { afterEach, describe, expect, it, vi } from "vitest";
import { computeClassAnnual, computeClassPeriod } from "@/lib/academic/class-averages";
import { emitModelWrite } from "@/lib/db/write-events";

/**
 * Les moyennes de classe partagées (calcul unique par classe) s'invalident
 * d'elles-mêmes à chaque écriture d'une donnée qui entre dans une moyenne.
 */
describe("moyennes de classe partagées — invalidation automatique", () => {
    afterEach(() => vi.restoreAllMocks());

    it.each(["Grade", "Evaluation", "EvaluationType", "ClassSubject", "Enrollment", "ClassCouncil", "StudentFormula", "Period", "ExternalPeriodAverage", "ConfigOption"])(
        "une écriture sur %s vide les moyennes de période et d'année",
        (model) => {
            const period = vi.spyOn(computeClassPeriod, "clear");
            const annual = vi.spyOn(computeClassAnnual, "clear");
            emitModelWrite(model);
            expect(period).toHaveBeenCalledTimes(1);
            expect(annual).toHaveBeenCalledTimes(1);
        },
    );

    it("une écriture sans rapport (messagerie) garde le cache", () => {
        const period = vi.spyOn(computeClassPeriod, "clear");
        emitModelWrite("Message");
        expect(period).not.toHaveBeenCalled();
    });
});
