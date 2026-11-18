import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { Prisma, type PaymentAccountEnvironment, type SchoolPaymentAccount } from "@prisma/client";
import prisma from "@/lib/prisma";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { resolveFinanceSchool } from "@/lib/finance/finance-scope";
import { createAuditLog } from "@/lib/security/audit-log";
import { isLivePaymentsEnabled } from "@/lib/payments/live-mode";
import { encryptPaymentSecret, lastFour } from "@/lib/payments/secret-box";
import { verifyAccountCredentials } from "@/lib/payments/fedapay-account-client";
import { accountCredentials, SCHOOL_PAYMENT_PROVIDER } from "@/lib/payments/school-accounts";

/**
 * Administration des comptes marchands d'une école (S7, ADR-0011).
 *
 * - Lecture (vue masquée) : administration, direction et comptabilité de l'école.
 * - Écriture (créer, tester, activer, révoquer) : l'administrateur de l'école
 *   lui-même, ou le super-administrateur dans l'école qu'il a sélectionnée.
 *   Ni la direction, ni la comptabilité, ni le responsable de réseau :
 *   l'école garde la maîtrise de son compte marchand.
 * - Les secrets ne sortent jamais : ni réponse, ni journal, ni audit.
 */
export type AccountAccessMode = "read" | "write";

const READ_ROLES = new Set(["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "NETWORK_ADMIN"]);

export async function authorizePaymentAccountAccess(
    session: Session,
    schoolId: string,
    mode: AccountAccessMode,
): Promise<NextResponse | null> {
    const forbidden = () => NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    if (session.user.role === "SUPER_ADMIN") {
        // École explicitement sélectionnée et existante (S6) : jamais une autre
        const scope = await resolveFinanceSchool(session, schoolId, `payment-accounts:${mode}`);
        if (!scope.ok) return scope.response;
        return scope.schoolId === schoolId ? null : forbidden();
    }
    if (!canAccessSchool(session, schoolId)) return forbidden();
    if (mode === "write") return session.user.role === "SCHOOL_ADMIN" ? null : forbidden();
    return READ_ROLES.has(session.user.role) ? null : forbidden();
}

/** Préfixe de clé secrète exigé par environnement (docs.fedapay.com, plugins). */
const KEY_PREFIX: Record<PaymentAccountEnvironment, string> = { SANDBOX: "sk_sandbox", LIVE: "sk_live" };

export class AccountAdminError extends Error {
    constructor(readonly status: 400 | 404 | 409 | 503, message: string, readonly code: string) {
        super(message);
        this.name = "AccountAdminError";
    }
}

async function audit(session: Session, account: SchoolPaymentAccount, action: string, extra: Record<string, unknown> = {}) {
    await createAuditLog({
        userId: session.user.id,
        action,
        entity: "SchoolPaymentAccount",
        entityId: account.id,
        schoolId: account.schoolId,
        // Jamais de secret : environnement, état et 4 derniers caractères seulement
        newValues: { provider: account.provider, environment: account.environment, status: account.status, secretKeyLast4: account.secretKeyLast4, ...extra },
    });
}

export async function createSchoolAccount(
    session: Session,
    input: { schoolId: string; environment: PaymentAccountEnvironment; secretKey: string; webhookSecret: string },
): Promise<SchoolPaymentAccount> {
    const secretKey = input.secretKey.trim();
    const webhookSecret = input.webhookSecret.trim();
    if (!secretKey.startsWith(KEY_PREFIX[input.environment])) {
        throw new AccountAdminError(400, `La clé secrète ne correspond pas à l'environnement choisi (préfixe attendu : ${KEY_PREFIX[input.environment]}).`, "KEY_ENVIRONMENT_MISMATCH");
    }
    // Identifiant connu AVANT le chiffrement : il lie chaque chiffré à ce compte
    const id = randomUUID();
    const context = { schoolId: input.schoolId, accountId: id };
    const key = encryptPaymentSecret(secretKey, { ...context, field: "secretKey" });
    const hook = encryptPaymentSecret(webhookSecret, { ...context, field: "webhookSecret" });
    const account = await prisma.schoolPaymentAccount.create({
        data: {
            id,
            schoolId: input.schoolId,
            provider: SCHOOL_PAYMENT_PROVIDER,
            environment: input.environment,
            status: "INACTIVE",
            secretKeyCiphertext: key.ciphertext,
            webhookSecretCiphertext: hook.ciphertext,
            encryptionKeyVersion: key.version,
            secretKeyLast4: lastFour(secretKey),
            createdById: session.user.id,
        },
    });
    await audit(session, account, "PAYMENT_ACCOUNT_CREATED");
    return account;
}

/** Test des identifiants chez FedaPay (lecture seule) ; date de vérification posée si la clé est acceptée. */
export async function verifySchoolAccount(session: Session, account: SchoolPaymentAccount): Promise<{ account: SchoolPaymentAccount; result: "valid" | "invalid" | "unreachable" }> {
    if (account.status === "REVOKED") throw new AccountAdminError(409, "Compte révoqué : enregistrez un nouveau compte.", "ACCOUNT_REVOKED");
    const credentials = accountCredentials(account);
    if (!credentials) throw new AccountAdminError(503, "Secrets du compte illisibles : enregistrez de nouveau les clés.", "UNREADABLE_SECRET");
    const result = await verifyAccountCredentials(credentials);
    const updated = result === "valid"
        ? await prisma.schoolPaymentAccount.update({ where: { id: account.id }, data: { lastVerifiedAt: new Date() } })
        : account;
    await audit(session, updated, "PAYMENT_ACCOUNT_VERIFIED", { result });
    return { account: updated, result };
}

/**
 * Activation : le compte testé devient le compte d'encaissement de l'école
 * pour son environnement ; l'éventuel compte actif précédent est révoqué dans
 * la même transaction (rotation). Un compte LIVE exige l'argent réel autorisé.
 */
export async function activateSchoolAccount(session: Session, account: SchoolPaymentAccount): Promise<SchoolPaymentAccount> {
    if (account.status !== "INACTIVE") throw new AccountAdminError(409, "Seul un compte non encore activé peut l'être.", "ACCOUNT_NOT_INACTIVE");
    if (!account.lastVerifiedAt) throw new AccountAdminError(409, "Testez d'abord les identifiants de ce compte.", "ACCOUNT_NOT_VERIFIED");
    if (account.environment === "LIVE" && !isLivePaymentsEnabled()) {
        throw new AccountAdminError(409, "Les paiements en argent réel ne sont pas activés sur cette installation (PAYMENTS_LIVE_ENABLED).", "PAYMENTS_LIVE_DISABLED");
    }
    try {
        const activated = await prisma.$transaction(async (tx) => {
            const now = new Date();
            await tx.schoolPaymentAccount.updateMany({
                where: { schoolId: account.schoolId, provider: account.provider, environment: account.environment, status: "ACTIVE" },
                data: { status: "REVOKED", revokedAt: now },
            });
            const result = await tx.schoolPaymentAccount.updateMany({
                where: { id: account.id, status: "INACTIVE" },
                data: { status: "ACTIVE", activatedAt: now },
            });
            if (result.count !== 1) throw new AccountAdminError(409, "Le compte a changé entre-temps.", "ACCOUNT_CHANGED");
            return tx.schoolPaymentAccount.findUniqueOrThrow({ where: { id: account.id } });
        });
        await audit(session, activated, "PAYMENT_ACCOUNT_ACTIVATED");
        return activated;
    } catch (error) {
        // Deux activations simultanées : l'index unique partiel n'en laisse passer qu'une
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new AccountAdminError(409, "Un autre compte vient d'être activé pour cet environnement.", "ACCOUNT_ACTIVATION_CONFLICT");
        }
        throw error;
    }
}

/** Révocation : plus aucun nouveau paiement ; les paiements passés restent rapprochables. */
export async function revokeSchoolAccount(session: Session, account: SchoolPaymentAccount): Promise<SchoolPaymentAccount> {
    if (account.status === "REVOKED") throw new AccountAdminError(409, "Compte déjà révoqué.", "ACCOUNT_REVOKED");
    const revoked = await prisma.schoolPaymentAccount.update({
        where: { id: account.id },
        data: { status: "REVOKED", revokedAt: new Date() },
    });
    await audit(session, revoked, "PAYMENT_ACCOUNT_REVOKED");
    return revoked;
}

export function accountAdminErrorResponse(error: unknown): NextResponse | null {
    return error instanceof AccountAdminError
        ? NextResponse.json({ error: error.message, code: error.code }, { status: error.status })
        : null;
}
