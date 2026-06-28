/**
 * Intégration FedaPay (agrégateur paiement Bénin/Afrique de l'Ouest).
 *
 * Couvre Mobile Money (MTN, Moov, Celtiis) + cartes via une seule API.
 * Tout est config-gated : sans `FEDAPAY_SECRET_KEY`, l'intégration est inactive
 * (les routes renvoient un statut « non configuré », jamais d'erreur 500).
 *
 * Variables d'environnement :
 *   FEDAPAY_SECRET_KEY     — clé secrète serveur (sk_live_… / sk_sandbox_…)
 *   FEDAPAY_PUBLIC_KEY     — clé publique (front, facultatif côté serveur)
 *   FEDAPAY_WEBHOOK_SECRET — secret de l'endpoint webhook (vérif signature)
 *   FEDAPAY_ENVIRONMENT    — "live" | "sandbox" (défaut: sandbox)
 *
 * API SDK utilisée (fedapay@1.x) :
 *   FedaPay.setApiKey / setEnvironment
 *   Transaction.create(...) → instance ; transaction.generateToken() → { token, url }
 *   Webhook.constructEvent(rawBody, signatureHeader, secret) → event (throw si invalide)
 */
import { FedaPay, Transaction, Webhook } from "fedapay";

/** Statuts FedaPay considérés comme payés (cf. SDK Transaction.PAID_STATUS). */
const FEDAPAY_PAID = new Set(["approved", "transferred"]);
const FEDAPAY_FAILED = new Set(["declined", "canceled", "expired"]);

export type PaymentStatus = "SUCCESS" | "FAILED" | "PENDING";

/** Mappe un statut FedaPay vers le statut interne EduPilot. */
export function mapFedaPayStatus(status: string | undefined | null): PaymentStatus {
  const s = (status ?? "").toLowerCase();
  if (FEDAPAY_PAID.has(s)) return "SUCCESS";
  if (FEDAPAY_FAILED.has(s)) return "FAILED";
  return "PENDING";
}

/**
 * Récupère le statut d'une transaction FedaPay (pour rapprochement / verify).
 */
export async function retrieveFedaPayTransaction(
  transactionId: string
): Promise<{ status: PaymentStatus; raw: unknown }> {
  ensureInit();
  const tx = (await Transaction.retrieve(transactionId)) as unknown as {
    status?: string;
  };
  return { status: mapFedaPayStatus(tx.status), raw: tx };
}

export function isFedaPayConfigured(): boolean {
  return Boolean(process.env.FEDAPAY_SECRET_KEY);
}

export function getFedaPayMode(): "live" | "sandbox" {
  return process.env.FEDAPAY_ENVIRONMENT === "live" ? "live" : "sandbox";
}

export const FEDAPAY_REQUIRED_ENV = [
  "FEDAPAY_SECRET_KEY",
  "FEDAPAY_WEBHOOK_SECRET",
  "FEDAPAY_ENVIRONMENT",
] as const;

function ensureInit(): void {
  FedaPay.setApiKey(process.env.FEDAPAY_SECRET_KEY as string);
  FedaPay.setEnvironment(getFedaPayMode());
}

export interface FedaPayCheckout {
  /** URL de paiement hébergée FedaPay (à ouvrir côté client). */
  url: string;
  /** Jeton de paiement. */
  token: string;
  /** Identifiant de transaction FedaPay (pour rapprochement). */
  transactionId: string;
}

export interface FedaPayCustomer {
  firstname: string;
  lastname: string;
  email: string;
  /** Numéro local (ex. "0190000000"). */
  phone?: string;
}

/**
 * Crée une transaction FedaPay et renvoie le lien de paiement hébergé.
 * `reference` est propagé en `merchant_reference` → permet le rapprochement
 * webhook avec le `Payment.reference` côté EduPilot.
 */
export async function createFedaPayCheckout(params: {
  amount: number;
  description: string;
  reference: string;
  callbackUrl: string;
  customer: FedaPayCustomer;
}): Promise<FedaPayCheckout> {
  ensureInit();

  const transaction = await Transaction.create({
    description: params.description,
    amount: Math.round(params.amount),
    currency: { iso: "XOF" },
    callback_url: params.callbackUrl,
    merchant_reference: params.reference,
    customer: {
      firstname: params.customer.firstname,
      lastname: params.customer.lastname,
      email: params.customer.email,
      ...(params.customer.phone
        ? { phone_number: { number: params.customer.phone, country: "bj" } }
        : {}),
    },
  });

  const tx = transaction as unknown as { id: string | number };
  const token = (await transaction.generateToken()) as unknown as {
    token: string;
    url: string;
  };

  return {
    url: token.url,
    token: token.token,
    transactionId: String(tx.id),
  };
}

export interface FedaPayEvent {
  /** Ex. "transaction.approved", "transaction.canceled", "transaction.declined". */
  name: string;
  /** L'entité concernée (transaction) — champs FedaPay (status, merchant_reference, id…). */
  entity: Record<string, unknown> | null;
}

/**
 * Vérifie et décode un événement webhook FedaPay.
 * Lève `SignatureVerificationError` (SDK) si la signature est invalide.
 */
export function verifyFedaPayEvent(rawBody: string, signature: string | null): FedaPayEvent {
  const secret = process.env.FEDAPAY_WEBHOOK_SECRET as string;
  const event = Webhook.constructEvent(rawBody, signature, secret) as unknown as {
    name?: string;
    entity?: Record<string, unknown>;
    object?: Record<string, unknown>;
  };
  return {
    name: event.name ?? "",
    entity: event.entity ?? event.object ?? null,
  };
}
