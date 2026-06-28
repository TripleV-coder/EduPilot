// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { Card } from "@/components/edu/card";

afterEach(cleanup);

describe("Card — primitive edu", () => {
  it("rend son contenu", () => {
    render(<Card>Contenu</Card>);
    expect(screen.getByText("Contenu")).toBeInTheDocument();
  });

  it("carte statique : pas de lift au survol", () => {
    render(<Card>Statique</Card>);
    const el = screen.getByText("Statique");
    fireEvent.mouseEnter(el);
    expect(el.style.transform).toBe("none");
  });

  it("carte interactive (onClick) : lift au survol, relâché à la sortie", () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Cliquable</Card>);
    const el = screen.getByText("Cliquable");
    fireEvent.mouseEnter(el);
    expect(el.style.transform).toBe("translateY(-2px)");
    fireEvent.mouseLeave(el);
    expect(el.style.transform).toBe("none");
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("prop interactive force le lift sans onClick", () => {
    render(<Card interactive>Liée</Card>);
    const el = screen.getByText("Liée");
    fireEvent.mouseEnter(el);
    expect(el.style.transform).toBe("translateY(-2px)");
  });
});
