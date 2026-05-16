import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("utils.cn (Tailwind classnames merger)", () => {
  it("merges plain strings", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("removes duplicate tailwind classes (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("ignores false/null/undefined", () => {
    expect(cn("a", false && "b", null, undefined, "c")).toBe("a c");
  });

  it("handles object/array conditional syntax (clsx)", () => {
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
  });

  it("merges responsive variants properly", () => {
    expect(cn("md:p-2", "md:p-4")).toBe("md:p-4");
  });

  it("returns empty string when no inputs", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
  });
});
