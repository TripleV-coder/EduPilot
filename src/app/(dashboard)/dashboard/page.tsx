"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, BookOpen, GraduationCap, Banknote, Clock, AlertTriangle, TrendingUp, Plus, Library, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSchoolStats, useRecentActivity, useGradeDistribution } from "@/hooks/use-analytics";
import { OnboardingChecklist, useOnboardingSteps } from "@/components/onboarding/onboarding-checklist";
import { StreakDisplay } from "@/components/engagement/streak-display";
import { QuickActionsPanel } from "@/components/quick-actions/quick-actions-panel";
import { useRouter } from "next/navigation";

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.08 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring" as const, stiffness: 100 }
    }
};

export default function DashboardPage() {
    const { data: stats, isLoading } = useSchoolStats();
    const { data: activity } = useRecentActivity();
    const { data: gradeDistribution } = useGradeDistribution();
    const onboardingSteps = useOnboardingSteps(stats);
    const router = useRouter();

    const showOnboarding = onboardingSteps.filter(s => !s.completed).length > 0;

    return (
        <div className="space-y-4">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between"
            >
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Vue d&apos;ensemble
                    </h1>
                    <p className="text-sm text-muted-foreground">Bienvenue sur votre espace de gestion EduPilot.</p>
                </div>
            </motion.div>

            {/* Quick Actions - 3 clics max */}
            <QuickActionsPanel
                onAttendance={() => router.push("/attendance")}
                onPayment={() => router.push("/payments")}
                onSMS={() => router.push("/messages")}
            />

            {/* Onboarding & Engagement Row */}
            {showOnboarding && (
                <div className="grid gap-4 md:grid-cols-2">
                    <OnboardingChecklist steps={onboardingSteps} />
                    <div className="space-y-4">
                        <StreakDisplay
                            currentStreak={stats?.userStats?.streak || 0}
                            longestStreak={stats?.userStats?.longestStreak || 0}
                            todayCompleted={stats?.userStats?.todayCompleted || false}
                        />
                    </div>
                </div>
            )}

            {/* Main Stats Grid */}
            <motion.div
                className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <StatCard
                    title="Élèves"
                    value={stats?.students || 0}
                    icon={<Users className="h-5 w-5" />}
                    color="blue"
                    loading={isLoading}
                />
                <StatCard
                    title="Enseignants"
                    value={stats?.teachers || 0}
                    icon={<GraduationCap className="h-5 w-5" />}
                    color="purple"
                    loading={isLoading}
                />
                <StatCard
                    title="Classes"
                    value={stats?.classes || 0}
                    icon={<BookOpen className="h-5 w-5" />}
                    color="green"
                    loading={isLoading}
                />
                <StatCard
                    title="Paiements (mois)"
                    value={`${((stats?.payments.total || 0) / 1000).toFixed(0)}K XOF`}
                    subtitle={`${stats?.payments.count || 0} transactions`}
                    icon={<Banknote className="h-5 w-5" />}
                    color="emerald"
                    loading={isLoading}
                />
            </motion.div>

            {/* Attendance & Alerts Row */}
            <motion.div
                className="grid gap-4 md:grid-cols-2"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                <motion.div variants={itemVariants}>
                    <Card className="border-0 bg-gradient-to-br from-green-500/10 to-emerald-500/5 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                <Clock className="h-5 w-5" />
                                Présence Aujourd&apos;hui
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-4">
                                <motion.div
                                    className="text-5xl font-bold text-green-600"
                                    initial={{ scale: 0.5 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", delay: 0.3 }}
                                >
                                    {stats?.attendance.rate || 0}%
                                </motion.div>
                                <div className="text-sm text-muted-foreground pb-2">
                                    <span className="text-green-600 font-medium">{stats?.attendance.present || 0}</span> présents
                                    <span className="mx-2">·</span>
                                    <span className="text-red-500">{stats?.attendance.absent || 0}</span> absents
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                    <Card className="border-0 bg-gradient-to-br from-orange-500/10 to-red-500/5 backdrop-blur">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                                <AlertTriangle className="h-5 w-5" />
                                Alertes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {(stats?.overdueBooks || 0) > 0 && (
                                    <motion.div
                                        className="flex items-center gap-2 text-sm"
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                    >
                                        <Library className="h-4 w-4 text-orange-500" />
                                        <span>{stats?.overdueBooks} livres en retard</span>
                                    </motion.div>
                                )}
                                {(stats?.attendance.rate || 100) < 80 && (
                                    <motion.div
                                        className="flex items-center gap-2 text-sm text-red-600"
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                    >
                                        <TrendingUp className="h-4 w-4" />
                                        <span>Taux de présence faible</span>
                                    </motion.div>
                                )}
                                {(stats?.overdueBooks || 0) === 0 && (stats?.attendance.rate || 100) >= 80 && (
                                    <div className="text-sm text-green-600 font-medium">
                                        ✓ Aucune alerte active
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </motion.div>

            {/* Grade Distribution & Activity */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <motion.div
                    className="col-span-4"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-yellow-500" />
                                Distribution des Notes
                            </CardTitle>
                            <CardDescription>Répartition par tranche de performance</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-end gap-3 h-[200px]">
                                {gradeDistribution && Object.entries(gradeDistribution).map(([grade, count], i) => (
                                    <motion.div
                                        key={grade}
                                        className="flex-1 flex flex-col items-center gap-2"
                                        initial={{ height: 0 }}
                                        animate={{ height: "auto" }}
                                        transition={{ delay: 0.5 + i * 0.1 }}
                                    >
                                        <motion.div
                                            className={`w-full rounded-t-lg ${getGradeColor(grade)}`}
                                            style={{ height: `${Math.max(20, (count as number) * 3)}px` }}
                                            initial={{ scaleY: 0 }}
                                            animate={{ scaleY: 1 }}
                                            transition={{ delay: 0.6 + i * 0.1, type: "spring" }}
                                        />
                                        <span className="text-xs font-medium">{grade}</span>
                                        <span className="text-xs text-muted-foreground">{count as number}</span>
                                    </motion.div>
                                ))}
                                {!gradeDistribution && (
                                    <div className="flex-1 flex gap-3 items-end h-full">
                                        {[0.6, 0.8, 0.5, 0.7, 0.4].map((h, i) => (
                                            <div key={i} className="flex-1 flex flex-col items-center gap-2">
                                                <div
                                                    className="w-full bg-muted rounded-t-lg animate-pulse"
                                                    style={{ height: `${h * 150}px` }}
                                                />
                                                <div className="w-4 h-3 bg-muted rounded animate-pulse" />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <motion.div
                    className="col-span-3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle>Activité Récente</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {activity?.slice(0, 5).map((item, i) => (
                                    <motion.div
                                        key={i}
                                        className="flex justify-between text-sm border-b pb-2 last:border-0"
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.6 + i * 0.1 }}
                                    >
                                        <span>
                                            <strong>{item.user}</strong> · {item.action}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {new Date(item.time).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                    </motion.div>
                                ))}
                                {(!activity || activity.length === 0) && (
                                    <p className="text-muted-foreground text-sm">Aucune activité récente</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

        </div>
    );
}

function StatCard({ title, value, subtitle, icon, color, loading }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    color: string;
    loading?: boolean;
}) {
    const colorClasses: Record<string, string> = {
        blue: "from-blue-500/20 to-blue-600/5 text-blue-600",
        purple: "from-purple-500/20 to-purple-600/5 text-purple-600",
        green: "from-green-500/20 to-green-600/5 text-green-600",
        emerald: "from-emerald-500/20 to-emerald-600/5 text-emerald-600",
    };

    return (
        <motion.div variants={itemVariants}>
            <Card className={`border-0 bg-gradient-to-br ${colorClasses[color]} backdrop-blur hover:scale-[1.02] transition-transform`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{title}</CardTitle>
                    <div className={`p-2 rounded-lg bg-white/50 dark:bg-black/20 ${colorClasses[color].split(" ")[2]}`}>
                        {icon}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-bold">
                        {loading ? <div className="h-8 w-16 bg-current/10 rounded animate-pulse" /> : value}
                    </div>
                    {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
                </CardContent>
            </Card>
        </motion.div>
    );
}

function QuickActionButton({ href, icon, label, color }: {
    href: string;
    icon: React.ReactNode;
    label: string;
    color: string;
}) {
    const colorClasses: Record<string, string> = {
        blue: "hover:bg-blue-500/10 hover:border-blue-500/50 text-blue-600",
        purple: "hover:bg-purple-500/10 hover:border-purple-500/50 text-purple-600",
        green: "hover:bg-green-500/10 hover:border-green-500/50 text-green-600",
        orange: "hover:bg-orange-500/10 hover:border-orange-500/50 text-orange-600",
    };

    return (
        <Button
            variant="outline"
            className={`h-20 flex flex-col gap-2 transition-all ${colorClasses[color]}`}
            onClick={() => window.location.href = href}
        >
            <div className={colorClasses[color].split(" ")[2]}>
                {icon}
            </div>
            <span className="text-foreground">{label}</span>
        </Button>
    );
}

function getGradeColor(grade: string): string {
    const colors: Record<string, string> = {
        A: "bg-green-500",
        B: "bg-blue-500",
        C: "bg-yellow-500",
        D: "bg-orange-500",
        F: "bg-red-500",
    };
    return colors[grade] || "bg-gray-500";
}
