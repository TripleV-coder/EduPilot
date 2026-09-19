// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SWRConfig } from "swr";

import { EvaluationSheet } from "@/components/evaluations/EvaluationSheet";

/**
 * N26 — ouvrir « Nouvelle évaluation » (page Notes) faisait planter le module :
 * le sélecteur de classe utilisait FormLabel/FormControl hors de tout
 * <FormField> (« useFormField should be used within <FormField> »).
 * Réponses d'API de la même forme que le serveur réel (N25 : /api/classes
 * renvoie { data, pagination }).
 */
vi.mock("@/components/providers/school-provider", () => ({
  useSchool: () => ({ academicYearId: "cyear1" }),
}));

const responses: Record<string, unknown> = {
  "/api/classes": { data: [{ id: "c6a", name: "6e A" }], pagination: { limit: 200, nextCursor: null, hasNextPage: false, total: 1 } },
  "/api/periods?academicYearId=cyear1": [{ id: "p1", name: "1er Trimestre" }],
  "/api/evaluation-types": [{ id: "t1", name: "Devoir" }],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EvaluationSheet (N26)", () => {
  it("s'ouvre sans erreur et présente l'étape Classe & Matière", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => responses[url] ?? [] })),
    );

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <EvaluationSheet open onOpenChange={vi.fn()} />
      </SWRConfig>,
    );

    expect(await screen.findByText("Nouvelle Évaluation")).toBeInTheDocument();
    expect(screen.getByText("Étape 1 : Classe & Matière")).toBeInTheDocument();
    expect(screen.getByText("Classe")).toBeInTheDocument();
  });
});
