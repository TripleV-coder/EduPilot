import type { Prisma, WalletAccountKind } from "@prisma/client";
import { z } from "zod";
import prisma from "@/lib/prisma";

export const WALLET_WRITE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"];

const WALLET_KINDS = ["BANK", "MTN", "MOOV", "CELTIIS", "CASH", "OTHER"] as const;

/** Déclaration d'un compte de l'école. */
export const walletAccountCreateSchema = z.object({
    name: z.string().trim().min(2, "Nom du compte requis").max(80),
    kind: z.enum(WALLET_KINDS),
    /** Numéro de compte ou MSISDN : seuls les 4 derniers chiffres sont conservés. */
    accountRef: z.string().trim().max(40).nullable().optional(),
    /** Solde d'ouverture déclaré (FCFA entiers), à la date de la déclaration. */
    openingBalanceFcfa: z.number().int().min(0).max(100_000_000_000).default(0),
});

/** Modification : AUCUN défaut (un champ absent ne doit rien remettre à zéro). */
export const walletAccountUpdateSchema = z
    .object({
        name: z.string().trim().min(2).max(80).optional(),
        kind: z.enum(WALLET_KINDS).optional(),
        accountRef: z.string().trim().max(40).nullable().optional(),
        openingBalanceFcfa: z.number().int().min(0).max(100_000_000_000).optional(),
    })
    .refine((value) => Object.keys(value).length > 0, { message: "Aucune modification fournie." });

/** Ne garde que la fin d'un numéro : le portefeuille n'a pas besoin du numéro complet. */
export function maskAccountRef(ref: string | null | undefined): string | null {
    const digits = (ref ?? "").replace(/\s+/g, "");
    if (!digits) return null;
    return digits.length <= 4 ? digits : `•••• ${digits.slice(-4)}`;
}

/**
 * Portefeuille de l'école (décision du 2026-11-05) : comptes DÉCLARÉS par
 * l'école ; solde CALCULÉ sur ce qu'EduPilot sait réellement, sans API
 * bancaire ni Mobile Money (aucune donnée inventée) :
 *
 *   solde = solde d'ouverture déclaré
 *         + encaissements validés du canal depuis la déclaration du compte
 *           (VERIFIED/RECONCILED, remboursements — montants négatifs — déduits)
 *         + mouvements manuels saisis (entrées − sorties)
 *         − décaissements exécutés
 *
 * Plusieurs comptes d'un même canal : seul le plus ancien reçoit les
 * encaissements automatiques, pour ne jamais les compter deux fois.
 */
export function paymentChannelFilter(kind: WalletAccountKind): Prisma.PaymentWhereInput | null {
    switch (kind) {
        case "CASH":
            return { method: "CASH", provider: null };
        case "BANK":
            return { method: { in: ["BANK_TRANSFER", "CHECK"] }, provider: null };
        case "MTN":
            return { method: "MOBILE_MONEY_MTN", provider: null };
        case "MOOV":
            return { method: "MOBILE_MONEY_MOOV", provider: null };
        case "OTHER":
            // Paiements en ligne (prestataire renseigné), versés sur le compte marchand
            return { provider: { not: null } };
        case "CELTIIS":
            return null; // aucun moyen de paiement Celtiis enregistré : mouvements manuels seulement
    }
}

export const WALLET_KIND_LABELS: Record<WalletAccountKind, string> = {
    BANK: "Banque",
    MTN: "MTN Mobile Money",
    MOOV: "Moov Money",
    CELTIIS: "Celtiis Cash",
    CASH: "Caisse (espèces)",
    OTHER: "Paiements en ligne",
};

export interface WalletBalance {
    accountId: string;
    openingFcfa: bigint;
    collectedFcfa: bigint;
    manualNetFcfa: bigint;
    disbursedFcfa: bigint;
    balanceFcfa: bigint;
    /** Ce compte reçoit-il les encaissements automatiques de son canal ? */
    receivesPayments: boolean;
}

const toBig = (value: Prisma.Decimal | number | bigint | null | undefined) =>
    value === null || value === undefined ? BigInt(0) : BigInt(Math.round(Number(value)));

export async function computeWalletBalances(
    schoolId: string,
    accounts: ReadonlyArray<{ id: string; kind: WalletAccountKind; balanceFcfa: bigint; createdAt: Date }>,
): Promise<WalletBalance[]> {
    // Le plus ancien compte actif de chaque canal reçoit les encaissements
    const receiverByKind = new Map<WalletAccountKind, string>();
    for (const acc of [...accounts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
        if (!receiverByKind.has(acc.kind)) receiverByKind.set(acc.kind, acc.id);
    }

    return Promise.all(
        accounts.map(async (acc) => {
            const filter = paymentChannelFilter(acc.kind);
            const receives = Boolean(filter) && receiverByKind.get(acc.kind) === acc.id;
            const [collected, inflow, outflow, disbursed] = await Promise.all([
                receives
                    ? prisma.payment.aggregate({
                          where: {
                              ...filter,
                              student: { schoolId },
                              status: { in: ["VERIFIED", "RECONCILED"] },
                              deletedAt: null,
                              createdAt: { gte: acc.createdAt },
                          },
                          _sum: { amount: true },
                      })
                    : Promise.resolve({ _sum: { amount: null } }),
                prisma.walletTransaction.aggregate({ where: { accountId: acc.id, direction: "INFLOW" }, _sum: { amountFcfa: true } }),
                prisma.walletTransaction.aggregate({ where: { accountId: acc.id, direction: "OUTFLOW" }, _sum: { amountFcfa: true } }),
                prisma.scheduledDisbursement.aggregate({ where: { accountId: acc.id, status: "EXECUTED" }, _sum: { amountFcfa: true } }),
            ]);
            const collectedFcfa = toBig(collected._sum.amount);
            const manualNetFcfa = (inflow._sum.amountFcfa ?? BigInt(0)) - (outflow._sum.amountFcfa ?? BigInt(0));
            const disbursedFcfa = disbursed._sum.amountFcfa ?? BigInt(0);
            return {
                accountId: acc.id,
                openingFcfa: acc.balanceFcfa,
                collectedFcfa,
                manualNetFcfa,
                disbursedFcfa,
                balanceFcfa: acc.balanceFcfa + collectedFcfa + manualNetFcfa - disbursedFcfa,
                receivesPayments: receives,
            };
        }),
    );
}
