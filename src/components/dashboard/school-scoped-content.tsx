"use client";

import { Fragment, type ReactNode } from "react";
import { useSchool } from "@/components/providers/school-provider";

/**
 * Contenu de page lié à l'établissement actif (audit R-CA-05, 2026-10-16).
 *
 * Changer d'école ne recharge pas la page : sans remontage, les états React
 * des écrans (filtres de classe, d'année, de période, données chargées par
 * `useEffect`) gardaient les valeurs de l'école précédente et les envoyaient
 * avec les requêtes de la nouvelle. La clé fait remonter tout le contenu de
 * la page au changement d'école ; la coque (menus, barre supérieure) reste
 * en place et ses données SWR sont déjà purgées par `SchoolProvider`.
 */
export function SchoolScopedContent({ children }: { children: ReactNode }) {
    const { schoolId } = useSchool();
    return <Fragment key={schoolId ?? "sans-ecole"}>{children}</Fragment>;
}
