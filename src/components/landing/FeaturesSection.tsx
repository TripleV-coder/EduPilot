"use client";

import { motion } from "framer-motion";
import { t } from "@/lib/i18n";
import { Users, FileText, Clock, DollarSign, MessageSquare, BarChart3, Layers, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SectionHeader } from "./SectionHeader";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Feature {
    key: string;
    icon: LucideIcon;
    gradient: string;
}

const features: Feature[] = [
    { key: "students", icon: Users, gradient: "from-primary/20 to-secondary/10" },
    { key: "grades", icon: FileText, gradient: "from-secondary/20 to-accent/10" },
    { key: "schedule", icon: Clock, gradient: "from-accent/20 to-primary/10" },
    { key: "finance", icon: DollarSign, gradient: "from-primary/15 to-accent/15" },
    { key: "communication", icon: MessageSquare, gradient: "from-secondary/15 to-primary/15" },
    { key: "analytics", icon: BarChart3, gradient: "from-accent/15 to-secondary/15" },
];

const onboardingSteps = [
    {
        id: "01",
        title: "Configurer l'établissement",
        description: "Créez vos structures, classes, cycles et paramètres académiques.",
        href: "/dashboard/settings/school",
        cta: "Paramétrer",
    },
    {
        id: "02",
        title: "Importer les utilisateurs",
        description: "Ajoutez élèves, enseignants et rôles avec rattachement automatique.",
        href: "/dashboard/students",
        cta: "Importer",
    },
    {
        id: "03",
        title: "Piloter avec le dashboard",
        description: "Suivez performances, finance, assiduité et alertes en temps réel.",
        href: "/dashboard",
        cta: "Ouvrir le dashboard",
    },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.1, delayChildren: 0.15 },
    },
};

const itemVariants = {
    hidden: { y: 24, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
    },
};

export function FeaturesSection() {
    return (
        <section id="features" className="py-24 md:py-32 bg-white dark:bg-zinc-950 relative overflow-hidden border-b border-zinc-100 dark:border-zinc-900">
            <div className="container mx-auto px-4">
                <div className="mb-20">
                    <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] mb-4">Fonctionnalités</p>
                    <h2 className="text-4xl md:text-5xl font-sans font-black tracking-tighter text-zinc-900 dark:text-white uppercase leading-[0.9]">
                        Une architecture logicielle <br /> <span className="text-zinc-400">sans compromis</span>
                    </h2>
                </div>

                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-zinc-100 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-900 max-w-7xl mx-auto"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                >
                    {features.map((feature) => (
                        <motion.div
                            key={feature.key}
                            variants={itemVariants}
                            className="group relative bg-white dark:bg-zinc-950 p-10 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50 cursor-crosshair"
                        >
                            <div className="inline-flex items-center justify-center w-10 h-10 border border-zinc-200 dark:border-zinc-800 mb-8">
                                <feature.icon className="h-5 w-5 text-primary" />
                            </div>
                            <h3 className="text-xs font-black text-zinc-900 dark:text-white mb-4 uppercase tracking-widest">
                                {t(`landing.features.${feature.key}.title`)}
                            </h3>
                            <p className="text-sm text-zinc-500 leading-relaxed font-medium">
                                {t(`landing.features.${feature.key}.description`)}
                            </p>
                        </motion.div>
                    ))}
                </motion.div>

                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.6 }}
                    className="mt-24 border border-zinc-100 dark:border-zinc-900 p-8 md:p-12 max-w-7xl mx-auto"
                >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {onboardingSteps.map((step) => (
                            <div key={step.id} className="group">
                                <div className="text-[10px] font-black text-zinc-300 dark:text-zinc-700 uppercase tracking-widest mb-6">
                                    Phase {step.id}
                                </div>
                                <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase mb-4 tracking-tight">{step.title}</h4>
                                <p className="text-xs leading-relaxed text-zinc-500 font-medium mb-6">{step.description}</p>
                                <Button asChild variant="link" className="p-0 h-auto text-[10px] font-black text-primary uppercase tracking-widest hover:no-underline group-hover:translate-x-1 transition-transform">
                                    <Link href={step.href}>
                                        {step.cta} →
                                    </Link>
                                </Button>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
