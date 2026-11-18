import { NextResponse } from "next/server";

/** Données rattachées à une ressource qu'on voudrait supprimer. */
export interface Dependency {
    count: number;
    /** Libellé au singulier, ex. « inscription ». */
    one: string;
    /** Libellé au pluriel, ex. « inscriptions ». */
    many: string;
}

/**
 * Règle de suppression « prudente » (décision du 2026-11-05) : une ressource
 * qui porte encore des données n'est jamais supprimée. La réponse 409 dit ce
 * qui est rattaché et quoi faire, au lieu d'effacer en cascade des notes, des
 * inscriptions ou des paiements.
 *
 * @returns null si rien n'est rattaché (la suppression peut avoir lieu).
 */
export function dependencyConflict(subject: string, dependencies: Dependency[], hint: string): NextResponse | null {
    const present = dependencies.filter((d) => d.count > 0);
    if (present.length === 0) return null;
    const list = present.map((d) => `${d.count} ${d.count > 1 ? d.many : d.one}`).join(", ");
    return NextResponse.json(
        {
            error: `Suppression impossible : ${subject} porte encore ${list}. ${hint}`.trim(),
            code: "HAS_DEPENDENCIES",
            dependencies: present.map((d) => ({ label: d.count > 1 ? d.many : d.one, count: d.count })),
        },
        { status: 409 },
    );
}
