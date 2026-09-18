import { afterEach, describe, expect, it, vi } from "vitest";
import { validateCriticalEnv } from "@/lib/env";

/**
 * N5 — `validateCriticalEnv()` s'exécute à l'import de Prisma, y compris
 * pendant `next build`. Sans secrets, le build d'un clone neuf (et l'étape de
 * build du Dockerfile, qui n'en définit aucun) échouait. Les secrets ne sont
 * pas nécessaires pour construire : ils sont vérifiés au démarrage.
 */
describe("validateCriticalEnv", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    function productionWithoutSecret() {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("NEXTAUTH_SECRET", "");
        vi.stubEnv("DATABASE_URL", "postgresql://u:p@db:5432/edupilot");
        vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://ecole.example");
        vi.stubEnv("NEXT_PHASE", "");
        vi.stubEnv("SKIP_ENV_VALIDATION", "");
    }

    it("ne bloque pas la phase de build de Next", () => {
        productionWithoutSecret();
        vi.stubEnv("NEXT_PHASE", "phase-production-build");
        expect(() => validateCriticalEnv()).not.toThrow();
    });

    it("respecte SKIP_ENV_VALIDATION, comme lib/env.ts", () => {
        productionWithoutSecret();
        vi.stubEnv("SKIP_ENV_VALIDATION", "true");
        expect(() => validateCriticalEnv()).not.toThrow();
    });

    it("bloque toujours le démarrage d'un serveur sans secret", () => {
        productionWithoutSecret();
        const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => validateCriticalEnv()).toThrow(/Critical environment variables/);
        quiet.mockRestore();
    });
});
