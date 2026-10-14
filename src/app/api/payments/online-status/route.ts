import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import { isFedaPayConfigured } from "@/lib/payments/fedapay";
import { isMomoConfigured } from "@/lib/finance/providers/momo";

/**
 * Indique si une passerelle est configurée, sans en choisir une.
 * Consommé par la vue finance du parent (bouton Payer).
 */
export const GET = createApiHandler(
    async () => {
        const fedapay = isFedaPayConfigured();
        const momo = isMomoConfigured();
        if (!fedapay && !momo) {
            return NextResponse.json({
                available: false,
                message:
                    "Paiement en ligne non configuré. Mobile Money et FedaPay ne sont pas activés : réglez auprès de l'économat.",
            });
        }
        const which = [momo ? "Mobile Money" : null, fedapay ? "FedaPay" : null].filter(Boolean).join(" et ");
        return NextResponse.json({
            available: true,
            message: `${which} est disponible pour régler en ligne.`,
        });
    },
    { allowedRoles: ["PARENT", "STUDENT", "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
);
