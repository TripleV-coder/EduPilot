"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import { ChevronDown, ChevronUp, X, Sparkles, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import type { UserRole } from "@prisma/client";
import { trackUxEvent } from "@/lib/ux/telemetry";

interface ChecklistItem {
    id: string;
    label: string;
    href: string;
    check?: (data: any) => boolean;
}

const STORAGE_PREFIX = "edupilot_onboarding";
const METRICS_SUFFIX = "metrics";

const roleChecklists: Partial<Record<UserRole, ChecklistItem[]>> = {
    SUPER_ADMIN: [
        { id: "profile", label: "Compléter mon profil", href: "/dashboard/settings/profile", check: () => true },
        { id: "school", label: "Créer un établissement", href: "/dashboard/root-control/schools" },
        { id: "plan", label: "Configurer les plans", href: "/dashboard/root-control/plans" },
        { id: "users", label: "Vérifier les utilisateurs globaux", href: "/dashboard/root-control/users" },
    ],
    SCHOOL_ADMIN: [
        { id: "profile", label: "Compléter mon profil", href: "/dashboard/settings/profile", check: () => true },
        { id: "academic_year", label: "Configurer l'année académique", href: "/dashboard/settings/academic", check: (data) => (data?.academicYears ?? 0) > 0 },
        { id: "teacher", label: "Ajouter un enseignant", href: "/dashboard/teachers", check: (data) => (data?.teachers ?? 0) > 0 },
        { id: "class", label: "Créer une classe", href: "/dashboard/classes", check: (data) => (data?.classes ?? 0) > 0 },
        { id: "student", label: "Inscrire un élève", href: "/dashboard/students", check: (data) => (data?.students ?? 0) > 0 },
    ],
    DIRECTOR: [
        { id: "profile", label: "Compléter mon profil", href: "/dashboard/settings/profile", check: () => true },
        { id: "teacher", label: "Vérifier les enseignants", href: "/dashboard/teachers", check: (data) => (data?.teachers ?? 0) > 0 },
        { id: "class", label: "Valider les classes", href: "/dashboard/classes", check: (data) => (data?.classes ?? 0) > 0 },
        { id: "analytics", label: "Consulter les analytics", href: "/dashboard/analytics" },
    ],
    TEACHER: [
        { id: "profile", label: "Compléter mon profil", href: "/dashboard/settings/profile", check: () => true },
        { id: "attendance", label: "Faire le premier appel", href: "/dashboard/attendance" },
        { id: "grades", label: "Saisir une évaluation", href: "/dashboard/grades/entry" },
        { id: "messages", label: "Envoyer un message de classe", href: "/dashboard/messages" },
    ],
    STUDENT: [
        { id: "profile", label: "Compléter mon profil", href: "/dashboard/settings/profile", check: () => true },
        { id: "courses", label: "Consulter mes cours", href: "/dashboard/courses" },
        { id: "homework", label: "Vérifier mes devoirs", href: "/dashboard/homework" },
        { id: "exams", label: "Préparer mes examens", href: "/dashboard/exams" },
    ],
    PARENT: [
        { id: "profile", label: "Compléter mon profil", href: "/dashboard/settings/profile", check: () => true },
        { id: "children", label: "Consulter le suivi scolaire", href: "/dashboard" },
        { id: "finance", label: "Vérifier les paiements", href: "/dashboard/finance" },
        { id: "messages", label: "Contacter l'établissement", href: "/dashboard/messages" },
    ],
    ACCOUNTANT: [
        { id: "profile", label: "Compléter mon profil", href: "/dashboard/settings/profile", check: () => true },
        { id: "fees", label: "Contrôler les frais", href: "/dashboard/finance/fees" },
        { id: "payments", label: "Enregistrer un paiement", href: "/dashboard/finance/payments/new" },
        { id: "reconcile", label: "Faire une réconciliation", href: "/dashboard/finance/reconciliation" },
    ],
    STAFF: [
        { id: "profile", label: "Compléter mon profil", href: "/dashboard/settings/profile", check: () => true },
        { id: "attendance", label: "Suivre les présences", href: "/dashboard/attendance" },
        { id: "incidents", label: "Consulter les incidents", href: "/dashboard/incidents" },
        { id: "calendar", label: "Vérifier le calendrier", href: "/dashboard/calendar" },
    ],
};

export function OnboardingChecklist() {
    const { data: session } = useSession();
    const role = session?.user?.role as UserRole | undefined;
    const userId = session?.user?.id;
    const storageScope = `${STORAGE_PREFIX}:${userId || "anonymous"}:${role || "unknown"}`;
    const dismissKey = `${storageScope}:dismissed`;
    const completedKey = `${storageScope}:completed`;
    const metricsKey = `${storageScope}:${METRICS_SUFFIX}`;

    const [dismissedOverride, setDismissedOverride] = useState<boolean | null>(null);
    const [manualCompletedOverride, setManualCompletedOverride] = useState<string[] | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    const checklistItems = role ? (roleChecklists[role] || []) : [];
    const showChecklist = checklistItems.length > 0;
    const usesSetupStatus = role === "SCHOOL_ADMIN" || role === "DIRECTOR";

    // Fetch quick counts to determine completion for school admins/directors
    const { data: setupData } = useSWR(
        usesSetupStatus ? "/api/config/setup-status" : null,
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 60000 }
    );

    const dismissed = dismissedOverride ?? (
        typeof window === "undefined" || !role || !userId
            ? true
            : localStorage.getItem(dismissKey) === "true"
    );

    const manualCompleted = manualCompletedOverride ?? (() => {
        if (typeof window === "undefined" || !role || !userId) return [];
        const savedCompleted = localStorage.getItem(completedKey);
        if (!savedCompleted) return [];
        try {
            const parsed = JSON.parse(savedCompleted);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    })();

    const trackEvent = useCallback((event: string) => {
        if (typeof window === "undefined") return;
        const raw = localStorage.getItem(metricsKey);
        let metrics: Record<string, number | string>;
        try { metrics = raw ? JSON.parse(raw) : {}; } catch { metrics = {}; }
        if (!metrics.viewed) Object.assign(metrics, { viewed: 0, dismissed: 0, checked_step: 0, unchecked_step: 0, completed: 0 });
        metrics[event] = (Number(metrics[event]) || 0) + 1;
        metrics.lastEventAt = new Date().toISOString();
        localStorage.setItem(metricsKey, JSON.stringify(metrics));
        trackUxEvent("onboarding_event", { event, role: role || "UNKNOWN" });
    }, [metricsKey, role]);

    const handleDismiss = useCallback(() => {
        setDismissedOverride(true);
        if (typeof window !== "undefined") {
            localStorage.setItem(dismissKey, "true");
        }
        trackEvent("dismissed");
    }, [dismissKey, trackEvent]);

    const toggleManualDone = useCallback((id: string) => {
        setManualCompletedOverride((prev) => {
            const base = prev ?? manualCompleted;
            const next = base.includes(id) ? base.filter((item) => item !== id) : [...base, id];
            if (typeof window !== "undefined") {
                localStorage.setItem(completedKey, JSON.stringify(next));
            }
            trackEvent(base.includes(id) ? "unchecked_step" : "checked_step");
            return next;
        });
    }, [completedKey, manualCompleted, trackEvent]);

    useEffect(() => {
        if (!showChecklist || dismissed) return;
        trackEvent("viewed");
    }, [dismissed, showChecklist, trackEvent]);

    const completedItems = checklistItems.filter((item) => {
        const manual = manualCompleted.includes(item.id);
        const auto = item.check ? item.check(setupData) : false;
        return manual || auto;
    });
    const completedCount = completedItems.length;
    const totalCount = checklistItems.length;
    const allDone = totalCount > 0 && completedCount === totalCount;
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    useEffect(() => {
        if (!allDone || dismissed) return;
        trackEvent("completed");
        const timeoutId = window.setTimeout(() => handleDismiss(), 3000);
        return () => window.clearTimeout(timeoutId);
    }, [allDone, dismissed, handleDismiss, trackEvent]);

    if (!showChecklist || dismissed) return null;

    return (
        <AnimatePresence>
            <motion.aside
                aria-label="Démarrage rapide"
                className="fixed bottom-6 right-6 z-50 w-[320px]"
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.95 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
                <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-primary" />
                            <span className="text-sm font-semibold text-foreground">Démarrage rapide</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCollapsed(!collapsed)}
                                className="p-1 rounded-md hover:bg-muted transition-colors"
                                aria-label={collapsed ? "Développer" : "Réduire"}
                            >
                                {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-1 rounded-md hover:bg-muted transition-colors"
                                aria-label="Fermer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1 bg-muted">
                        <motion.div
                            className="h-full bg-primary rounded-r-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${progressPercent}%` }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        />
                    </div>

                    {/* Body */}
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="p-3 space-y-1">
                                    <p className="text-xs text-muted-foreground mb-3">
                                        {completedCount}/{totalCount} étapes complétées
                                    </p>
                                    {checklistItems.map((item) => {
                                        const isDone = manualCompleted.includes(item.id) || (item.check ? item.check(setupData) : false);
                                        return (
                                            <div
                                                key={item.id}
                                                className={cn(
                                                    "flex items-center gap-2 px-2 py-1 rounded-lg transition-all duration-150",
                                                    !isDone && "hover:bg-muted/40"
                                                )}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => toggleManualDone(item.id)}
                                                    className={cn(
                                                        "h-7 w-7 rounded-full flex items-center justify-center shrink-0 border transition-colors touch-target",
                                                        isDone
                                                            ? "bg-primary border-primary text-primary-foreground"
                                                            : "border-border bg-background text-muted-foreground hover:border-primary/40"
                                                    )}
                                                    aria-label={`${isDone ? "Marquer comme non fait" : "Marquer comme fait"}: ${item.label}`}
                                                >
                                                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                                                </button>
                                                <Link
                                                    href={item.href}
                                                    className={cn(
                                                        "flex-1 text-sm rounded-md px-2 py-1.5 transition-colors",
                                                        isDone
                                                            ? "text-muted-foreground"
                                                            : "text-foreground hover:bg-muted/50 cursor-pointer"
                                                    )}
                                                >
                                                    <span className={cn(isDone && "line-through")}>{item.label}</span>
                                                </Link>
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.aside>
        </AnimatePresence>
    );
}
