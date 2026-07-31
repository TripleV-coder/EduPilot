import { describe, it, expect } from "vitest";
import {
    resolveCardQrPayload,
    buildStudentCardData,
    type BadgeLike,
} from "@/lib/students/student-card";

const NOW = new Date("2026-07-04T12:00:00Z");
const validBadge: BadgeLike = { code: "BDG-abc123", revokedAt: null, validUntil: null };

describe("resolveCardQrPayload", () => {
    it("encode le code de badge quand il est valide (non révoqué, non expiré)", () => {
        expect(resolveCardQrPayload(validBadge, "MAT-001", NOW)).toBe("BDG-abc123");
    });

    it("encode le code de badge si validUntil est dans le futur", () => {
        const badge: BadgeLike = { code: "BDG-x", revokedAt: null, validUntil: new Date("2027-01-01") };
        expect(resolveCardQrPayload(badge, "MAT-001", NOW)).toBe("BDG-x");
    });

    it("repli sur le QR matricule quand il n'y a pas de badge", () => {
        expect(resolveCardQrPayload(null, "MAT-001", NOW)).toBe("EDUPILOT:STUDENT:MAT-001");
    });

    it("repli sur le QR matricule quand le badge est révoqué", () => {
        const badge: BadgeLike = { code: "BDG-x", revokedAt: new Date("2026-06-01"), validUntil: null };
        expect(resolveCardQrPayload(badge, "MAT-042", NOW)).toBe("EDUPILOT:STUDENT:MAT-042");
    });

    it("repli sur le QR matricule quand le badge est expiré", () => {
        const badge: BadgeLike = { code: "BDG-x", revokedAt: null, validUntil: new Date("2026-01-01") };
        expect(resolveCardQrPayload(badge, "MAT-042", NOW)).toBe("EDUPILOT:STUDENT:MAT-042");
    });
});

describe("buildStudentCardData", () => {
    const base = {
        student: {
            matricule: "MAT-777",
            photoUrl: "https://cdn/x.png",
            firstName: "Awa",
            lastName: "Kone",
            dateOfBirth: new Date("2012-03-15"),
        },
        className: "6e A",
        academicYearLabel: "2025-2026",
        school: { name: "CBE Cotonou", logo: "https://cdn/logo.png", primaryColor: "success" },
        badge: validBadge,
        now: NOW,
    };

    it("assemble le nom complet, le QR et les champs école", () => {
        const card = buildStudentCardData(base);
        expect(card.fullName).toBe("Awa Kone");
        expect(card.matricule).toBe("MAT-777");
        expect(card.qrPayload).toBe("BDG-abc123");
        expect(card.school.name).toBe("CBE Cotonou");
        expect(card.school.primaryColor).toBe("success");
        expect(card.className).toBe("6e A");
    });

    it("applique des replis pour classe/année/couleur manquantes", () => {
        const card = buildStudentCardData({
            ...base,
            className: null,
            academicYearLabel: null,
            school: { name: "X", logo: null, primaryColor: null },
        });
        expect(card.className).toBe("—");
        expect(card.academicYearLabel).toBe("—");
        expect(card.school.primaryColor).toBe("brand");
    });
});
