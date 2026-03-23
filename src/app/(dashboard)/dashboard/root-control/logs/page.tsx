"use client";

import { useEffect, useState } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Permission } from "@/lib/rbac/permissions";
import { Activity, Search, Filter, Loader2, AlertCircle, Clock, User, Building2, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { fr } from "date-fns/locale/fr";
import { cn } from "@/lib/utils";
import { formatAction, translateEntity } from "@/lib/utils/entity-translator";

type AuditLog = {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: string;
    ipAddress: string | null;
    user: {
        firstName: string;
        lastName: string;
        email: string;
    };
    school: {
        name: string;
    } | null;
};

export default function RootLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchLogs = async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/root/logs", { credentials: "include", cache: "no-store" });
                if (!res.ok) throw new Error("Erreur lors du chargement des journaux");
                const data = await res.json();
                setLogs(data.data || []);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const getActionBadge = (action: string, entity: string) => {
        const a = action.toLowerCase();
        const label = formatAction(action, entity);
        let colorClass = "bg-muted/50 text-foreground border-border";
        
        if (a.includes("create")) colorClass = "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
        else if (a.includes("update")) colorClass = "bg-blue-500/10 text-blue-600 border-blue-500/20";
        else if (a.includes("delete")) colorClass = "bg-destructive/10 text-destructive border-destructive/20";
        else if (a.includes("login")) {
            colorClass = a.includes("fail") ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-purple-500/10 text-purple-600 border-purple-500/20";
        }
        
        return <Badge className={cn("font-semibold text-[11px] shadow-sm tracking-normal", colorClass)}>{label}</Badge>;
    };

    return (
        <PageGuard permission={["*" as Permission]} roles={["SUPER_ADMIN"]}>
            <div className="space-y-6 max-w-7xl mx-auto">
                <PageHeader
                    title="Journal d'Infrastructure"
                    description="Historique complet des actions effectuées sur l'ensemble de la plateforme."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Root Control", href: "/dashboard/root-control" },
                        { label: "Journaux d'audit" },
                    ]}
                />

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                             
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="gap-2">
                        <Filter className="w-4 h-4" /> Filtres Avancés
                    </Button>
                </div>

                {error && (
                    <Card className="border-destructive/20 bg-destructive/5">
                        <CardContent className="p-4 flex items-center gap-3 text-destructive">
                            <AlertCircle className="w-5 h-5" />
                            <p className="text-sm font-medium">{error}</p>
                        </CardContent>
                    </Card>
                )}

                <Card className="border-none shadow-sm bg-card">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-20 gap-4">
                                <Loader2 className="animate-spin w-8 h-8 text-primary" />
                                <p className="text-sm text-muted-foreground animate-pulse font-medium">Chargement des données sécurisées...</p>
                            </div>
                        ) : logs.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted/50 text-muted-foreground font-bold uppercase text-[10px] tracking-wider border-b border-border/50">
                                        <tr>
                                            <th className="px-6 py-4">Action & Entité</th>
                                            <th className="px-6 py-4">Utilisateur</th>
                                            <th className="px-6 py-4">Établissement</th>
                                            <th className="px-6 py-4">Date & IP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                        {logs
                                            .filter(log => 
                                                log.user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                log.user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                log.entity.toLowerCase().includes(searchTerm.toLowerCase())
                                            )
                                            .map((log) => (
                                            <tr key={log.id} className="hover:bg-muted/5 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center w-full max-w-full truncate gap-2 flex-wrap">
                                                            {getActionBadge(log.action, log.entity)}
                                                        </div>
                                                        <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">ID: {log.entityId || "N/A"}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                                                            {log.user.firstName[0]}{log.user.lastName[0]}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold">{log.user.firstName} {log.user.lastName}</span>
                                                            <span className="text-[11px] text-muted-foreground">{log.user.email}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {log.school ? (
                                                        <div className="flex items-center gap-2 text-muted-foreground">
                                                            <Building2 className="w-3.5 h-3.5" />
                                                            <span className="font-medium text-xs text-foreground">{log.school.name}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 text-primary">
                                                            <Globe className="w-3.5 h-3.5" />
                                                            <span className="font-bold text-xs uppercase tracking-tight">Global / Système</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2 text-foreground font-medium">
                                                            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                                        </div>
                                                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded self-start">
                                                            IP: {log.ipAddress || "0.0.0.0"}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
                                <Activity className="w-10 h-10 text-muted-foreground/30" />
                                <p className="font-bold text-muted-foreground">Aucun log trouvé</p>
                                <p className="text-xs text-muted-foreground/60">Les journaux d'audit apparaîtront au fur et à mesure des actions.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </PageGuard>
    );
}
