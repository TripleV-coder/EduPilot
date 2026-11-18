/**
 * Couverture de chaque échéance par le total encaissé, selon la MÊME règle
 * d'imputation chronologique que syncPaymentPlanLedger : échéances non
 * annulées, de la plus ancienne à la plus récente, chacune remplie avant la
 * suivante. La première échéance dont `outstanding` > 0 est celle qu'un
 * nouveau paiement réglera (lot 3c).
 *
 * Fonction pure, sans accès à la base : utilisée par la route de paiement
 * d'une échéance et par l'écran Finance, pour désigner la même échéance.
 */
export function chronologicalCoverage<T extends { amount: number | string | { toString(): string }; status: string; dueDate: Date | string }>(
    installments: T[],
    settled: number,
): Array<{ installment: T; covered: number; outstanding: number }> {
    let left = settled;
    return installments
        .filter((installment) => installment.status !== "CANCELLED")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .map((installment) => {
            const amount = Math.round(Number(installment.amount));
            const covered = Math.max(0, Math.min(left, amount));
            left -= covered;
            return { installment, covered, outstanding: amount - covered };
        });
}
