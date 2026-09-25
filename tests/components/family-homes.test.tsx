// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ParentHome, type ParentHomeProps } from "@/components/edu-homes/ParentHome";
import { StudentHome } from "@/components/edu-homes/StudentHome";
import type { ComponentProps } from "react";

afterEach(cleanup);

const CHILD = { name: "Awa Kora", myAverage: 0, myRank: null, attendanceRate: null, subjectPerformances: [], monthlyTrend: [] };

const renderParent = (data: Partial<ParentHomeProps["data"]> = {}) =>
  render(<ParentHome userName="Parent Kora" schoolName={null} periodName={null} data={{ children: [CHILD], ...data }} />);

describe("Accueil parent", () => {
  it("n'affiche pas « 0,0 % » de présence quand aucun appel n'existe", () => {
    renderParent();
    const overview = screen.getByRole("region", { name: "Vue d'ensemble" });
    expect(within(overview).getByText("aucun appel enregistré")).toBeInTheDocument();
    expect(screen.queryByText(/0,0 %/)).not.toBeInTheDocument();
  });

  it("moyenne la présence sur les seuls enfants mesurés", () => {
    renderParent({ children: [CHILD, { ...CHILD, name: "Koffi Kora", attendanceRate: 90 }] });
    const overview = screen.getByRole("region", { name: "Vue d'ensemble" });
    expect(within(overview).getByText("90,0 %")).toBeInTheDocument();
  });

  it("signale les retards à part de la prochaine échéance et marque chaque paiement des initiales de l'enfant", () => {
    renderParent({
      totalDue: 150_000,
      nextDueDate: null,
      overdueCount: 1,
      pendingPayments: [{ id: "p1", childName: "Awa", label: "Scolarité", amount: 150_000, dueDate: "2026-09-15T00:00:00.000Z", state: "overdue" }],
    });
    const overview = screen.getByRole("region", { name: "Vue d'ensemble" });
    expect(within(overview).getByText("1 paiement(s) en retard")).toBeInTheDocument();
    const watch = screen.getByRole("region", { name: "À surveiller" });
    expect(within(watch).getByText("A")).toBeInTheDocument();
  });
});

describe("Accueil élève", () => {
  const DATA: ComponentProps<typeof StudentHome>["data"] = {
    myAverage: 0,
    myRank: null,
    attendanceRate: null,
    subjectPerformances: [],
    monthlyTrend: [],
  };

  it("affiche « — » et non 0 % sans appel enregistré", () => {
    render(<StudentHome userName="Awa Kora" schoolName={null} periodName={null} data={DATA} />);
    const overview = screen.getByRole("region", { name: "Vue d'ensemble" });
    expect(within(overview).getByText("aucun appel enregistré")).toBeInTheDocument();
    expect(screen.queryByText(/0,0 %/)).not.toBeInTheDocument();
  });
});
