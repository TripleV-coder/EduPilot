import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prismaBase: { user: { findFirst } } }));

import { platformContactEmail, resetPlatformContactCache } from "@/lib/system/platform-contact";

beforeEach(() => {
    vi.clearAllMocks();
    resetPlatformContactCache();
});
afterEach(() => vi.unstubAllEnvs());

describe("adresse de contact des pages légales", () => {
    it("premier super-administrateur actif (celui qui a installé la plateforme)", async () => {
        vi.stubEnv("ROOT_USER_EMAILS", "");
        findFirst.mockResolvedValue({ email: "direction@ecole.bj" });
        expect(await platformContactEmail()).toBe("direction@ecole.bj");
        expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { role: "SUPER_ADMIN", isActive: true }, orderBy: { createdAt: "asc" } }));
    });

    it("ROOT_USER_EMAILS définie : sa première adresse, sans lire la base", async () => {
        vi.stubEnv("ROOT_USER_EMAILS", " Exploitant@Ecole.bj , autre@ecole.bj");
        expect(await platformContactEmail()).toBe("exploitant@ecole.bj");
        expect(findFirst).not.toHaveBeenCalled();
    });

    it("avant l'installation : aucune adresse inventée", async () => {
        vi.stubEnv("ROOT_USER_EMAILS", "");
        findFirst.mockResolvedValue(null);
        expect(await platformContactEmail()).toBeNull();
    });

    it("relue au plus toutes les 5 minutes ; base indisponible : dernière valeur connue", async () => {
        vi.stubEnv("ROOT_USER_EMAILS", "");
        findFirst.mockResolvedValueOnce({ email: "a@ecole.bj" });
        expect(await platformContactEmail(0)).toBe("a@ecole.bj");
        expect(await platformContactEmail(60_000)).toBe("a@ecole.bj");
        expect(findFirst).toHaveBeenCalledOnce();
        findFirst.mockRejectedValueOnce(new Error("base injoignable"));
        expect(await platformContactEmail(6 * 60_000)).toBe("a@ecole.bj");
    });
});
