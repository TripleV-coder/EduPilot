import { createHmac, timingSafeEqual } from "node:crypto";
import { CIRCUITS, getCircuitBreaker, isProviderFailureStatus } from "@/lib/resilience/circuit-breaker";
import { ProviderInitError, outcomeForHttpStatus, outcomeForSendError } from "@/lib/finance/providers/init-error";
import { mapFedaPayStatus, type FedaPayCustomer, type PaymentStatus } from "@/lib/payments/fedapay";

/**
 * Client FedaPay d'UN compte marchand d'école (S7, ADR-0011).
 *
 * Le SDK officiel garde clé, environnement et compte dans un état global du
 * processus : avec une clé par école, deux requêtes simultanées pourraient
 * s'écraser (paiement de l'école A créé avec la clé de B). Ce client envoie la
 * clé du compte dans l'en-tête de CHAQUE appel, sans aucun état partagé.
 *
 * Contrat (docs.fedapay.com, consulté le 2026-10-18 ; URL de base, préfixe /v1,
 * authentification Bearer et enveloppe `v1/transaction` établis par le code du
 * SDK officiel fedapay-node 1.2.5, la documentation publique ne les détaillant
 * pas) :
 *   POST /v1/transactions              création (merchant_reference = notre référence)
 *   POST /v1/transactions/{id}/token   lien de paiement { token, url }
 *   GET  /v1/transactions/{id}         état, montant, merchant_reference
 *   GET  /v1/transactions?per_page=1   test des identifiants (lecture seule)
 */
export type FedaPayEnvironment = "SANDBOX" | "LIVE";

export interface FedaPayAccountCredentials {
    /** Identifiant du compte EduPilot (journal, jamais la clé). */
    accountId: string;
    environment: FedaPayEnvironment;
    secretKey: string;
}

const BASE_URL: Record<FedaPayEnvironment, string> = {
    SANDBOX: "https://sandbox-api.fedapay.com/v1",
    LIVE: "https://api.fedapay.com/v1",
};
const TIMEOUT_MS = 15_000;

class FedaPayHttpError extends Error {
    constructor(readonly httpStatus: number, path: string) {
        super(`FedaPay ${path} : HTTP ${httpStatus}`);
        this.name = "FedaPayHttpError";
    }
}

type Fetch = typeof fetch;

async function call(
    credentials: FedaPayAccountCredentials,
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    fetchImpl: Fetch = fetch,
): Promise<Record<string, unknown>> {
    // Sous coupe-circuit : seules les pannes du fournisseur (réseau, 5xx, 429)
    // l'ouvrent ; un refus d'identifiants d'une école (401) n'affecte pas les autres.
    return getCircuitBreaker(CIRCUITS.fedapay).execute(
        async () => {
            const response = await fetchImpl(`${BASE_URL[credentials.environment]}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${credentials.secretKey}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: AbortSignal.timeout(TIMEOUT_MS),
            });
            if (!response.ok) throw new FedaPayHttpError(response.status, path);
            return (await response.json()) as Record<string, unknown>;
        },
        {
            isFailureError: (error) => {
                const status = (error as { httpStatus?: unknown })?.httpStatus;
                return typeof status !== "number" || isProviderFailureStatus(status);
            },
        },
    );
}

/** Objet transaction, avec ou sans l'enveloppe `v1/transaction` du SDK. */
function unwrapTransaction(body: Record<string, unknown>): Record<string, unknown> {
    const wrapped = body["v1/transaction"] ?? body.transaction;
    return (wrapped && typeof wrapped === "object" ? wrapped : body) as Record<string, unknown>;
}

function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

export interface FedaPayAccountCheckout {
    url: string;
    token: string;
    transactionId: string;
}

/** Crée la transaction sur le compte de l'école et renvoie le lien de paiement hébergé. */
export async function createAccountCheckout(
    credentials: FedaPayAccountCredentials,
    params: { amount: number; description: string; reference: string; callbackUrl: string; customer: FedaPayCustomer },
    fetchImpl: Fetch = fetch,
): Promise<FedaPayAccountCheckout> {
    let created: Record<string, unknown>;
    try {
        created = unwrapTransaction(await call(credentials, "POST", "/transactions", {
            description: params.description,
            amount: Math.round(params.amount),
            currency: { iso: "XOF" },
            callback_url: params.callbackUrl,
            merchant_reference: params.reference,
            customer: {
                firstname: params.customer.firstname,
                lastname: params.customer.lastname,
                email: params.customer.email,
                ...(params.customer.phone ? { phone_number: { number: params.customer.phone, country: "bj" } } : {}),
            },
        }, fetchImpl));
    } catch (error) {
        const status = (error as { httpStatus?: unknown })?.httpStatus;
        const outcome = typeof status === "number" ? outcomeForHttpStatus(status) : outcomeForSendError(error);
        throw new ProviderInitError(`[FedaPay ${credentials.accountId}] création de transaction : ${(error as Error).message}`, outcome, undefined, { cause: error });
    }

    const transactionId = created.id != null ? String(created.id) : "";
    if (!transactionId) {
        throw new ProviderInitError(`[FedaPay ${credentials.accountId}] réponse de création sans identifiant`, "UNKNOWN");
    }
    // La transaction existe : un échec ici laisse un résultat inconnu, avec son identifiant
    try {
        const tokenBody = await call(credentials, "POST", `/transactions/${encodeURIComponent(transactionId)}/token`, {}, fetchImpl);
        const token = typeof tokenBody.token === "string" ? tokenBody.token : "";
        const url = typeof tokenBody.url === "string" ? tokenBody.url : "";
        if (!url) throw new Error("réponse sans lien de paiement");
        // Le navigateur sera redirigé vers ce lien : https exigé. Pas de liste
        // de domaines, la documentation FedaPay n'en publie pas (liens courts compris)
        if (!isHttpsUrl(url)) throw new Error("lien de paiement non sécurisé (https exigé)");
        return { url, token, transactionId };
    } catch (error) {
        throw new ProviderInitError(`[FedaPay ${credentials.accountId}] jeton de paiement : ${(error as Error).message}`, "UNKNOWN", transactionId, { cause: error });
    }
}

/** État d'une transaction de ce compte (rapprochement). */
export async function retrieveAccountTransaction(
    credentials: FedaPayAccountCredentials,
    transactionId: string,
    fetchImpl: Fetch = fetch,
): Promise<{ status: PaymentStatus; raw: unknown; merchantReference: string | null }> {
    const tx = unwrapTransaction(await call(credentials, "GET", `/transactions/${encodeURIComponent(transactionId)}`, undefined, fetchImpl));
    return {
        status: mapFedaPayStatus(typeof tx.status === "string" ? tx.status : null),
        raw: tx,
        merchantReference: typeof tx.merchant_reference === "string" ? tx.merchant_reference : null,
    };
}

/**
 * Test des identifiants par un appel en lecture seule. `invalid` : FedaPay
 * refuse la clé (401/403) ; `unreachable` : panne ou délai, rien n'est conclu.
 */
export async function verifyAccountCredentials(
    credentials: FedaPayAccountCredentials,
    fetchImpl: Fetch = fetch,
): Promise<"valid" | "invalid" | "unreachable"> {
    try {
        await call(credentials, "GET", "/transactions?per_page=1", undefined, fetchImpl);
        return "valid";
    } catch (error) {
        const status = (error as { httpStatus?: unknown })?.httpStatus;
        return status === 401 || status === 403 ? "invalid" : "unreachable";
    }
}

export interface FedaPayAccountEvent {
    name: string;
    entity: Record<string, unknown> | null;
}

/**
 * Vérifie la signature d'un webhook avec le secret de CE compte (algorithme du
 * SDK officiel : HMAC-SHA256 de "<t>.<corps>", en-tête "t=…,s=…", tolérance
 * 300 s ; le secret est passé en paramètre, aucun état global). Lève une
 * erreur si la signature est absente, invalide ou trop ancienne.
 */
export function verifyAccountWebhook(rawBody: string, signature: string | null, webhookSecret: string): FedaPayAccountEvent {
    verifyFedaPaySignature(rawBody, signature, webhookSecret);
    const event = JSON.parse(rawBody) as {
        name?: string;
        entity?: Record<string, unknown>;
        object?: Record<string, unknown>;
    };
    return { name: event.name ?? "", entity: event.entity ?? event.object ?? null };
}

/** Tolérance d'âge d'une signature (valeur du SDK officiel : 5 minutes). */
export const FEDAPAY_WEBHOOK_TOLERANCE_S = 300;

/** Signature hexadécimale HMAC-SHA256 de "<timestamp>.<corps>". */
export function computeFedaPaySignature(timestamp: number, rawBody: string, secret: string): string {
    return createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
}

function sameHex(a: string, b: string): boolean {
    const left = Buffer.from(a, "utf8");
    const right = Buffer.from(b, "utf8");
    return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Reprise native (node:crypto) de `WebhookSignature.verifyHeader` du SDK
 * fedapay-node 1.2.5 — le paquet n'est plus une dépendance (2026-11-12).
 * Même analyse de l'en-tête « t=…,s=… » (plusieurs « s » acceptés), même
 * tolérance vers le passé. Lève une erreur sinon.
 */
export function verifyFedaPaySignature(
    rawBody: string,
    header: string | null,
    secret: string,
    toleranceSeconds = FEDAPAY_WEBHOOK_TOLERANCE_S,
    nowMs = Date.now(),
): void {
    if (typeof header !== "string") throw new Error("Signature FedaPay absente");
    let timestamp = -1;
    const signatures: string[] = [];
    for (const item of header.split(",")) {
        const [key, value] = item.split("=");
        if (key === "t") timestamp = parseInt(value, 10);
        if (key === "s") signatures.push(value);
    }
    if (timestamp === -1) throw new Error("Signature FedaPay sans horodatage");
    if (signatures.length === 0) throw new Error("Signature FedaPay sans valeur « s »");
    const expected = computeFedaPaySignature(timestamp, rawBody, secret);
    if (!signatures.some((candidate) => typeof candidate === "string" && sameHex(candidate, expected))) {
        throw new Error("Signature FedaPay invalide");
    }
    const age = Math.floor(nowMs / 1000) - timestamp;
    if (toleranceSeconds > 0 && age > toleranceSeconds) throw new Error("Signature FedaPay trop ancienne");
}

/**
 * En-tête « t=…,s=… » tel que FedaPay l'envoie (même forme que
 * `Webhook.generateTestHeaderString` du SDK) : tests et essais locaux.
 */
export function fedapaySignatureHeader(opts: { payload: string; secret: string; timestamp?: number }): string {
    const timestamp = Math.floor(opts.timestamp ?? Date.now() / 1000);
    return `t=${timestamp},s=${computeFedaPaySignature(timestamp, opts.payload, opts.secret)}`;
}
