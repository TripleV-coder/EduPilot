// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { DirectorHome, type DirectorHomeProps } from "@/components/edu-homes/DirectorHome";

const DATA: DirectorHomeProps["data"] = {
  totalStudents: 983,
  totalTeachers: 41,
  totalClasses: 28,
  averageGrade: 13.2,
  attendanceRate: 92.4,
  passRate: 81.5,
  failureRate: 18.5,
  paymentsReceived: 18_450_000,
  feeRecoveryRate: 82,
  feesCollected: 18_450_000,
  pendingPayments: 4_050_000,
  studentGrowth: 3.2,
  attendanceGrowth: 1.1,
  averageGrowth: 0,
  activeAlerts: 5,
  classSummary: [
    { id: "c1", name: "6e A", average: 16.5, studentCount: 36 },
    { name: "4e B", average: 16.3, studentCount: 35 },
  ],
  atRiskStudents: [{ id: "s1", name: "Koffi Mensah", className: "3e B", average: 8.1, riskLevel: "critical" }],
  monthlyTrend: [],
};

const renderHome = (data = DATA) =>
  render(<DirectorHome userName="François Hounkpatin" schoolName="Saint-Michel" periodName="3e trimestre" data={data} />);

afterEach(cleanup);

describe("Accueil direction — vue d'ensemble", () => {
  it("affiche les quatre chiffres réels, chacun menant à son détail", () => {
    renderHome();
    expect(screen.getByRole("heading", { level: 1, name: "Bonjour, François" })).toBeInTheDocument();
    const overview = screen.getByRole("region", { name: "Vue d'ensemble" });
    expect(within(overview).getByRole("link", { name: /Élèves\s*983/ })).toHaveAttribute("href", "/dashboard/students");
    expect(within(overview).getByRole("link", { name: /Présence\s*92,4 %/ })).toHaveAttribute("href", "/dashboard/attendance");
    // Taux de recouvrement calculé côté serveur sur l'attendu réel.
    expect(within(overview).getByRole("link", { name: /Frais réglés\s*82 %/ })).toHaveAttribute("href", "/dashboard/finance");
    expect(within(overview).getByRole("link", { name: /Alertes ouvertes\s*5/ })).toBeInTheDocument();
  });

  it("n'affiche pas de faux zéros quand l'établissement n'a encore aucun élève", () => {
    renderHome({ ...DATA, totalStudents: 0, classSummary: [], atRiskStudents: [], pendingPayments: 0, paymentsReceived: 0 });
    const overview = screen.getByRole("region", { name: "Vue d'ensemble" });
    expect(within(overview).queryByText(/0,0 %/)).not.toBeInTheDocument();
    expect(within(overview).getByRole("link", { name: "Inscrire le premier élève" })).toHaveAttribute("href", "/dashboard/students/inscription");
    expect(screen.getByText(/Rien à signaler/)).toBeInTheDocument();
  });

  it("ouvre le dossier de l'élève à risque et signale les impayés", () => {
    renderHome();
    const watch = screen.getByRole("region", { name: "À surveiller" });
    expect(within(watch).getByText("Koffi Mensah")).toBeInTheDocument();
    expect(within(watch).getByText(/risque critique/)).toBeInTheDocument();
    expect(within(watch).getByRole("link", { name: "Voir le dossier" })).toHaveAttribute("href", "/dashboard/students/s1");
    expect(within(watch).getByText(/FCFA déclarés, en attente de validation/)).toBeInTheDocument();
    expect(within(watch).getByRole("link", { name: "Valider" })).toHaveAttribute("href", "/dashboard/finance/reconciliation");
  });

  it("relie chaque carte de classe à sa fiche quand l'identifiant est connu", () => {
    renderHome();
    const classes = screen.getByRole("region", { name: "Mes classes" });
    expect(within(classes).getByRole("link", { name: /6e A/ })).toHaveAttribute("href", "/dashboard/classes/c1");
    expect(within(classes).getByRole("link", { name: /4e B/ })).toHaveAttribute("href", "/dashboard/classes");
    expect(within(classes).getByRole("link", { name: "Les 28 classes" })).toBeInTheDocument();
  });

  it("propose les six actions rapides vers des pages existantes", () => {
    renderHome();
    const actions = screen.getByRole("region", { name: "Actions rapides" });
    const hrefs = within(actions).getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual([
      "/dashboard/attendance",
      "/dashboard/grades/entry",
      "/dashboard/finance/payments/new",
      "/dashboard/announcements",
      "/dashboard/students/inscription",
      "/dashboard/grades/bulletins",
    ]);
  });
});
