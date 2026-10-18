"use client";

import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useSchool } from "@/components/providers/school-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Pages financières et comptables (S6, 2026-10-18).
 *
 * Les finances sont propres à chaque école : le super-administrateur sans
 * école active choisit d'abord un établissement (l'API refuse désormais toute
 * vue sans sélection, au lieu de mélanger les écoles). Pendant un changement
 * d'école, aucun chiffre n'est affiché ; la page est ensuite remontée pour la
 * nouvelle école par SchoolScopedContent (layout du tableau de bord), et le
 * cache SWR purgé par SchoolProvider : rien de l'école quittée ne reste.
 * Les autres rôles ont toujours une école active : la page s'affiche comme avant.
 */
export function FinanceSchoolGate({ children }: { children: React.ReactNode }) {
    const { data: session } = useSession();
    const { schoolId, accessibleSchools, setActiveSchoolId, isSwitchingSchool } = useSchool();
    const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";

    if (isSwitchingSchool) {
        return (
            <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Changement d&apos;établissement…
            </div>
        );
    }

    if (isSuperAdmin && !schoolId) {
        return (
            <section className="mx-auto max-w-lg space-y-4 px-4 py-16 text-center" aria-labelledby="finance-school-required">
                <h1 id="finance-school-required" className="text-xl font-semibold">
                    Choisissez un établissement
                </h1>
                <p className="text-sm text-muted-foreground">
                    Les paiements, frais et écritures appartiennent à chaque école. Sélectionnez celle que vous voulez consulter :
                    les chiffres de plusieurs établissements ne sont jamais mélangés.
                </p>
                {accessibleSchools.length > 0 ? (
                    <Select onValueChange={(id) => void setActiveSchoolId(id)}>
                        <SelectTrigger aria-label="Établissement" className="mx-auto h-10 w-full max-w-xs">
                            <SelectValue placeholder="Établissement" />
                        </SelectTrigger>
                        <SelectContent>
                            {accessibleSchools.map((school) => (
                                <SelectItem key={school.id} value={school.id}>
                                    {school.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : (
                    <p className="text-sm">Aucun établissement n&apos;est encore enregistré.</p>
                )}
            </section>
        );
    }

    return <>{children}</>;
}
