"use client";

import { useState, useEffect } from "react";

import { PageGuard } from "@/components/guard/page-guard";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { Permission } from "@/lib/rbac/permissions";
import { useToast } from "@/hooks/use-toast";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Spinner,
    type IconName,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageEmpty, PageLoading } from "@/components/layout/page-states";

type LeaderboardEntry = {
    id: string;
    points: number;
    rank: number | null;
    userId: string;
    user: { firstName: string; lastName: string; role: string };
};

interface Achievement {
    code?: string;
    name: string;
    description: string;
    icon: IconName;
    points: number;
    accent: "warning" | "success" | "brand" | "info";
}

interface StudentItem {
    id: string;
    userId: string;
    user?: { firstName: string; lastName: string };
}

const SHOWCASE_ACHIEVEMENTS: Achievement[] = [
    {
        name: "Premier de la classe",
        description: "Meilleure moyenne du trimestre",
        icon: "trophy",
        points: 500,
        accent: "warning",
    },
    {
        name: "Présence parfaite",
        description: "Aucune absence durant le mois",
        icon: "check",
        points: 200,
        accent: "success",
    },
    {
        name: "Super actif",
        description: "5 projets collaboratifs réalisés",
        icon: "sparkle",
        points: 300,
        accent: "brand",
    },
    {
        name: "Excellence",
        description: "Une note de 20/20 décrochée",
        icon: "trophy",
        points: 150,
        accent: "info",
    },
];

interface ApiAchievement {
    code?: string;
    name?: string;
    description?: string;
}

export default function GamificationPage() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const [isAwardDialogOpen, setIsAwardDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [allAchievements, setAllAchievements] = useState<ApiAchievement[]>([]);
    const [students, setStudents] = useState<StudentItem[]>([]);
    const [awardData, setAwardData] = useState({ userId: "", achievementCode: "" });

    useEffect(() => {
        const fetchLeaderboard = async () => {
            setLoading(true);
            try {
                const res = await fetch("/api/gamification/leaderboard?limit=10");
                if (res.ok) {
                    const data = await res.json();
                    setLeaderboard(data.leaderboard || data);
                }
            } finally {
                setLoading(false);
            }
        };

        const fetchAwardBasics = async () => {
            try {
                const [achRes, stuRes] = await Promise.all([
                    fetch("/api/gamification/achievements/award"),
                    fetch("/api/students?limit=100"),
                ]);
                if (achRes.ok) setAllAchievements(await achRes.json());
                if (stuRes.ok) {
                    const d = await stuRes.json();
                    setStudents(d.students || d.data || []);
                }
            } catch {
                // ignore — they're optional
            }
        };

        fetchLeaderboard();
        fetchAwardBasics();
    }, []);

    const handleAward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!awardData.userId || !awardData.achievementCode) return;
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/gamification/achievements/award", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(awardData),
            });
            if (!res.ok) throw new Error("Échec de l'attribution");
            toast({ title: "Succès !", description: "Badge attribué avec succès." });
            setIsAwardDialogOpen(false);
            setAwardData({ userId: "", achievementCode: "" });
            const lbRes = await fetch("/api/gamification/leaderboard?limit=10");
            if (lbRes.ok) {
                const data = await lbRes.json();
                setLeaderboard(data.leaderboard || data);
            }
        } catch {
            toast({
                title: "Erreur",
                description: "L'élève possède peut-être déjà ce badge.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <PageShell className="max-w-7xl pb-12">
                <PageHeader
                    title="Gamification & récompenses"
                    description="Classement et badges débloqués par les élèves pour leur mérite scolaire."
                    breadcrumbs={[
                        { label: "Vie scolaire" },
                        { label: "Gamification" },
                    ]}
                    actions={
                        <RoleActionGuard
                            allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}
                        >
                            <Dialog
                                open={isAwardDialogOpen}
                                onOpenChange={setIsAwardDialogOpen}
                            >
                                <DialogTrigger asChild>
                                    <Button icon="trophy">Récompenser un élève</Button>
                                </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Attribuer une récompense</DialogTitle>
                                            <DialogDescription>
                                                Sélectionne un élève et un badge pour booster sa
                                                motivation.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <form onSubmit={handleAward} className="flex flex-col gap-4 py-4">
                                            <FieldSelect
                                                label="Élève"
                                                value={awardData.userId}
                                                onChange={(v) =>
                                                    setAwardData({ ...awardData, userId: v })
                                                }
                                                placeholder="Choisir un élève"
                                                options={students.map((s) => ({
                                                    value: s.userId,
                                                    label: s.user
                                                        ? `${s.user.lastName} ${s.user.firstName}`
                                                        : s.id,
                                                }))}
                                            />
                                            <FieldSelect
                                                label="Récompense / badge"
                                                value={awardData.achievementCode}
                                                onChange={(v) =>
                                                    setAwardData({
                                                        ...awardData,
                                                        achievementCode: v,
                                                    })
                                                }
                                                placeholder="Choisir un badge"
                                                options={allAchievements.map((a) => ({
                                                    value: a.code ?? a.name ?? "",
                                                    label: a.name ?? a.code ?? "—",
                                                }))}
                                            />
                                            <DialogFooter>
                                                <Button
                                                    type="submit"
                                                    icon={isSubmitting ? undefined : "check"}
                                                    loading={isSubmitting}
                                                    disabled={
                                                        isSubmitting ||
                                                        !awardData.userId ||
                                                        !awardData.achievementCode
                                                    }
                                                >
                                                    Attribuer
                                                </Button>
                                            </DialogFooter>
                                        </form>
                                    </DialogContent>
                            </Dialog>
                        </RoleActionGuard>
                    }
                />

                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
                        gap: 16,
                    }}
                    className="dashboard-grid-collapse"
                >
                    <Card padding={0}>
                        <div
                            className="flex items-center gap-2 border-b px-5 py-4"
                            style={{ borderColor: "var(--eduflow-border-subtle)" }}
                        >
                            <Icon name="trophy" size={18} color="var(--brand-700)" />
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Classement des étoiles montantes
                            </h3>
                        </div>
                        {loading ? (
                            <PageLoading label="Chargement du classement…" />
                        ) : leaderboard.length === 0 ? (
                            <PageEmpty
                                icon="trophy"
                                title="Aucun point attribué"
                                description="Récompensez les premiers élèves pour lancer le classement."
                            />
                        ) : (
                            leaderboard.map((entry, idx) => {
                                const rank = entry.rank ?? idx + 1;
                                return (
                                    <LeaderboardRow
                                        key={entry.id}
                                        entry={entry}
                                        rank={rank}
                                        isFirst={idx === 0}
                                    />
                                );
                            })
                        )}
                    </Card>

                    <Card padding={20}>
                        <div className="flex items-center gap-2 mb-4">
                            <Icon name="sparkle" size={18} color="var(--brand-700)" />
                            <h3 className="eduflow-display" style={{ fontSize: 18, margin: 0 }}>
                                Badges disponibles
                            </h3>
                        </div>
                        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--eduflow-text-tertiary)" }}>Aperçu de quelques récompenses</p>
                        <div className="flex flex-col gap-3">
                            {SHOWCASE_ACHIEVEMENTS.map((a) => (
                                <div
                                    key={a.name}
                                    className="flex items-start gap-3 rounded-xl p-3"
                                    style={{
                                        background: "var(--eduflow-surface-sunken)",
                                    }}
                                >
                                    <div
                                        className="grid place-items-center"
                                        style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 10,
                                            background:
                                                a.accent === "brand"
                                                    ? "var(--brand-100)"
                                                    : `var(--eduflow-${a.accent}-100)`,
                                            color:
                                                a.accent === "brand"
                                                    ? "var(--brand-700)"
                                                    : `var(--eduflow-${a.accent}-700)`,
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Icon name={a.icon} size={18} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                                            {a.name}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                marginTop: 2,
                                            }}
                                        >
                                            {a.description}
                                        </div>
                                    </div>
                                    <Badge variant={a.accent} size="sm">
                                        +{a.points} pts
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </PageShell>
        </PageGuard>
    );
}

function LeaderboardRow({
    entry,
    rank,
    isFirst,
}: {
    entry: LeaderboardEntry;
    rank: number;
    isFirst: boolean;
}) {
    const fullName = `${entry.user.firstName} ${entry.user.lastName}`;
    const isPodium = rank <= 3;
    const podiumIcon: IconName | null = rank === 1 ? "trophy" : rank <= 3 ? "trophy" : null;
    const podiumBg =
        rank === 1
            ? "linear-gradient(135deg, var(--eduflow-warning-400), var(--eduflow-warning-600))"
            : rank === 2
            ? "linear-gradient(135deg, var(--eduflow-neutral-400), var(--eduflow-neutral-600))"
            : rank === 3
            ? "linear-gradient(135deg, var(--eduflow-warning-300), var(--eduflow-danger-500))"
            : "var(--eduflow-surface-sunken)";

    return (
        <div
            className="flex items-center gap-3 px-5 py-3"
            style={{
                borderTop: isFirst ? "none" : "1px solid var(--eduflow-border-subtle)",
                background: isPodium ? "var(--brand-50)" : "transparent",
                transition:
                    "background var(--eduflow-motion-fast) var(--eduflow-ease-out)",
            }}
        >
            <div
                className="grid place-items-center"
                style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: podiumBg,
                    color: isPodium ? "#fff" : "var(--eduflow-text-secondary)",
                    fontFamily: "var(--eduflow-font-display)",
                    fontWeight: 700,
                    fontSize: 14,
                    flexShrink: 0,
                    boxShadow: isPodium
                        ? "0 4px 12px rgba(245, 158, 11, 0.25)"
                        : "none",
                }}
            >
                {podiumIcon ? <Icon name={podiumIcon} size={16} /> : `#${rank}`}
            </div>
            <Avatar name={fullName} size="sm" />
            <div className="min-w-0 flex-1">
                <div
                    style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--eduflow-text-primary)",
                    }}
                >
                    {fullName}
                </div>
                <div
                    style={{
                        fontSize: 11,
                        color: "var(--eduflow-text-tertiary)",
                    }}
                >
                    {entry.user.role}
                </div>
            </div>
            <div className="text-right">
                <div
                    className="eduflow-display eduflow-tabular"
                    style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: isPodium ? "var(--brand-700)" : "var(--eduflow-text-primary)",
                        lineHeight: 1,
                    }}
                >
                    {entry.points}
                </div>
                <div
                    style={{
                        fontSize: 10,
                        color: "var(--eduflow-text-tertiary)",
                        marginTop: 2,
                    }}
                >
                    points
                </div>
            </div>
        </div>
    );
}

function FieldSelect({
    label,
    value,
    onChange,
    options,
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
}) {
    return (
        <label className="block">
            <span
                style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--eduflow-text-tertiary)",
                    marginBottom: 6,
                }}
            >
                {label}
            </span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    width: "100%",
                    height: 38,
                    padding: "0 12px",
                    borderRadius: "var(--eduflow-radius-input)",
                    border: "1px solid var(--eduflow-border-default)",
                    background: "var(--eduflow-surface-card)",
                    fontFamily: "inherit",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--eduflow-text-primary)",
                    cursor: "pointer",
                    outline: "none",
                }}
            >
                <option value="">{placeholder}</option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </label>
    );
}
