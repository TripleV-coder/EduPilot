import type { PaymentAccountEnvironment, Prisma, SchoolPaymentAccount } from "@prisma/client";
import prisma from "@/lib/prisma";
import { isLivePaymentsEnabled } from "@/lib/payments/live-mode";
import { arePaymentSecretsAvailable, decryptPaymentSecret, PaymentSecretsUnavailableError } from "@/lib/payments/secret-box";
import { retrieveAccountTransaction, type FedaPayAccountCredentials } from "@/lib/payments/fedapay-account-client";

/**
 * Comptes marchands des écoles (S7, ADR-0011).
 *
 * Le compte utilisé pour encaisser se déduit TOUJOURS de l'école du frais,
 * jamais d'une valeur envoyée par le navigateur. Aucun repli : sans compte
 * actif, valide et déchiffrable dans le bon environnement, le paiement en
 * ligne est indisponible pour cette école (paiement à l'économat).
 *
 * Environnements strictement séparés : argent réel autorisé
 * (PAYMENTS_LIVE_ENABLED=true) → seuls les comptes LIVE ; sinon → seuls les
 * comptes SANDBOX. Un compte de test ne peut jamais encaisser « pour de vrai ».
 */
type Db = Prisma.TransactionClient | typeof prisma;

export const SCHOOL_PAYMENT_PROVIDER = "FEDAPAY";

export type OnlineUnavailableReason =
    | "NO_ACTIVE_ACCOUNT"
    | "SECRETS_KEY_UNAVAILABLE"
    | "UNREADABLE_SECRET";

export type ResolvedSchoolAccount =
    | { ok: true; account: SchoolPaymentAccount; credentials: FedaPayAccountCredentials }
    | { ok: false; reason: OnlineUnavailableReason };

/** Environnement autorisé à encaisser sur cette installation. */
export function collectingEnvironment(env: NodeJS.ProcessEnv = process.env): PaymentAccountEnvironment {
    return isLivePaymentsEnabled(env) ? "LIVE" : "SANDBOX";
}

/** Clé API déchiffrée d'un compte, ou null si le chiffré est illisible (déplacé, falsifié, clé inconnue). */
export function accountCredentials(account: SchoolPaymentAccount): FedaPayAccountCredentials | null {
    const secretKey = decryptPaymentSecret(account.secretKeyCiphertext, { schoolId: account.schoolId, accountId: account.id, field: "secretKey" });
    return secretKey ? { accountId: account.id, environment: account.environment, secretKey } : null;
}

/** Secret de webhook déchiffré d'un compte, ou null. */
export function accountWebhookSecret(account: SchoolPaymentAccount): string | null {
    return decryptPaymentSecret(account.webhookSecretCiphertext, { schoolId: account.schoolId, accountId: account.id, field: "webhookSecret" });
}

/** Compte actif de l'école pour encaisser maintenant, ou la raison de l'indisponibilité. */
export async function resolveCollectingAccount(db: Db, schoolId: string): Promise<ResolvedSchoolAccount> {
    if (!arePaymentSecretsAvailable()) return { ok: false, reason: "SECRETS_KEY_UNAVAILABLE" };
    const account = await db.schoolPaymentAccount.findFirst({
        where: { schoolId, provider: SCHOOL_PAYMENT_PROVIDER, environment: collectingEnvironment(), status: "ACTIVE" },
    });
    if (!account) return { ok: false, reason: "NO_ACTIVE_ACCOUNT" };
    try {
        const credentials = accountCredentials(account);
        return credentials ? { ok: true, account, credentials } : { ok: false, reason: "UNREADABLE_SECRET" };
    } catch (error) {
        if (error instanceof PaymentSecretsUnavailableError) return { ok: false, reason: "SECRETS_KEY_UNAVAILABLE" };
        throw error;
    }
}

/** Message affiché au payeur : jamais le détail technique (journalisé à part). */
export const ONLINE_UNAVAILABLE_MESSAGE =
    "Le paiement en ligne n'est pas disponible pour cet établissement. Vous pouvez régler à l'économat de l'école.";

/** Adresse de webhook que l'école déclare dans SON tableau de bord FedaPay. */
export function accountWebhookPath(accountId: string): string {
    return `/api/payments/fedapay/webhook/${accountId}`;
}

/** Vue publique d'un compte : jamais de secret. */
export function publicAccountView(account: SchoolPaymentAccount) {
    return {
        id: account.id,
        schoolId: account.schoolId,
        provider: account.provider,
        environment: account.environment,
        status: account.status,
        secretKeyLast4: account.secretKeyLast4,
        lastVerifiedAt: account.lastVerifiedAt,
        activatedAt: account.activatedAt,
        revokedAt: account.revokedAt,
        createdAt: account.createdAt,
        webhookPath: accountWebhookPath(account.id),
    };
}

/**
 * Rapprochement d'un paiement lié à un compte d'école (S7) : la transaction
 * est demandée à CE compte, même révoqué depuis (ses secrets restent lisibles
 * pour ses paiements passés). Secrets illisibles ou compte introuvable :
 * erreur, traitée comme un fournisseur injoignable (le paiement reste réservé).
 */
export async function verifyOnSchoolAccount(paymentAccountId: string, transactionId: string) {
    const account = await prisma.schoolPaymentAccount.findUnique({ where: { id: paymentAccountId } });
    if (!account) throw new Error(`compte marchand ${paymentAccountId} introuvable`);
    const credentials = accountCredentials(account);
    if (!credentials) throw new Error(`secrets du compte marchand ${paymentAccountId} illisibles`);
    const { status, raw } = await retrieveAccountTransaction(credentials, transactionId);
    return { status, rawData: raw };
}
