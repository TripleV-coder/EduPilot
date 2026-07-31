// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { Badge } from "@/components/edu/badge";
import { Input } from "@/components/edu/input";
import { MetricCard } from "@/components/edu/metric-card";
import { Spinner } from "@/components/edu/spinner";
import { Progress } from "@/components/edu/progress";

afterEach(cleanup);

describe("Badge", () => {
  it("rend son libellé", () => {
    render(<Badge variant="success">Validé</Badge>);
    expect(screen.getByText("Validé")).toBeInTheDocument();
  });
  it("supporte les variantes sans planter", () => {
    for (const v of ["success", "warning", "danger", "info", "neutral", "brand"] as const) {
      cleanup();
      render(<Badge variant={v} dot icon="check">{v}</Badge>);
      expect(screen.getByText(v)).toBeInTheDocument();
    }
  });
});

describe("Input", () => {
  it("rend le label et reflète la valeur", () => {
    render(<Input label="Email" value="a@b.bj" onChange={() => {}} />);
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("a@b.bj");
  });

  it("déclenche onChange à la saisie", () => {
    const onChange = vi.fn();
    render(<Input label="Nom" value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x" } });
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("affiche le message d'erreur", () => {
    render(<Input label="Nom" value="" onChange={() => {}} error="Champ requis" />);
    expect(screen.getByText("Champ requis")).toBeInTheDocument();
  });

  it("respecte disabled", () => {
    render(<Input label="Nom" value="" onChange={() => {}} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});

describe("MetricCard", () => {
  it("rend label, valeur et unité", () => {
    render(<MetricCard label="Élèves" value="1 248" unit="actifs" />);
    expect(screen.getByText("Élèves")).toBeInTheDocument();
    expect(screen.getByText("1 248")).toBeInTheDocument();
    expect(screen.getByText("actifs")).toBeInTheDocument();
  });

  it("affiche la tendance en valeur absolue avec %", () => {
    render(<MetricCard label="Taux" value="92" trend={-5} trendLabel="vs N-1" />);
    expect(screen.getByText("5%")).toBeInTheDocument();
    expect(screen.getByText("vs N-1")).toBeInTheDocument();
  });

  it("sans trend : aucun pourcentage de tendance", () => {
    render(<MetricCard label="X" value="10" />);
    expect(screen.queryByText(/%$/)).not.toBeInTheDocument();
  });
});

describe("Spinner & Progress (smoke)", () => {
  it("Spinner se monte sans erreur", () => {
    const { container } = render(<Spinner />);
    expect(container.firstChild).toBeTruthy();
  });
  it("Progress reflète une valeur", () => {
    const { container } = render(<Progress value={42} />);
    expect(container.firstChild).toBeTruthy();
  });
});
