"use client";

import { motion } from "framer-motion";
import { Check, Circle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface OnboardingStep {
    id: string;
    title: string;
    description: string;
    href: string;
    completed: boolean;
}

interface OnboardingChecklistProps {
    steps: OnboardingStep[];
    onDismiss?: () => void;
}

export function OnboardingChecklist({ steps, onDismiss }: OnboardingChecklistProps) {
    const completedCount = steps.filter(s => s.completed).length;
    const progress = (completedCount / steps.length) * 100;
    const allComplete = completedCount === steps.length;

    if (allComplete && onDismiss) {
        return null; // Hide when complete
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <Card className="border-2 border-primary/40 bg-gradient-to-r from-primary/10 via-violet-500/10 to-primary/10 shadow-md">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            🚀 Bienvenue sur EduPilot !
                        </CardTitle>
                        {onDismiss && (
                            <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs h-7">
                                Masquer
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                            <span className="font-medium">{completedCount}/{steps.length} complétées</span>
                            <span className="text-primary font-semibold">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-primary to-violet-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                            />
                        </div>
                    </div>

                    {/* Steps */}
                    <div className="space-y-2">
                        {steps.map((step, i) => (
                            <motion.div
                                key={step.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Link href={step.completed ? "#" : step.href}>
                                    <div className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg transition-all",
                                        step.completed
                                            ? "bg-green-500/10 opacity-60"
                                            : "bg-white dark:bg-gray-900 hover:bg-primary/5 cursor-pointer"
                                    )}>
                                        <div className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0",
                                            step.completed ? "bg-green-500 text-white" : "border-2 border-primary"
                                        )}>
                                            {step.completed ? (
                                                <Check className="w-4 h-4" />
                                            ) : (
                                                <Circle className="w-3 h-3 text-primary" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                "font-medium text-sm",
                                                step.completed && "line-through"
                                            )}>
                                                {step.title}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {step.description}
                                            </p>
                                        </div>
                                        {!step.completed && (
                                            <ArrowRight className="w-4 h-4 text-primary" />
                                        )}
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}

// Hook to get onboarding steps with completion status
export function useOnboardingSteps(stats?: { students: number; teachers: number; classes: number }) {
    const steps: OnboardingStep[] = [
        {
            id: "profile",
            title: "Complétez votre profil",
            description: "Ajoutez votre photo et informations",
            href: "/settings",
            completed: true, // Assume done after first login
        },
        {
            id: "class",
            title: "Créez votre première classe",
            description: "Organisez vos niveaux scolaires",
            href: "/school/classes/new",
            completed: (stats?.classes || 0) > 0,
        },
        {
            id: "teacher",
            title: "Ajoutez un enseignant",
            description: "Invitez votre équipe pédagogique",
            href: "/school/teachers/new",
            completed: (stats?.teachers || 0) > 0,
        },
        {
            id: "student",
            title: "Inscrivez un élève",
            description: "Commencez à gérer vos effectifs",
            href: "/school/students/new",
            completed: (stats?.students || 0) > 0,
        },
        {
            id: "import",
            title: "Importez en masse",
            description: "Gagnez du temps avec l'import CSV",
            href: "/school/import",
            completed: (stats?.students || 0) > 5, // Assume mass import if > 5 students
        },
    ];

    return steps;
}
