import type { CagnotteContributionStatus } from "@prisma/client";
import { roleSatisfies } from "@/lib/rbac/permissions";

/**
 * Contributions aux cagnottes (TD-019).
 *
 * Une famille DÉCLARE une contribution : elle reste « en attente » et ne compte
 * pas dans la collecte tant que le comptable ou la direction ne l'a pas
 * confirmée (après vérification de l'espèce reçue ou du relevé Mobile Money).
 * Une contribution saisie par l'école elle-même (au guichet) est confirmée
 * d'emblée : la personne qui encaisse est celle qui valide.
 */

/** Rôles qui valident ou rejettent une contribution, et saisissent au guichet. */
export const CAGNOTTE_REVIEWER_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] as const;

export function canReviewCagnotte(role: string | null | undefined): boolean {
  return roleSatisfies(role, [...CAGNOTTE_REVIEWER_ROLES]);
}

type ContributionLike = {
  parentUserId: string;
  amountFcfa: bigint;
  status: CagnotteContributionStatus;
};

export type ContributionSummary = {
  /** Total confirmé : seul montant présenté comme collecté. */
  raisedFcfa: bigint;
  /** Familles ayant au moins une contribution confirmée. */
  participantCount: number;
  myConfirmedFcfa: bigint;
  myPendingFcfa: bigint;
  pendingCount: number;
  pendingFcfa: bigint;
};

export function summarizeContributions(rows: readonly ContributionLike[], viewerId: string): ContributionSummary {
  let raisedFcfa = BigInt(0);
  let myConfirmedFcfa = BigInt(0);
  let myPendingFcfa = BigInt(0);
  let pendingFcfa = BigInt(0);
  let pendingCount = 0;
  const participants = new Set<string>();

  for (const row of rows) {
    if (row.status === "CONFIRMED") {
      raisedFcfa += row.amountFcfa;
      participants.add(row.parentUserId);
      if (row.parentUserId === viewerId) myConfirmedFcfa += row.amountFcfa;
    } else if (row.status === "PENDING") {
      pendingCount += 1;
      pendingFcfa += row.amountFcfa;
      if (row.parentUserId === viewerId) myPendingFcfa += row.amountFcfa;
    }
  }

  return {
    raisedFcfa,
    participantCount: participants.size,
    myConfirmedFcfa,
    myPendingFcfa,
    pendingCount,
    pendingFcfa,
  };
}

/** Une ligne de contribution est visible du public si elle est confirmée ; sinon par l'école et son auteur. */
export function contributionVisibleTo(
  row: { parentUserId: string; status: CagnotteContributionStatus },
  viewer: { id: string; role: string | null | undefined },
): boolean {
  return row.status === "CONFIRMED" || row.parentUserId === viewer.id || canReviewCagnotte(viewer.role);
}
