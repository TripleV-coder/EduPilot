"use client";

import { useSchoolStats, useRecentActivity } from "@/hooks/use-analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, Banknote, Clock, AlertTriangle } from "lucide-react";

export function AnalyticsDashboard() {
    const { data: stats, isLoading } = useSchoolStats();
    const { data: activity } = useRecentActivity();

    if (isLoading) {
        return <div className="animate-pulse">Chargement des statistiques...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Key Metrics Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    title="Élèves"
                    value={stats?.students || 0}
                    icon={<Users className="h-4 w-4 text-muted-foreground" />}
                />
                <StatCard
                    title="Enseignants"
                    value={stats?.teachers || 0}
                    icon={<GraduationCap className="h-4 w-4 text-muted-foreground" />}
                />
                <StatCard
                    title="Classes"
                    value={stats?.classes || 0}
                    icon={<BookOpen className="h-4 w-4 text-muted-foreground" />}
                />
                <StatCard
                    title="Paiements (mois)"
                    value={`${(stats?.payments.total || 0).toLocaleString()} XOF`}
                    subtitle={`${stats?.payments.count || 0} transactions`}
                    icon={<Banknote className="h-4 w-4 text-muted-foreground" />}
                />
            </div>

            {/* Attendance & Alerts */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Présence Aujourd&apos;hui
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-apogee-emerald">
                            {stats?.attendance.rate || 0}%
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {stats?.attendance.present || 0} présents · {stats?.attendance.absent || 0} absents
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-apogee-gold" />
                            Alertes
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {(stats?.overdueBooks || 0) > 0 && (
                                <div className="text-sm">
                                    📚 {stats?.overdueBooks} livres en retard
                                </div>
                            )}
                            {(stats?.attendance.rate || 100) < 80 && (
                                <div className="text-sm text-apogee-crimson">
                                    ⚠️ Taux de présence faible
                                </div>
                            )}
                            {(stats?.overdueBooks || 0) === 0 && (stats?.attendance.rate || 100) >= 80 && (
                                <div className="text-sm text-apogee-emerald">
                                    ✓ Aucune alerte
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity */}
            <Card>
                <CardHeader>
                    <CardTitle>Activité Récente</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {activity?.slice(0, 5).map((item, i) => (
                            <div key={i} className="flex justify-between text-sm border-b pb-2">
                                <span>
                                    <strong>{item.user}</strong> · {item.action}
                                </span>
                                <span className="text-muted-foreground">
                                    {new Date(item.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                            </div>
                        ))}
                        {(!activity || activity.length === 0) && (
                            <p className="text-muted-foreground">Aucune activité récente</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function StatCard({
    title,
    value,
    subtitle,
    icon,
}: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </CardContent>
        </Card>
    );
}
