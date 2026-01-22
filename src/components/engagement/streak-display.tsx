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
            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20"
        >
            <motion.div
                animate={todayCompleted ? { scale: [1, 1.2, 1] } : {}}
                transition={{ repeat: Infinity, duration: 2 }}
                className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    todayCompleted ? "bg-gradient-to-br from-orange-500 to-yellow-500" : "bg-gray-300 dark:bg-gray-700"
                )}
            >
                <Flame className={cn("w-6 h-6", todayCompleted ? "text-white" : "text-gray-500")} />
            </motion.div>

            <div className="flex-1">
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-orange-600">{currentStreak}</span>
                    <span className="text-sm text-muted-foreground">jours consécutifs</span>
                </div>
                <p className="text-xs text-muted-foreground">
                    Record : {longestStreak} jours
                </p>
            </div>

            {currentStreak >= 7 && (
                <motion.div
                    initial={{ rotate: -15 }}
                    animate={{ rotate: 15 }}
                    transition={{ repeat: Infinity, repeatType: "reverse", duration: 0.5 }}
                >
                    <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
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
                "p-4 rounded-xl border-2 transition-all cursor-pointer",
                completed
                    ? "border-green-500/30 bg-green-500/5 opacity-60"
                    : "border-primary/20 bg-white dark:bg-gray-900 hover:border-primary/50 hover:shadow-lg"
            )}
        >
            <div className="flex items-start justify-between">
                <div>
                    <h4 className={cn("font-medium", completed && "line-through")}>{title}</h4>
                    <p className="text-sm text-muted-foreground mt-1">{description}</p>
                </div>
                <div className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold",
                    completed ? "bg-green-500 text-white" : "bg-yellow-500/20 text-yellow-600"
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
                <h3 className="font-bold">⚡ Objectifs du jour</h3>
                <span className="text-sm text-muted-foreground">
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
