"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
    FileText, Users, BookOpen, GraduationCap, Calendar,
    MessageSquare, CreditCard, Library, Trophy, Utensils
} from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
    type: "students" | "teachers" | "classes" | "grades" | "messages" | "payments" | "library" | "achievements" | "canteen" | "default";
    title?: string;
    description?: string;
    actionLabel?: string;
    actionHref?: string;
}

const emptyStateConfig = {
    students: {
        icon: Users,
        title: "Aucun élève inscrit",
        description: "Commencez par ajouter vos premiers élèves pour débloquer toutes les fonctionnalités.",
        actionLabel: "Inscrire un élève",
        actionHref: "/school/students/new",
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
    },
    teachers: {
        icon: GraduationCap,
        title: "Aucun enseignant",
        description: "Ajoutez votre équipe pédagogique pour leur donner accès à la plateforme.",
        actionLabel: "Ajouter un enseignant",
        actionHref: "/school/teachers/new",
        color: "text-purple-500",
        bgColor: "bg-purple-500/10",
    },
    classes: {
        icon: BookOpen,
        title: "Aucune classe créée",
        description: "Créez vos premières classes pour organiser vos élèves et emplois du temps.",
        actionLabel: "Créer une classe",
        actionHref: "/school/classes/new",
        color: "text-green-500",
        bgColor: "bg-green-500/10",
    },
    grades: {
        icon: FileText,
        title: "Aucune note saisie",
        description: "Les notes apparaîtront ici une fois les premières évaluations effectuées.",
        actionLabel: "Saisir des notes",
        actionHref: "/grades",
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
    },
    messages: {
        icon: MessageSquare,
        title: "Aucun message",
        description: "Votre boîte de réception est vide. Commencez une conversation !",
        actionLabel: "Nouveau message",
        actionHref: "/messages",
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
    },
    payments: {
        icon: CreditCard,
        title: "Aucun paiement",
        description: "Les paiements apparaîtront ici une fois les frais configurés.",
        actionLabel: "Configurer les frais",
        actionHref: "/admin",
        color: "text-emerald-500",
        bgColor: "bg-emerald-500/10",
    },
    library: {
        icon: Library,
        title: "Bibliothèque vide",
        description: "Ajoutez des livres à votre catalogue pour permettre les emprunts.",
        actionLabel: "Ajouter un livre",
        actionHref: "/library",
        color: "text-amber-500",
        bgColor: "bg-amber-500/10",
    },
    achievements: {
        icon: Trophy,
        title: "Aucun trophée",
        description: "Continuez à utiliser EduPilot pour débloquer vos premiers succès !",
        actionLabel: "Voir les objectifs",
        actionHref: "/achievements",
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
    },
    canteen: {
        icon: Utensils,
        title: "Menu non configuré",
        description: "Configurez les menus de cantine pour cette semaine.",
        actionLabel: "Gérer les menus",
        actionHref: "/canteen",
        color: "text-red-500",
        bgColor: "bg-red-500/10",
    },
    default: {
        icon: Calendar,
        title: "Aucune donnée",
        description: "Il n'y a rien à afficher pour le moment.",
        actionLabel: "Retour",
        actionHref: "/dashboard",
        color: "text-gray-500",
        bgColor: "bg-gray-500/10",
    },
};

export function EmptyState({ type, title, description, actionLabel, actionHref }: EmptyStateProps) {
    const config = emptyStateConfig[type] || emptyStateConfig.default;
    const Icon = config.icon;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 px-4 text-center"
        >
            <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.1 }}
                className={`w-24 h-24 rounded-full ${config.bgColor} flex items-center justify-center mb-6`}
            >
                <Icon className={`w-12 h-12 ${config.color}`} />
            </motion.div>

            <motion.h3
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xl font-bold mb-2"
            >
                {title || config.title}
            </motion.h3>

            <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-muted-foreground max-w-md mb-6"
            >
                {description || config.description}
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <Link href={actionHref || config.actionHref}>
                    <Button size="lg" className="gap-2">
                        {actionLabel || config.actionLabel}
                    </Button>
                </Link>
            </motion.div>
        </motion.div>
    );
}
