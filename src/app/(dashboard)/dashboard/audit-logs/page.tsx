"use client";

import { useEffect, useMemo, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import { Download, Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/hooks/use-debounce";
import {
    type AuditCategory,
    type AuditSeverity,
    categoryLabel,
    classifyAudit,
    severityFor,
    summarizeDetail,
} from "@/lib/audit/classify";

type AuditLogRow = {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string;
    ipAddress: string | null;
    oldValues: unknown;
    newValues: unknown;
    user: {
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        role: string | null;
    } | null;
};

const SEVERITY_STYLES: Record<AuditSeverity, { bg: string; fg: string }> = {
    info:    { bg: "var(--eduflow-info-50)",    fg: "var(--eduflow-info-800)" },
    success: { bg: "var(--eduflow-success-50)", fg: "var(--eduflow-success-800)" },
    warning: { bg: "var(--eduflow-warning-50)", fg: "var(--eduflow-warning-800)" },
    danger:  { bg: "var(--eduflow-danger-50)",  fg: "var(--eduflow-danger-800)" },
};

const CATEGORY_ORDER: AuditCategory[] = ["notes", "finance", "permissions", "auth"];

function initials(first: string | null, last: string | null): string {
    const f = (first ?? "?").slice(0, 1).toUpperCase();
    const l = (last ?? "?").slice(0, 1).toUpperCase();
    return `${f}${l}`;
}

function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLogRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 250);
    const [category, setCategory] = useState<AuditCategory | "all">("all");
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch("/api/audit-logs?limit=500");
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!cancelled) setLogs(Array.isArray(data.logs) ? data.logs : []);
            } catch (err) {
                if (!cancelled) setError((err as Error).message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        load();
        return () => {
            cancelled = true;
        };
    }, []);

    const categoryCounts = useMemo(() => {
        const counts: Record<AuditCategory, number> = {
            notes: 0, finance: 0, permissions: 0, auth: 0, other: 0,
        };
        for (const log of logs) {
            counts[classifyAudit(log.action, log.entity)]++;
        }
        return counts;
    }, [logs]);

    const filtered = useMemo(() => {
        const needle = debouncedSearch.trim().toLowerCase();
        return logs.filter((log) => {
            if (category !== "all" && classifyAudit(log.action, log.entity) !== category) return false;
            if (!needle) return true;
            const haystack = [
                log.user?.firstName, log.user?.lastName, log.user?.email,
                log.action, log.entity, log.entityId, log.ipAddress,
            ].filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(needle);
        });
    }, [logs, debouncedSearch, category]);

    const exportCSV = async () => {
        setExporting(true);
        try {
            const res = await fetch("/api/audit-logs/export");
            if (!res.ok) throw new Error();
            const csv = await res.text();
            const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            // Silent — page header already shows the count, error state is rare here.
        } finally {
            setExporting(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}>
            <div className="space-y-4 max-w-[1280px] mx-auto pb-12">
                <PageHeader
                    title="Journal d'audit"
                    description="Toutes les actions critiques · conforme MEMP · 90 jours en accès direct"
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Paramètres" },
                        { label: "Conformité" },
                        { label: "Audit" },
                    ]}
                    actions={
                        <Button
                            variant="outline"
                            onClick={exportCSV}
                            disabled={exporting}
                            className="gap-2"
                        >
                            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Export CSV
                        </Button>
                    }
                />

                {/* Filter bar */}
                <div
                    className="flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl"
                    style={{
                        background: "var(--eduflow-surface-card)",
                        border: "1px solid var(--eduflow-border-subtle)",
                    }}
                >
                    <CategoryChip
                        label="Tous"
                        count={logs.length}
                        active={category === "all"}
                        onClick={() => setCategory("all")}
                    />
                    {CATEGORY_ORDER.map((cat) => (
                        <CategoryChip
                            key={cat}
                            label={categoryLabel(cat)}
                            count={categoryCounts[cat]}
                            active={category === cat}
                            onClick={() => setCategory(cat)}
                        />
                    ))}
                    <div className="flex-1" />
                    <div className="relative w-full sm:w-[260px]">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                            style={{ color: "var(--eduflow-text-tertiary)" }}
                        />
                        <Input
                            aria-label="Rechercher dans les logs d'audit"
                            placeholder="Acteur, ressource…"
                            className="pl-9 h-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Table card */}
                <div
                    className="rounded-xl overflow-hidden"
                    style={{
                        background: "var(--eduflow-surface-card)",
                        border: "1px solid var(--eduflow-border-subtle)",
                    }}
                >
                    {loading ? (
                        <div className="p-3 space-y-2">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div
                                    key={idx}
                                    className="h-12 rounded-lg animate-pulse"
                                    style={{ background: "var(--eduflow-surface-sunken)" }}
                                />
                            ))}
                        </div>
                    ) : error ? (
                        <div
                            className="px-6 py-16 text-center"
                            style={{ color: "var(--eduflow-danger-700)" }}
                        >
                            <p className="text-sm">Impossible de charger les logs ({error}).</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div
                            className="px-6 py-16 text-center"
                            style={{ color: "var(--eduflow-text-tertiary)" }}
                        >
                            <p className="text-sm">Aucun événement pour ce filtre.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[12px]">
                                <thead>
                                    <tr style={{ background: "var(--eduflow-surface-sunken)" }}>
                                        {["Horodatage", "Acteur", "Action", "Ressource", "IP", "Détail"].map((h) => (
                                            <th
                                                key={h}
                                                className="px-4 py-2.5 text-left font-bold uppercase"
                                                style={{
                                                    fontSize: 10,
                                                    color: "var(--eduflow-text-tertiary)",
                                                    letterSpacing: "0.06em",
                                                }}
                                            >
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((log) => {
                                        const sev = severityFor(log.action);
                                        const palette = SEVERITY_STYLES[sev];
                                        const actor = log.user
                                            ? `${log.user.firstName ?? ""} ${log.user.lastName ?? ""}`.trim() || (log.user.email ?? "—")
                                            : "Système";
                                        return (
                                            <tr key={log.id} style={{ borderTop: "1px solid var(--eduflow-border-subtle)" }}>
                                                <td
                                                    className="px-4 py-3 font-mono"
                                                    style={{ fontSize: 11, color: "var(--eduflow-text-tertiary)" }}
                                                >
                                                    {formatTimestamp(log.createdAt)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="w-6 h-6 rounded-full grid place-items-center font-bold"
                                                            style={{
                                                                background: "var(--eduflow-brand-100)",
                                                                color: "var(--eduflow-brand-800)",
                                                                fontSize: 10,
                                                            }}
                                                        >
                                                            {log.user ? initials(log.user.firstName, log.user.lastName) : "SY"}
                                                        </span>
                                                        <span className="font-semibold">{actor}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span
                                                        className="font-mono inline-block px-2 py-0.5 rounded-md"
                                                        style={{
                                                            fontSize: 11,
                                                            background: palette.bg,
                                                            color: palette.fg,
                                                        }}
                                                    >
                                                        {log.action}
                                                    </span>
                                                </td>
                                                <td
                                                    className="px-4 py-3 font-mono"
                                                    style={{ color: "var(--eduflow-text-secondary)" }}
                                                >
                                                    {log.entity}
                                                    {log.entityId ? `/${log.entityId.slice(0, 16)}` : ""}
                                                </td>
                                                <td
                                                    className="px-4 py-3 font-mono"
                                                    style={{ color: "var(--eduflow-text-tertiary)" }}
                                                >
                                                    {log.ipAddress ?? "—"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {summarizeDetail(log.oldValues, log.newValues)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </PageGuard>
    );
}

function CategoryChip({
    label,
    count,
    active,
    onClick,
}: {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-[12px] font-semibold transition-colors"
            style={{
                background: active ? "var(--eduflow-brand-100)" : "var(--eduflow-surface-sunken)",
                color: active ? "var(--eduflow-brand-800)" : "var(--eduflow-text-secondary)",
                border: `1px solid ${active ? "var(--eduflow-brand-200)" : "transparent"}`,
            }}
        >
            <span>{label}</span>
            <span
                className="font-mono"
                style={{
                    fontSize: 10,
                    color: active ? "var(--eduflow-brand-700)" : "var(--eduflow-text-tertiary)",
                }}
            >
                {count}
            </span>
        </button>
    );
}
