"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Permission } from "@/lib/rbac/permissions";
import {
    Shield, Search, Loader2, History, AlertTriangle,
    User, Calendar, FileText, ChevronRight, CheckCircle2, ShieldAlert, ArrowUpDown, Download
} from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { TrendLineChart } from "@/components/charts/TrendLineChart";
import { useDebounce } from "@/hooks/use-debounce";
import { t } from "@/lib/i18n";
import { formatAction, translateEntity } from "@/lib/utils/entity-translator";
import { formatUserRoleLabel } from "@/lib/utils/role-label";

type AuditLog = {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    createdAt: string;
    user: {
        firstName: string;
        lastName: string;
        email: string;
        role: string;
    };
};

const FLOW_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const };

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearch = useDebounce(searchTerm, 300);
    const [actionFilter, setActionFilter] = useState("ALL");
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/audit-logs?limit=500");
            if (res.ok) {
                const data = await res.json();
                setLogs(data.logs || []);
            }
        } catch (error) {
            console.error("Failed to fetch logs", error);
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = async () => {
        try {
            const res = await fetch("/api/audit-logs/export");
            if (!res.ok) throw new Error();
            const csv = await res.text();
            const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit_logs_${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch { console.error("Export failed"); }
    };

    // Client-side filtering
    const filteredLogs = logs.filter(log => {
        const matchesSearch = !debouncedSearch || [
            log.user?.firstName, log.user?.lastName, log.user?.email,
            log.action, log.entity, log.entityId
        ].some(field => field?.toLowerCase().includes(debouncedSearch.toLowerCase()));

        const matchesAction = actionFilter === "ALL" ||
            (actionFilter === "CREATE" && log.action.toLowerCase().includes("create")) ||
            (actionFilter === "UPDATE" && log.action.toLowerCase().includes("update")) ||
            (actionFilter === "DELETE" && log.action.toLowerCase().includes("delete")) ||
            (actionFilter === "OTHER" && !["create", "update", "delete"].some(a => log.action.toLowerCase().includes(a)));

        return matchesSearch && matchesAction;
    });

    const getActionDetails = (action: string) => {
        const actionLower = action.toLowerCase();
        if (actionLower.includes("delete") || actionLower.includes("remove")) {
            return { color: "text-red-600 bg-red-500/10 border-red-500/20", icon: <ShieldAlert className="w-3.5 h-3.5" /> };
        }
        if (actionLower.includes("update") || actionLower.includes("edit")) {
            return { color: "text-amber-600 bg-amber-500/10 border-amber-500/20", icon: <AlertTriangle className="w-3.5 h-3.5" /> };
        }
        if (actionLower.includes("create") || actionLower.includes("add")) {
            return { color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="w-3.5 h-3.5" /> };
        }
        return { color: "text-blue-600 bg-blue-500/10 border-blue-500/20", icon: <History className="w-3.5 h-3.5" /> };
    };

    // Compute chart data
    const actionsByRole = Object.entries(
        logs.reduce((acc, log) => {
            const role = log.user?.role || "SYSTEM";
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).map(([name, value]) => ({ name: formatUserRoleLabel(name), value })).sort((a, b) => b.value - a.value);

    const actionsByDay = Object.entries(
        logs.reduce((acc, log) => {
            const date = new Date(log.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
            acc[date] = (acc[date] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).slice(-14).map(([name, value]) => ({ name, value }));

    const columns: ColumnDef<AuditLog>[] = [
        {
            id: "user",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Utilisateur <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => `${row.user?.firstName || "System"} ${row.user?.lastName || ""}`,
            cell: ({ row }) => {
                const log = row.original;
                return (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {log.user?.firstName?.[0] || "?"}{log.user?.lastName?.[0] || "?"}
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-foreground text-sm">
                                {log.user?.firstName || "System"} {log.user?.lastName || ""}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                {log.user?.email || "internal-system"}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            id: "action",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Action <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => row.action,
            cell: ({ row }) => {
                const log = row.original;
                const action = getActionDetails(log.action);
                return (
                    <div className="flex flex-col gap-1.5 items-start">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border shadow-sm ${action.color}`}>
                            {action.icon} {formatAction(log.action, log.entity)}
                        </span>
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] mt-1">
                            <FileText className="w-3.5 h-3.5" />
                            <span className="font-semibold text-foreground/80 capitalize">{translateEntity(log.entity)}</span>
                            <code className="bg-muted px-1 py-0.5 rounded text-[10px] ml-1">{log.entityId.slice(0, 8)}...</code>
                        </div>
                    </div>
                );
            },
        },
        {
            id: "date",
            header: ({ column }) => (
                <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
                    Horodatage <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            accessorFn: (row) => new Date(row.createdAt).getTime(),
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm font-mono">
                    {new Date(row.original.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit", second: "2-digit"
                    })}
                </span>
            ),
        },
    ];

    return (
        <PageGuard permission={Permission.SCHOOL_UPDATE} roles={["SUPER_ADMIN", "SCHOOL_ADMIN"]}>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                <PageHeader
                    title="Console d'Audit & Sécurité"
                    description="Visualisez l'historique complet des actions effectuées par les utilisateurs sur la plateforme EduPilot."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Administration" },
                        { label: "Audit Logs" },
                    ]}
                />

                <div className="flex justify-end">
                    <Button variant="outline" onClick={exportCSV} className="gap-2 touch-target">
                        <Download className="w-4 h-4" /> Export CSV
                    </Button>
                </div>

                {/* Charts Row */}
                {logs.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Actions par rôle</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CategoryPieChart data={actionsByRole} />
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold">Activité journalière</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <TrendLineChart data={actionsByDay} label="Actions" domain={[0, Math.max(10, ...actionsByDay.map(d => d.value))]} />
                            </CardContent>
                        </Card>
                    </div>
                )}

                <Card className="shadow-sm border-border overflow-hidden">
                    <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row items-center gap-4">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                
                                className="pl-9 bg-background"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <Select value={actionFilter} onValueChange={setActionFilter}>
                            <SelectTrigger className="w-[160px] bg-background">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Toutes les actions</SelectItem>
                                <SelectItem value="CREATE">Création</SelectItem>
                                <SelectItem value="UPDATE">Modification</SelectItem>
                                <SelectItem value="DELETE">Suppression</SelectItem>
                                <SelectItem value="OTHER">Autre</SelectItem>
                            </SelectContent>
                        </Select>
                        {actionFilter !== "ALL" && (
                            <Button variant="ghost" size="sm" className="h-9 text-xs touch-target" onClick={() => setActionFilter("ALL")}>
                                {t("common.reset")}
                            </Button>
                        )}
                    </div>

                    {loading ? (
                        <div className="p-4 space-y-3">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className="h-14 rounded-lg bg-muted/40 skeleton-shimmer" />
                            ))}
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="px-6 py-16 text-center text-muted-foreground">
                            <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-lg font-medium text-foreground">Aucun historique d&apos;audit</p>
                            <p className="text-sm">Le journal système est actuellement vide.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 p-3">
                            <DataTable columns={columns} data={filteredLogs} searchKey="user" searchPlaceholder="Filtrer..." />
                            <div className="rounded-lg border border-border/60 overflow-hidden">
                                <div className="max-h-[260px] overflow-y-auto">
                                    {filteredLogs.slice(0, 10).map((log) => (
                                        <button
                                            key={log.id}
                                            className="touch-target w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-muted/40 transition-colors"
                                            onClick={() => setSelectedLog(log)}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <span className="text-xs font-semibold text-foreground capitalize">
                                                    {log.user?.firstName || "System"} {log.user?.lastName || ""} · {translateEntity(log.entity)}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {new Date(log.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground mt-1">{formatAction(log.action, log.entity)}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </Card>

                {selectedLog && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={FLOW_TRANSITION}
                    >
                        <Card className="border-border shadow-sm bg-card/85">
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm">Détail de l'action</CardTitle>
                                    <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)}>
                                        Fermer
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="text-sm space-y-2">
                                <p><span className="text-muted-foreground">Utilisateur:</span> {selectedLog.user?.firstName || "System"} {selectedLog.user?.lastName || ""}</p>
                                <p><span className="text-muted-foreground">Action:</span> {formatAction(selectedLog.action, selectedLog.entity)}</p>
                                <p><span className="text-muted-foreground flex items-center gap-2">Entité: <span className="capitalize">{translateEntity(selectedLog.entity)}</span></span></p>
                                <p><span className="text-muted-foreground">ID:</span> <code className="bg-muted px-1 py-0.5 rounded text-xs select-all text-primary">{selectedLog.entityId}</code></p>
                                <p><span className="text-muted-foreground">Date:</span> {new Date(selectedLog.createdAt).toLocaleString("fr-FR")}</p>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>
        </PageGuard>
    );
}
