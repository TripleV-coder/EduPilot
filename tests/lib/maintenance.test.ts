import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    default: { systemSetting: { findMany: vi.fn() } },
}));

import prisma from "@/lib/prisma";
import {
    getMaintenanceState,
    invalidateMaintenanceCache,
    maintenanceBlocksRole,
    DEFAULT_MAINTENANCE_MESSAGE,
    MAINTENANCE_ENABLED_KEY,
    MAINTENANCE_MESSAGE_KEY,
} from "@/lib/system/maintenance";

beforeEach(() => {
    vi.clearAllMocks();
    invalidateMaintenanceCache();
});

describe("maintenanceBlocksRole", () => {
    it("laisse passer SUPER_ADMIN", () => {
        expect(maintenanceBlocksRole("SUPER_ADMIN")).toBe(false);
    });
    it("bloque les autres rôles et les sessions absentes", () => {
        for (const role of ["SCHOOL_ADMIN", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT", "STAFF"]) {
            expect(maintenanceBlocksRole(role)).toBe(true);
        }
        expect(maintenanceBlocksRole(undefined)).toBe(true);
        expect(maintenanceBlocksRole(null)).toBe(true);
    });
});

describe("getMaintenanceState", () => {
    it("désactivé + message par défaut quand aucun réglage", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([] as never);
        const state = await getMaintenanceState();
        expect(state).toEqual({ enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE });
    });

    it("activé avec message personnalisé", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([
            { key: MAINTENANCE_ENABLED_KEY, value: "true" },
            { key: MAINTENANCE_MESSAGE_KEY, value: "Mise à jour base de données" },
        ] as never);
        const state = await getMaintenanceState();
        expect(state.enabled).toBe(true);
        expect(state.message).toBe("Mise à jour base de données");
    });

    it("retombe sur le message par défaut si le message est vide", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([
            { key: MAINTENANCE_ENABLED_KEY, value: "true" },
            { key: MAINTENANCE_MESSAGE_KEY, value: "   " },
        ] as never);
        const state = await getMaintenanceState();
        expect(state.message).toBe(DEFAULT_MAINTENANCE_MESSAGE);
    });

    it("met en cache : un seul accès base pour deux lectures rapprochées", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockResolvedValue([
            { key: MAINTENANCE_ENABLED_KEY, value: "true" },
        ] as never);
        await getMaintenanceState();
        await getMaintenanceState();
        expect(prisma.systemSetting.findMany).toHaveBeenCalledTimes(1);
    });

    it("fail-open : considère le service accessible si la base échoue", async () => {
        vi.mocked(prisma.systemSetting.findMany).mockRejectedValue(new Error("db down") as never);
        const state = await getMaintenanceState();
        expect(state.enabled).toBe(false);
    });
});
