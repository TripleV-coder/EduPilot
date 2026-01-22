"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    UserCheck,
    CreditCard,
    MessageSquare,
    X,
    Check,
    Loader2,
    ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLiteMode } from "@/components/providers/lite-mode-provider";

interface QuickAction {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    onClick: () => void;
}

interface QuickActionsProps {
    onAttendance?: () => void;
    onPayment?: () => void;
    onSMS?: () => void;
}

/**
 * Quick Actions Panel - 3 clics max pour les tâches courantes
 * Optimisé pour la réalité terrain béninoise
 */
export function QuickActionsPanel({ onAttendance, onPayment, onSMS }: QuickActionsProps) {
    const { isLiteMode } = useLiteMode();
    const [loading, setLoading] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleAction = async (id: string, action?: () => void) => {
        if (!action) return;

        setLoading(id);
        try {
            await action();
            setSuccess(id);
            setTimeout(() => setSuccess(null), 2000);
        } catch (error) {
            console.error("Quick action error:", error);
        } finally {
            setLoading(null);
        }
    };

    const actions: QuickAction[] = [
        {
            id: "attendance",
            label: "Présence",
            description: "Marquer absences/retards",
            icon: <UserCheck className="h-5 w-5" />,
            color: "text-emerald-600 bg-emerald-500/25 hover:bg-emerald-500/40 border-emerald-500/30",
            onClick: () => handleAction("attendance", onAttendance),
        },
        {
            id: "payment",
            label: "Paiement",
            description: "Enregistrer paiement",
            icon: <CreditCard className="h-5 w-5" />,
            color: "text-blue-600 bg-blue-500/25 hover:bg-blue-500/40 border-blue-500/30",
            onClick: () => handleAction("payment", onPayment),
        },
        {
            id: "sms",
            label: "SMS Parents",
            description: "Notifier les parents",
            icon: <MessageSquare className="h-5 w-5" />,
            color: "text-violet-600 bg-violet-500/25 hover:bg-violet-500/40 border-violet-500/30",
            onClick: () => handleAction("sms", onSMS),
        },
    ];

    const Wrapper = isLiteMode ? "div" : motion.div;
    const wrapperProps = isLiteMode ? {} : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3 }
    };

    return (
        <Wrapper {...wrapperProps}>
            <Card className="border border-primary/30 shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        ⚡ Actions Rapides
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {actions.map((action) => (
                            <Button
                                key={action.id}
                                variant="outline"
                                className={`h-auto py-3 px-3 flex flex-col items-center gap-1.5 transition-all duration-200 shadow-sm hover:shadow-md border ${action.color}`}
                                onClick={action.onClick}
                                disabled={loading === action.id}
                            >
                                <div className="relative">
                                    {loading === action.id ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : success === action.id ? (
                                        <Check className="h-5 w-5 text-emerald-600" />
                                    ) : (
                                        action.icon
                                    )}
                                </div>
                                <div className="text-center">
                                    <div className="font-semibold text-sm text-foreground">
                                        {action.label}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground">
                                        {action.description}
                                    </div>
                                </div>
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </Wrapper>
    );
}

export default QuickActionsPanel;
