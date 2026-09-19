import type { Session } from "next-auth";
import { getAccessibleSchoolIds, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { tenantContext, type DbContext } from "./db-context";

/**
 * Contexte de base d'une session (audit M2) :
 * - SUPER_ADMIN : rôle global par conception → contexte système ;
 * - autres rôles : établissements accessibles de la session (école active,
 *   annexes, écoles du réseau, écoles des enfants d'un parent). Une session
 *   sans établissement ne voit aucune donnée sensible.
 */
export function dbContextForSession(session: Session | null | undefined): DbContext | null {
    if (!session?.user) return null;
    if (session.user.role === "SUPER_ADMIN") return { kind: "system", reason: "super-admin" };
    return tenantContext([getActiveSchoolId(session), ...getAccessibleSchoolIds(session)]);
}
