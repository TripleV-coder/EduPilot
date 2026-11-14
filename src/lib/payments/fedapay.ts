/**
 * FedaPay — éléments communs aux comptes marchands des écoles
 * (fedapay-account-client.ts, ADR-0011).
 *
 * Plus de compte FedaPay global (2026-11-08) : FEDAPAY_SECRET_KEY,
 * FEDAPAY_WEBHOOK_SECRET et FEDAPAY_ENVIRONMENT sont retirées. Chaque école
 * encaisse sur SON compte (clés chiffrées en base, environnement choisi par
 * PAYMENTS_LIVE_ENABLED) ; FedaPay couvre MTN, Moov, Celtiis et les cartes.
 */

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

export interface FedaPayCustomer {
  firstname: string;
  lastname: string;
  email: string;
  /** Numéro local (ex. "0190000000"). */
  phone?: string;
}
