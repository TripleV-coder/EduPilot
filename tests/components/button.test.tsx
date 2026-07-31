// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { Button } from "@/components/edu/button";

afterEach(cleanup);

describe("Button — primitive edu", () => {
  it("rend son contenu et déclenche onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Envoyer</Button>);
    const btn = screen.getByRole("button", { name: "Envoyer" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("désactivé : attribut disabled et aucun clic", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>X</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("loading : bouton désactivé (anti double-soumission)", () => {
    render(<Button loading>Enregistrer</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("feedback de pression : scale(0.97) au pointerdown, relâché au pointerup", () => {
    render(<Button>Press</Button>);
    const btn = screen.getByRole("button");
    expect(btn.style.transform).toBe("none");
    fireEvent.pointerDown(btn);
    expect(btn.style.transform).toBe("scale(0.97)");
    fireEvent.pointerUp(btn);
    expect(btn.style.transform).toBe("none");
  });

  it("désactivé : pas de feedback de pression", () => {
    render(<Button disabled>Press</Button>);
    const btn = screen.getByRole("button");
    fireEvent.pointerDown(btn);
    expect(btn.style.transform).toBe("none");
  });
});
