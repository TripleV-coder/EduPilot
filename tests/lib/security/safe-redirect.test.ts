import { describe, expect, it } from "vitest";
import { resolveAuthRedirect, safeCallbackPath } from "@/lib/security/safe-redirect";

describe("safeCallbackPath", () => {
  it("garde un chemin interne avec sa query", () => {
    expect(safeCallbackPath("/dashboard/grades?tab=2")).toBe("/dashboard/grades?tab=2");
  });

  it.each([
    ["https://evil.example/phish"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    ["dashboard"],
    [" /dashboard"],
  ])("rejette %s", (value) => {
    expect(safeCallbackPath(value)).toBe("/dashboard");
  });

  it("utilise le repli fourni quand la valeur est absente", () => {
    expect(safeCallbackPath(null, "/login")).toBe("/login");
  });
});

describe("resolveAuthRedirect", () => {
  const base = "https://app.edupilot.bj";

  it("résout un chemin relatif sur l'origine de l'app", () => {
    expect(resolveAuthRedirect("/dashboard/users", base)).toBe(`${base}/dashboard/users`);
  });

  it("accepte une URL absolue de même origine", () => {
    expect(resolveAuthRedirect(`${base}/dashboard`, base)).toBe(`${base}/dashboard`);
  });

  it.each([
    ["https://app.edupilot.bj.evil.example/x"],
    ["https://app.edupilot.bj@evil.example/x"],
    ["https://evil.example"],
    ["//evil.example"],
    ["not a url"],
  ])("renvoie au tableau de bord pour %s", (url) => {
    expect(resolveAuthRedirect(url, base)).toBe(`${base}/dashboard`);
  });
});
