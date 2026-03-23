"use client";

import { useState, useEffect } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Permission } from "@/lib/rbac/permissions";
import {
    Trophy, Star, Medal, Target, Zap, Loader2, Award, ArrowUp, Crown, Plus, CheckCircle2
} from "lucide-react";
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { formatUserRoleLabel } from "@/lib/utils/role-label";

type LeaderboardEntry = {
    id: string;
    points: number;
    rank: number | null;
    userId: string;
    user: { firstName: string; lastName: string; role: string; };
};

export default function GamificationPage() {
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    // Award form state
    const [isAwardDialogOpen, setIsAwardDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [allAchievements, setAllAchievements] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);
    const [awardData, setAwardData] = useState({ userId: "", achievementCode: "" });

    useEffect(() => {
        fetchLeaderboard();
        fetchAwardBasics();
    }, []);

    const fetchAwardBasics = async () => {
        try {
            const [achRes, stuRes] = await Promise.all([
                fetch("/api/gamification/achievements/award"),
                fetch("/api/students?limit=100")
            ]);
            if (achRes.ok) setAllAchievements(await achRes.json());
            if (stuRes.ok) {
                const d = await stuRes.json();
                setStudents(d.students || d.data || []);
            }
        } catch (err) {}
    };

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
            fetchLeaderboard();
        } catch (err) {
            toast({ title: "Erreur", description: "L'élève possède peut-être déjà ce badge.", variant: "destructive" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const fetchLeaderboard = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/gamification/leaderboard?limit=10");
            if (res.ok) {
                const data = await res.json();
                setLeaderboard(data.leaderboard || data);
            }
        } catch (error) {
            console.error("Failed to fetch leaderboard", error);
        } finally {
            setLoading(false);
        }
    };

    const getRankStyle = (rank: number | null | undefined, index: number) => {
        const actualRank = rank || index + 1;
        switch (actualRank) {
            case 1: return "bg-gradient-to-br from-yellow-300 to-yellow-600 text-white shadow-yellow-500/50";
            case 2: return "bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-slate-500/50";
            case 3: return "bg-gradient-to-br from-amber-600 to-amber-800 text-white shadow-amber-700/50";
            default: return "bg-muted text-muted-foreground";
        }
    };

    const getRankIcon = (rank: number | null | undefined, index: number) => {
        const actualRank = rank || index + 1;
        switch (actualRank) {
            case 1: return <Crown className="w-5 h-5" />;
            case 2: return <Medal className="w-5 h-5" />;
            case 3: return <Medal className="w-5 h-5" />;
            default: return <span className="font-bold text-sm">#{actualRank}</span>;
        }
    };

    // Dummy achievements for the UI since they might not be fully seeded
    const dummyAchievements = [
        { name: "Premier de la classe", description: "Avoir la meilleure moyenne au 1er trimestre", icon: Trophy, points: 500, color: "text-amber-500", bg: "bg-amber-500/10" },
        { name: "Présence Parfaite", description: "Aucune absence durant le mois", icon: Target, points: 200, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        { name: "Super Actif", description: "A participé à 5 projets collaboratifs", icon: Zap, points: 300, color: "text-blue-500", bg: "bg-blue-500/10" },
        { name: "Excellence", description: "Avoir une note de 20/20", icon: Star, points: 150, color: "text-purple-500", bg: "bg-purple-500/10" }
    ];

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                <PageHeader
                    title="Gamification & Récompenses"
                    description="Découvrez le classement de l'école et les badges débloqués par les élèves pour leur mérite."
                    breadcrumbs={[
                        { label: "Tableau de bord", href: "/dashboard" },
                        { label: "Académique" },
                        { label: "Gamification" },
                    ]}
                    actions={
                        <RoleActionGuard allowedRoles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]}>
                            <Dialog open={isAwardDialogOpen} onOpenChange={setIsAwardDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button className="gap-2">
                                        <Plus className="w-4 h-4" /> Récompenser un élève
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Attribuer une récompense</DialogTitle>
                                        <DialogDescription>
                                            Sélectionnez un élève et un badge pour booster sa motivation.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <form onSubmit={handleAward} className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Élève</Label>
                                            <Select onValueChange={(val) => setAwardData({ ...awardData, userId: val })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {students.map((s) => (
                                                        <SelectItem key={s.id} value={s.userId}>
                                                            {s.user?.lastName} {s.user?.firstName}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Récompense / Badge</Label>
                                            <Select onValueChange={(val) => setAwardData({ ...awardData, achievementCode: val })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {allAchievements.map((a) => (
                                                        <SelectItem key={a.id} value={a.code}>
                                                            {a.name} (+{a.points} pts)
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <DialogFooter>
                                            <Button type="submit" disabled={isSubmitting || !awardData.userId || !awardData.achievementCode} className="gap-2">
                                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                                Attribuer maintenant
                                            </Button>
                                        </DialogFooter>
                                    </form>
                                </DialogContent>
                            </Dialog>
                        </RoleActionGuard>
                    }
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Colonne de Classement */}
                    <Card className="md:col-span-1 shadow-sm border-border flex flex-col min-h-[500px]">
                        <CardHeader className="border-b bg-muted/20 pb-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-amber-500" />
                                Tableau Central (Leaderboard)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center p-12">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                                    <p className="text-muted-foreground text-sm">Chargement du classement...</p>
                                </div>
                            ) : leaderboard.length === 0 ? (
                                <div className="text-center p-12 text-muted-foreground border-b last:border-0 border-border/50">
                                    <Trophy className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p className="font-medium text-foreground">Aucun classement</p>
                                    <p className="text-xs">Les élèves n'ont pas encore accumulé assez de points.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-border/50">
                                    {leaderboard.map((entry, idx) => (
                                        <div key={entry.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${getRankStyle(entry.rank, idx)}`}>
                                                    {getRankIcon(entry.rank, idx)}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-foreground text-sm">
                                                        {entry.user?.firstName} {entry.user?.lastName}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 tracking-wider">
                                                        {formatUserRoleLabel(entry.user?.role)}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <div className="font-bold text-lg text-primary">{entry.points}</div>
                                                <div className="text-[10px] text-muted-foreground font-medium uppercase">Points</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Colonne Badges */}
                    <Card className="md:col-span-2 shadow-sm border-border">
                        <CardHeader className="border-b bg-muted/20 pb-4">
                            <CardTitle className="text-lg flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Star className="w-5 h-5 text-primary" />
                                    Badges d'Excellence & Succès
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {dummyAchievements.map((ach, idx) => (
                                    <div key={idx} className="border rounded-xl p-4 flex gap-4 hover:border-primary/50 transition-colors cursor-pointer bg-card group">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${ach.bg} ${ach.color}`}>
                                            <ach.icon className="w-7 h-7" />
                                        </div>
                                        <div className="flex flex-col justify-center">
                                            <h4 className="font-bold text-foreground mb-1">{ach.name}</h4>
                                            <p className="text-xs text-muted-foreground leading-snug break-words line-clamp-2">{ach.description}</p>
                                            <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full w-fit">
                                                <ArrowUp className="w-3 h-3" /> {ach.points} XP
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-xl border border-primary/20">
                                <h3 className="font-bold text-lg text-foreground mb-2 flex items-center gap-2">
                                    <Zap className="w-5 h-5 text-primary fill-primary" />
                                    Comment gagner des points ?
                                </h3>
                                <p className="text-sm text-foreground/80 leading-relaxed max-w-2xl">
                                    La plateforme EduPilot récompense l'excellence. Les enseignants peuvent attribuer des succès pour les bonnes conduites, les devoirs exceptionnels, la participation ou l'assistance à un autre élève. L'algorithme calcule le classement Leaderboard de toute l'école en direct.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PageGuard>
    );
}
