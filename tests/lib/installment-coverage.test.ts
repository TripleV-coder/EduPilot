import { describe, expect, it } from "vitest";
import { chronologicalCoverage } from "@/lib/finance/installment-coverage";

/**
 * Lot 3c — règle partagée par la route de paiement d'une échéance et l'écran
 * Finance (bouton « Encaisser ») : la même échéance, la plus ancienne non
 * soldée, et son reste, selon l'imputation chronologique de
 * syncPaymentPlanLedger.
 */
const inst = (id: string, amount: number, dueDate: string, status = "PENDING") => ({ id, amount, dueDate, status });
const next = (installments: ReturnType<typeof inst>[], settled: number) =>
    chronologicalCoverage(installments, settled).find((c) => c.outstanding > 0);

describe("chronologicalCoverage", () => {
    it("échéance en retard avant une échéance à venir : c'est elle qui se règle (l'écran sautait les échéances en retard)", () => {
        const plan = [inst("a", 25000, "2026-01-10", "OVERDUE"), inst("b", 25000, "2026-02-10", "PENDING")];
        expect(next(plan, 0)).toMatchObject({ installment: { id: "a" }, outstanding: 25000 });
    });

    it("couverture partielle : le reste de l'échéance, pas son montant initial", () => {
        const plan = [inst("a", 25000, "2026-01-10"), inst("b", 25000, "2026-02-10")];
        expect(next(plan, 10000)).toMatchObject({ installment: { id: "a" }, covered: 10000, outstanding: 15000 });
        expect(next(plan, 40000)).toMatchObject({ installment: { id: "b" }, covered: 15000, outstanding: 10000 });
    });

    it("échéance annulée ignorée ; ordre des dates rétabli quel que soit l'ordre reçu", () => {
        const plan = [inst("c", 25000, "2026-03-10"), inst("x", 25000, "2026-01-01", "CANCELLED"), inst("a", 25000, "2026-01-10")];
        const coverage = chronologicalCoverage(plan, 25000);
        expect(coverage.map((c) => c.installment.id)).toEqual(["a", "c"]);
        expect(next(plan, 25000)).toMatchObject({ installment: { id: "c" }, outstanding: 25000 });
    });

    it("plan soldé : plus aucune échéance à encaisser", () => {
        const plan = [inst("a", 25000, "2026-01-10"), inst("b", 25000, "2026-02-10")];
        expect(next(plan, 50000)).toBeUndefined();
    });

    it("montants reçus en chaîne ou décimaux (sérialisation JSON de Prisma) : arrondis au franc", () => {
        const plan = [{ id: "a", amount: "25000.00", dueDate: "2026-01-10", status: "PENDING" }];
        expect(chronologicalCoverage(plan, 0)[0]).toMatchObject({ outstanding: 25000 });
    });
});
