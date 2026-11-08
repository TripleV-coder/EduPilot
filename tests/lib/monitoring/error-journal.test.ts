import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ create: vi.fn().mockResolvedValue({}), alert: vi.fn().mockResolvedValue("sent") }));
vi.mock("@/lib/prisma", () => ({ prismaBase: { errorLog: { create: db.create } } }));
vi.mock("@/lib/monitoring/admin-alerts", () => ({ alertPlatformAdmins: db.alert }));
vi.mock("@/lib/utils/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

import {
    MAX_ERRORS_PER_MINUTE,
    errorFingerprint,
    normalizePath,
    recordError,
    resetErrorQuotaForTests,
    serverErrorReport,
} from "@/lib/monitoring/error-journal";

beforeEach(() => {
    vi.clearAllMocks();
    resetErrorQuotaForTests();
});

describe("journal des erreurs", () => {
    it("chemin sans chaîne de requête (données personnelles) ni identifiants", () => {
        expect(normalizePath("/dashboard/students/cmw76zola000c442eircfz6zr/grades?email=a@b.c")).toBe("/dashboard/students/:id/grades");
        expect(normalizePath("/api/classes/42")).toBe("/api/classes/:id");
        expect(normalizePath(null)).toBeNull();
    });

    it("même erreur, autres identifiants ou nombres : même empreinte ; autre message : autre empreinte", () => {
        const a = errorFingerprint({ source: "server", message: "Élève cmw76zola000c442eircfz6zr introuvable (ligne 12)", path: "/api/students/cmw76zola000c442eircfz6zr" });
        const b = errorFingerprint({ source: "server", message: "Élève cmw77abcd000c442eircfz6zz introuvable (ligne 99)", path: "/api/students/cmw77abcd000c442eircfz6zz" });
        const c = errorFingerprint({ source: "server", message: "Classe introuvable", path: "/api/students/1" });
        expect(a).toBe(b);
        expect(a).not.toBe(c);
        expect(errorFingerprint({ source: "client", message: "Classe introuvable", path: "/api/students/1" })).not.toBe(c);
    });

    it("inscrit l'erreur tronquée puis alerte une fois par empreinte", async () => {
        await recordError({ ...serverErrorReport(new TypeError("x".repeat(900)), "/api/x?token=secret"), userId: "u1" });
        const data = db.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ source: "server", path: "/api/x", userId: "u1" });
        expect(data.message.length).toBe(500);
        expect(db.alert).toHaveBeenCalledWith(expect.objectContaining({ key: `error:${data.fingerprint}`, title: "Erreur serveur" }));
    });

    it("avalanche : au plus 60 inscriptions par minute et par processus", async () => {
        for (let i = 0; i < MAX_ERRORS_PER_MINUTE + 25; i++) await recordError({ source: "server", message: `boom ${i}` });
        expect(db.create).toHaveBeenCalledTimes(MAX_ERRORS_PER_MINUTE);
    });

    it("base indisponible : ne lève jamais", async () => {
        db.create.mockRejectedValueOnce(new Error("base injoignable"));
        await expect(recordError({ source: "client", message: "x" })).resolves.toBeUndefined();
    });

    it("valeur levée qui n'est pas une Error : rapport lisible", () => {
        expect(serverErrorReport("chaîne levée").message).toBe("Error: chaîne levée");
        expect(serverErrorReport({ code: 1 }).message).toBe('Error: {"code":1}');
    });
});
