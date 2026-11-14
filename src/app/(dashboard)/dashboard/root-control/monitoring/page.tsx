"use client";

import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Server, Database, Activity, HardDrive, Cpu, Archive, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatTime } from "@/lib/utils/formatters";
import { formatAge, formatBytes, useRootMonitoring } from "@/hooks/use-root-monitoring";



// Garde AVANT le chargement : useRootMonitoring n'interroge /api/root/monitoring
// que pour le super-admin ; un autre rôle voit le refus, sans 403 en console.
export default function RootMonitoringPage() {
    return (
        <PageGuard roles={["SUPER_ADMIN"]}>
            <RootMonitoringContent />
        </PageGuard>
    );
}

function RootMonitoringContent() {
    const { data, loading, error } = useRootMonitoring();

    return (
        <>
            <PageShell>
                <PageHeader
                    title="Monitoring root (infrastructure)"
                    description="Surveillance globale des serveurs, bases de données et services de messagerie."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Pilotage root", href: "/dashboard/root-control" },
                        { label: "Monitoring Global" },
                    ]}
                />

                {error && (
                    <div role="alert" className="rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] px-4 py-3 text-sm text-destructive flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <Loader2 className="animate-spin w-8 h-8 text-primary" />
                    </div>
                ) : data ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <Card className="border-primary/20 bg-primary/5">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Server className="w-5 h-5 text-primary" />
                                        </div>
                                        <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))]">
                                            En ligne
                                        </Badge>
                                    </div>
                                    <h3 className="font-semibold text-lg">Système principal</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Comptes connectés (24 h) : {data.system.connectedAccounts24h}</p>
                                    {data.system.maintenanceMode && (
                                        <Badge variant="destructive" className="mt-2 text-xs">Maintenance Active</Badge>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className="border-border">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Database className="w-5 h-5 text-primary" />
                                        </div>
                                        {data.database.health.status === "excellent" || data.database.health.status === "good" ? (
                                            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))]">
                                                Stable
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">Critique</Badge>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg">PostgreSQL master</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Latence lecture: {data.database.health.responseTime}ms</p>
                                </CardContent>
                            </Card>

                            <Card className="border-border">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Database className="w-5 h-5 text-primary" />
                                        </div>
                                        {data.cache.connected ? (
                                            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))]">
                                                Synchronisé
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">Repli local</Badge>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg">Cache et état partagé</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Réponses servies par le cache : {data.cache.hitRate} %</p>
                                    {data.cache.memory && <p className="text-xs text-muted-foreground mt-0.5">Mémoire : {data.cache.memory}</p>}
                                </CardContent>
                            </Card>

                            <Card className={`border-border ${data.errors.last24h > 0 ? "border-warning/40 bg-warning/10" : ""}`}>
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className={`p-3 rounded-full ${data.errors.last24h > 0 ? "bg-warning/15" : "bg-muted"}`}>
                                            <Activity className={`w-5 h-5 ${data.errors.last24h > 0 ? "text-warning" : "text-muted-foreground"}`} />
                                        </div>
                                        {data.errors.last24h > 0 ? (
                                            <Badge variant="outline" className="text-warning border-warning/40 bg-warning/10">À examiner</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground">Normal</Badge>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg">Logs & erreurs</h3>
                                    <p className="text-sm text-muted-foreground mt-1">{data.errors.last24h} erreur{data.errors.last24h > 1 ? "s" : ""} / 24 h</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Journal des erreurs serveur et navigateur (remplace Sentry) :
                            chaque erreur distincte alerte aussi les super-administrateurs. */}
                        <Card className="border-border mt-6">
                            <CardContent className="pt-6">
                                <h3 className="font-semibold text-lg">Journal des erreurs</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Erreurs de l&apos;application et des navigateurs, conservées 30 jours. Chaque nouvelle erreur vous est signalée (notification et e-mail).
                                </p>
                                {data.errors.journal.recent.length === 0 ? (
                                    <p className="text-sm mt-4">Aucune erreur sur les dernières 24 h.</p>
                                ) : (
                                    <div className="mt-4 grid gap-6 lg:grid-cols-2">
                                        <div>
                                            <h4 className="text-sm font-semibold mb-2">Les plus fréquentes (7 jours)</h4>
                                            <ul className="grid gap-2">
                                                {data.errors.journal.frequent.map((e) => (
                                                    <li key={e.fingerprint} className="rounded-md border border-border p-3 text-sm">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <Badge variant="outline">{e.source === "client" ? "Navigateur" : "Serveur"}</Badge>
                                                            <span className="text-xs text-muted-foreground">{e.count} fois</span>
                                                        </div>
                                                        <p className="mt-1 break-words">{e.message}</p>
                                                        {e.path ? <p className="text-xs text-muted-foreground mt-0.5">{e.path}</p> : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold mb-2">Les plus récentes (24 h)</h4>
                                            <ul className="grid gap-2">
                                                {data.errors.journal.recent.slice(0, 8).map((e) => (
                                                    <li key={e.id} className="rounded-md border border-border p-3 text-sm">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <Badge variant="outline">{e.source === "client" ? "Navigateur" : "Serveur"}</Badge>
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(e.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                                                            </span>
                                                        </div>
                                                        <p className="mt-1 break-words">{e.message}</p>
                                                        {e.path ? <p className="text-xs text-muted-foreground mt-0.5">{e.path}</p> : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Lot 7 — ce dont l'exploitant a besoin sans ouvrir un
                            terminal : place, mémoire, dernière sauvegarde. */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                            <Card className="border-border">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Cpu className="w-5 h-5 text-primary" />
                                        </div>
                                        {data.host.memory.usedPercent >= 90 ? (
                                            <Badge variant="destructive">Saturée</Badge>
                                        ) : (
                                            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))]">
                                                Normale
                                            </Badge>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg">Mémoire</h3>
                                    <Progress value={data.host.memory.usedPercent} className="mt-3" />
                                    <p className="text-sm text-muted-foreground mt-2">
                                        {data.host.memory.usedPercent} % utilisée — {data.host.memory.freeMb} Mo libres sur {data.host.memory.totalMb} Mo
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Application : {data.host.memory.rssMb} Mo
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-border">
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <HardDrive className="w-5 h-5 text-primary" />
                                        </div>
                                        {!data.host.disk ? (
                                            <Badge variant="outline" className="text-muted-foreground">Indisponible</Badge>
                                        ) : data.host.disk.usedPercent >= 90 ? (
                                            <Badge variant="destructive">Presque plein</Badge>
                                        ) : (
                                            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))]">
                                                Suffisant
                                            </Badge>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg">Espace disque</h3>
                                    {data.host.disk ? (
                                        <>
                                            <Progress value={data.host.disk.usedPercent} className="mt-3" />
                                            <p className="text-sm text-muted-foreground mt-2">
                                                {data.host.disk.freeGb} Go libres sur {data.host.disk.totalGb} Go
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground mt-2">
                                            Mesure impossible sur ce système de fichiers.
                                        </p>
                                    )}
                                </CardContent>
                            </Card>

                            <Card className={`border-border ${data.host.backup.status === "ok" ? "" : "border-destructive/30 bg-destructive/5"}`}>
                                <CardContent className="pt-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <div className="p-3 bg-primary/10 rounded-full">
                                            <Archive className="w-5 h-5 text-primary" />
                                        </div>
                                        {data.host.backup.status === "ok" ? (
                                            <Badge className="bg-[hsl(var(--success-bg))] text-[hsl(var(--success))] hover:bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))]">
                                                À jour
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive">
                                                {data.host.backup.status === "stale" ? "Trop ancienne" : "Aucune"}
                                            </Badge>
                                        )}
                                    </div>
                                    <h3 className="font-semibold text-lg">Dernière sauvegarde</h3>
                                    {data.host.backup.lastSuccessAt ? (
                                        <>
                                            <p className="text-sm text-muted-foreground mt-2">
                                                {formatAge(data.host.backup.ageHours)} — {formatBytes(data.host.backup.sizeBytes)}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {data.host.backup.archives} archive(s) conservée(s)
                                                {data.host.backup.rowCount !== null && ` — ${data.host.backup.rowCount} lignes`}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="text-sm text-muted-foreground mt-2">
                                            {data.host.backup.status === "unavailable"
                                                ? "Répertoire de sauvegarde introuvable (BACKUP_DIR)."
                                                : "Aucune sauvegarde n'a encore été faite."}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {data.alerts && data.alerts.length > 0 && (
                            <div className="space-y-4 mt-6">
                                <h3 className="font-semibold text-lg">Alertes récentes</h3>
                                {data.alerts.map((alert, idx) => (
                                    <Card key={idx} className={`${alert.level === "critical" ? "border-destructive/30 bg-destructive/5" : alert.level === "warning" ? "border-warning/40 bg-warning/10" : "border-primary/30 bg-primary/5"} shadow-sm`}>
                                        <CardContent className="p-4 flex items-start gap-4">
                                            <AlertTriangle className={`w-6 h-6 shrink-0 mt-1 ${alert.level === "critical" ? "text-destructive" : alert.level === "warning" ? "text-warning" : "text-primary"}`} />
                                            <div>
                                                <h4 className={`font-semibold ${alert.level === "critical" ? "text-destructive" : alert.level === "warning" ? "text-warning" : "text-primary"}`}>
                                                    Alerte Système ({alert.level})
                                                </h4>
                                                <p className="text-sm text-foreground mt-1">{alert.message}</p>
                                                <p className="text-xs text-muted-foreground mt-2 font-mono">Dernière maj: {formatTime(alert.timestamp)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </>
                ) : null}
            </PageShell>
        </>
    );
}
