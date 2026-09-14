import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

/**
 * Démarrage à vide (Lot 5, N36) : le premier super-administrateur est créé
 * depuis l'interface (/setup). Sans liste `ROOT_USER_EMAILS` — son email
 * n'est pas connu avant l'installation —, il doit pouvoir déployer le premier
 * établissement. La liste reste une restriction facultative.
 *
 * `tests/setup.ts` fixe ROOT_USER_EMAILS pour tous les tests : chaque cas
 * recharge le module avec l'environnement voulu (liste lue au chargement).
 */
const ORIGINAL = process.env.ROOT_USER_EMAILS;

async function loadWith(allowlist: string | undefined) {
    vi.resetModules();
    if (allowlist === undefined) delete process.env.ROOT_USER_EMAILS;
    else process.env.ROOT_USER_EMAILS = allowlist;
    const [{ requireRoot }, access] = await Promise.all([
        import("@/lib/security/require-root"),
        import("@/lib/security/root-access"),
    ]);
    return { requireRoot, ...access };
}

function session(role: string, email: string): Session {
    return {
        user: { id: "u1", email, role, isTwoFactorEnabled: false, isTwoFactorAuthenticated: false },
        expires: new Date(Date.now() + 3_600_000).toISOString(),
    } as unknown as Session;
}

afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ROOT_USER_EMAILS;
    else process.env.ROOT_USER_EMAILS = ORIGINAL;
    vi.resetModules();
});

describe("console root — installation neuve sans ROOT_USER_EMAILS", () => {
    it("le super-administrateur créé par /setup a accès à la console root", async () => {
        const { requireRoot, hasValidRootSession } = await loadWith(undefined);
        const s = session("SUPER_ADMIN", "direction@ecole.bj");
        expect(requireRoot(s, s.user.email, s.user.id)).toBeNull();
        expect(hasValidRootSession(s)).toBe(true);
    });

    it("un autre rôle reste refusé", async () => {
        const { requireRoot } = await loadWith(undefined);
        const s = session("SCHOOL_ADMIN", "direction@ecole.bj");
        expect(requireRoot(s, s.user.email, s.user.id)?.status).toBe(403);
    });
});

describe("console root — liste ROOT_USER_EMAILS définie", () => {
    it("seuls les super-administrateurs listés y ont accès", async () => {
        const { requireRoot } = await loadWith("root@ecole.bj");
        const listed = session("SUPER_ADMIN", "root@ecole.bj");
        const other = session("SUPER_ADMIN", "autre@ecole.bj");
        expect(requireRoot(listed, listed.user.email, listed.user.id)).toBeNull();
        expect(requireRoot(other, other.user.email, other.user.id)?.status).toBe(403);
    });

    it("compare les emails sans tenir compte de la casse (/setup les enregistre en minuscules)", async () => {
        const { requireRoot, isRootUserEmail } = await loadWith(" Root@Ecole.BJ , second@ecole.bj");
        const s = session("SUPER_ADMIN", "root@ecole.bj");
        expect(requireRoot(s, s.user.email, s.user.id)).toBeNull();
        expect(isRootUserEmail("ROOT@ecole.bj")).toBe(true);
    });

    it("isRootUserEmail ne désigne que les comptes explicitement listés", async () => {
        const empty = await loadWith(undefined);
        expect(empty.isRootUserEmail("direction@ecole.bj")).toBe(false);
        const listed = await loadWith("root@ecole.bj");
        expect(listed.isRootUserEmail("root@ecole.bj")).toBe(true);
    });
});
