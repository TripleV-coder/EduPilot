export type AuditSeverity = "info" | "success" | "warning" | "danger";
export type AuditCategory = "notes" | "finance" | "permissions" | "auth" | "other";

const CATEGORY_RULES: Array<{ category: AuditCategory; matches: (action: string, entity: string) => boolean }> = [
    {
        category: "notes",
        matches: (a, e) =>
            /^(note|grade|evaluation|bulletin|report)\b/.test(a) ||
            ["Grade", "Evaluation", "Bulletin", "ReportCard"].includes(e),
    },
    {
        category: "finance",
        matches: (a, e) =>
            /^(paiement|payment|finance|fee|invoice|scholarship)\b/.test(a) ||
            ["Payment", "Fee", "Invoice", "Scholarship"].includes(e),
    },
    {
        category: "permissions",
        matches: (a, e) =>
            /^(role|permission|user|invite|access)\b/.test(a) ||
            ["User", "Role"].includes(e),
    },
    {
        category: "auth",
        matches: (a) => /^(login|logout|auth|mfa|password|session)\b/.test(a),
    },
];

export function classifyAudit(action: string, entity: string): AuditCategory {
    const lowerA = action.toLowerCase();
    const lowerE = entity ?? "";
    for (const rule of CATEGORY_RULES) {
        if (rule.matches(lowerA, lowerE)) return rule.category;
    }
    return "other";
}

const SEVERITY_RULES: Array<{ severity: AuditSeverity; matches: (action: string) => boolean }> = [
    { severity: "danger", matches: (a) => /\b(delete|remove|destroy|fail|failed|revoke|denied)\b/.test(a) },
    { severity: "danger", matches: (a) => /^role\.(update|change|grant)/.test(a) },
    { severity: "warning", matches: (a) => /\b(update|edit|modify|change)\b/.test(a) },
    { severity: "warning", matches: (a) => /^incident\./.test(a) },
    { severity: "success", matches: (a) => /\b(encaisser|paid|received|success|delivered)\b/.test(a) },
    { severity: "success", matches: (a) => /^(login\.success|sms\.bulk|sms\.sent)/.test(a) },
];

export function severityFor(action: string): AuditSeverity {
    const lower = action.toLowerCase();
    for (const rule of SEVERITY_RULES) {
        if (rule.matches(lower)) return rule.severity;
    }
    return "info";
}

const CATEGORY_LABELS: Record<AuditCategory, string> = {
    notes: "Notes",
    finance: "Finance",
    permissions: "Permissions",
    auth: "Auth",
    other: "Autres",
};

export function categoryLabel(c: AuditCategory): string {
    return CATEGORY_LABELS[c];
}

/**
 * Best-effort short detail string for the "Détail" column.
 * Falls back to a JSON snippet if nothing more meaningful is available.
 */
export function summarizeDetail(
    oldValues: unknown,
    newValues: unknown,
): string {
    const oldObj = (oldValues && typeof oldValues === "object" ? oldValues : {}) as Record<string, unknown>;
    const newObj = (newValues && typeof newValues === "object" ? newValues : {}) as Record<string, unknown>;

    if (typeof newObj.amount === "number") {
        const method = typeof newObj.method === "string" ? ` · ${newObj.method}` : "";
        return `${newObj.amount.toLocaleString("fr-FR")} FCFA${method}`;
    }

    if ("value" in oldObj && "value" in newObj && oldObj.value !== newObj.value) {
        const a = String(oldObj.value ?? "");
        const b = String(newObj.value ?? "");
        return `${a} → ${b}`;
    }

    if (typeof newObj.count === "number") {
        const delivered = typeof newObj.delivered === "number" ? ` · ${newObj.delivered} livrés` : "";
        return `${newObj.count} envois${delivered}`;
    }

    const interesting = Object.entries(newObj)
        .filter(([k, v]) => !["severity", "userAgent", "ipAddress"].includes(k) && (typeof v === "string" || typeof v === "number"))
        .slice(0, 2)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" · ");
    return interesting || "—";
}
