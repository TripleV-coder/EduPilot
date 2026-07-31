import { describe, it, expect } from "vitest";
import { authorizeRoles } from "@/lib/api/api-helpers";

describe("authorizeRoles — expansion NETWORK_ADMIN", () => {
  it("autorise NETWORK_ADMIN là où SCHOOL_ADMIN est listé", () => {
    expect(authorizeRoles("NETWORK_ADMIN", ["SCHOOL_ADMIN", "DIRECTOR"]).authorized).toBe(true);
  });

  it("refuse NETWORK_ADMIN sur un écran SUPER_ADMIN seul", () => {
    const res = authorizeRoles("NETWORK_ADMIN", ["SUPER_ADMIN"]);
    expect(res.authorized).toBe(false);
    expect(res.response?.status).toBe(403);
  });

  it("comportement inchangé pour un match direct", () => {
    expect(authorizeRoles("TEACHER", ["TEACHER"]).authorized).toBe(true);
  });
});
