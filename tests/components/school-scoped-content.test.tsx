// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";

/**
 * Audit R-CA-05 : au changement d'école, les états React d'une page (filtres
 * de classe, d'année…) ne doivent pas survivre et s'appliquer à la nouvelle
 * école. Reproduit d'abord dans Chrome sur /dashboard/analytics.
 */
const school = vi.hoisted(() => ({ schoolId: "ecole-A" as string | null }));
vi.mock("@/components/providers/school-provider", () => ({
    useSchool: () => ({ schoolId: school.schoolId }),
}));

import { SchoolScopedContent } from "@/components/dashboard/school-scoped-content";

function ClassFilter() {
    const [selected, setSelected] = useState<string | null>(null);
    return (
        <div>
            <button onClick={() => setSelected("classe-de-A")}>choisir</button>
            <span>filtre : {selected ?? "aucun"}</span>
        </div>
    );
}

afterEach(() => {
    cleanup();
    school.schoolId = "ecole-A";
});

describe("SchoolScopedContent", () => {
    it("remet à zéro l'état de la page quand l'école active change", () => {
        const { rerender } = render(<SchoolScopedContent><ClassFilter /></SchoolScopedContent>);
        fireEvent.click(screen.getByText("choisir"));
        expect(screen.getByText("filtre : classe-de-A")).toBeInTheDocument();

        school.schoolId = "ecole-B";
        rerender(<SchoolScopedContent><ClassFilter /></SchoolScopedContent>);

        expect(screen.getByText("filtre : aucun")).toBeInTheDocument();
    });

    it("conserve l'état tant que l'école ne change pas", () => {
        const { rerender } = render(<SchoolScopedContent><ClassFilter /></SchoolScopedContent>);
        fireEvent.click(screen.getByText("choisir"));
        rerender(<SchoolScopedContent><ClassFilter /></SchoolScopedContent>);
        expect(screen.getByText("filtre : classe-de-A")).toBeInTheDocument();
    });
});
