"use client";

import { motion } from "framer-motion";
import { Flame, Zap, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakDisplayProps {
    currentStreak: number;
    longestStreak: number;
    todayCompleted: boolean;
}

export function StreakDisplay({ currentStreak, longestStreak, todayCompleted }: StreakDisplayProps) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-apogee-abyss/70 border border-white/10 shadow-[0_16px_35px_rgba(4,8,18,0.45)]"
        >
            <motion.div
                animate={todayCompleted ? { scale: [1, 1.2, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center border border-white/10",
                    todayCompleted ? "bg-gradient-to-br from-apogee-gold to-apogee-crimson" : "bg-apogee-graphite/80"
                )}
            >
                <Flame className={cn("w-6 h-6", todayCompleted ? "text-white" : "text-apogee-metal/60")} />
            </motion.div>

            <div className="flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white">{currentStreak}</span>
                    <span className="text-sm text-apogee-metal/70">jours consécutifs</span>
                </div>
                <p className="text-xs text-apogee-metal/60">
                    Record : {longestStreak} jours
                </p>
            </div>

            {currentStreak >= 7 && (
                <motion.div
                    initial={{ rotate: -15 }}
                    animate={{ rotate: 15 }}
                    transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.5 }}
                >
                    <Star className="w-6 h-6 text-apogee-gold fill-apogee-gold" />
                </motion.div>
            )}
        </motion.div>
    );
}

interface QuickWinCardProps {
    title: string;
    description: string;
    points: number;
    completed: boolean;
    onClick?: () => void;
}

export function QuickWinCard({ title, description, points, completed, onClick }: QuickWinCardProps) {
    return (
        <motion.div
            whileHover={{ scale: completed ? 1 : 1.02 }}
            whileTap={{ scale: completed ? 1 : 0.98 }}
            onClick={!completed ? onClick : undefined}
            className={cn(
                "p-4 rounded-xl border transition-all cursor-pointer",
                completed
                    ? "border-apogee-emerald/30 bg-apogee-emerald/10 opacity-70"
                    : "border-white/10 bg-white/5 hover:border-apogee-cobalt/40 hover:shadow-[0_18px_40px_rgba(4,8,18,0.5)]"
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <h4 className={cn("font-medium", completed && "line-through")}>{title}</h4>
                    <p className="text-sm text-apogee-metal/70 mt-1">{description}</p>
                </div>
                <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-[0.65rem] font-semibold uppercase tracking-[0.24em]",
                    completed ? "bg-apogee-emerald text-white" : "bg-apogee-gold/15 text-apogee-gold"
                )}>
                    <Zap className="w-3 h-3" />
                    +{points}
                </div>
            </div>
        </motion.div>
    );
}

export function DailyQuickWins() {
    const wins = [
        { id: 1, title: "Connectez-vous", description: "Première action du jour", points: 5, completed: true },
        { id: 2, title: "Consultez le tableau de bord", description: "Vérifiez vos statistiques", points: 10, completed: true },
        { id: 3, title: "Saisissez une note", description: "Ajoutez une évaluation", points: 15, completed: false },
        { id: 4, title: "Envoyez un message", description: "Communiquez avec un parent", points: 10, completed: false },
    ];

    const totalPoints = wins.reduce((acc, w) => acc + (w.completed ? w.points : 0), 0);
    const maxPoints = wins.reduce((acc, w) => acc + w.points, 0);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-white">⚡ Objectifs du jour</h3>
                <span className="text-sm text-apogee-metal/70">
                    {totalPoints}/{maxPoints} points
                </span>
            </div>
            <div className="space-y-2">
                {wins.map(win => (
                    <QuickWinCard key={win.id} {...win} />
                ))}
            </div>
        </div>
    );
}
