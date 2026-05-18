import { describe, it, expect } from "vitest";
import {
    classifyAudit,
    severityFor,
    summarizeDetail,
    categoryLabel,
} from "@/lib/audit/classify";

describe("classifyAudit", () => {
    it("detects notes category from action prefix", () => {
        expect(classifyAudit("note.update", "Grade")).toBe("notes");
        expect(classifyAudit("evaluation.create", "Evaluation")).toBe("notes");
        expect(classifyAudit("bulletin.generate", "Bulletin")).toBe("notes");
    });

    it("detects finance category", () => {
        expect(classifyAudit("paiement.encaisser", "Payment")).toBe("finance");
        expect(classifyAudit("payment.refund", "Payment")).toBe("finance");
        expect(classifyAudit("fee.update", "Fee")).toBe("finance");
    });

    it("detects permissions category", () => {
        expect(classifyAudit("role.update", "User")).toBe("permissions");
        expect(classifyAudit("user.create", "User")).toBe("permissions");
        expect(classifyAudit("invite.send", "User")).toBe("permissions");
    });

    it("detects auth category", () => {
        expect(classifyAudit("login.success", "Auth")).toBe("auth");
        expect(classifyAudit("login.failed", "Auth")).toBe("auth");
        expect(classifyAudit("mfa.enrolled", "Auth")).toBe("auth");
    });

    it("falls back to 'other' when nothing matches", () => {
        expect(classifyAudit("sms.bulk", "Message")).toBe("other");
        expect(classifyAudit("export.csv", "Report")).toBe("other");
    });
});

describe("severityFor", () => {
    it("flags deletes and failures as danger", () => {
        expect(severityFor("user.delete")).toBe("danger");
        expect(severityFor("login.failed")).toBe("danger");
        expect(severityFor("permission.revoke")).toBe("danger");
    });

    it("flags role changes as danger", () => {
        expect(severityFor("role.update")).toBe("danger");
        expect(severityFor("role.grant")).toBe("danger");
    });

    it("flags updates as warning", () => {
        expect(severityFor("note.update")).toBe("warning");
        expect(severityFor("eleve.edit")).toBe("warning");
    });

    it("flags incidents as warning", () => {
        expect(severityFor("incident.create")).toBe("warning");
    });

    it("flags successful payments and bulk SMS as success", () => {
        expect(severityFor("paiement.encaisser")).toBe("success");
        expect(severityFor("login.success")).toBe("success");
        expect(severityFor("sms.bulk")).toBe("success");
    });

    it("defaults to info", () => {
        expect(severityFor("export.csv")).toBe("info");
        expect(severityFor("note.create")).toBe("info");
    });
});

describe("summarizeDetail", () => {
    it("renders value→value diff when both present", () => {
        expect(summarizeDetail({ value: 14.5 }, { value: 16.5 })).toBe("14.5 → 16.5");
    });

    it("renders amount + method for payments", () => {
        // Intl.NumberFormat("fr-FR") uses U+202F / U+00A0 thousands separators
        // depending on the ICU build — match either by stripping whitespace.
        const out = summarizeDetail(null, { amount: 125000, method: "Flutterwave" });
        expect(out.replace(/\s+/g, " ")).toBe("125 000 FCFA · Flutterwave");
    });

    it("renders count + delivered for bulk operations", () => {
        expect(summarizeDetail(null, { count: 14, delivered: 13 })).toBe("14 envois · 13 livrés");
    });

    it("falls back to interesting scalar keys", () => {
        expect(summarizeDetail(null, { name: "Aïcha", classe: "3eA" })).toBe("name: Aïcha · classe: 3eA");
    });

    it("ignores severity/userAgent/ipAddress in fallback", () => {
        expect(summarizeDetail(null, { severity: "INFO", name: "X" })).toBe("name: X");
    });

    it("returns em-dash when nothing useful", () => {
        expect(summarizeDetail(null, null)).toBe("—");
        expect(summarizeDetail({}, {})).toBe("—");
    });
});

describe("categoryLabel", () => {
    it("maps each category to its French label", () => {
        expect(categoryLabel("notes")).toBe("Notes");
        expect(categoryLabel("finance")).toBe("Finance");
        expect(categoryLabel("permissions")).toBe("Permissions");
        expect(categoryLabel("auth")).toBe("Auth");
        expect(categoryLabel("other")).toBe("Autres");
    });
});
