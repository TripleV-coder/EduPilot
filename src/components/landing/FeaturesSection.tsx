"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { Button, Icon, type IconName } from "@/components/edu";

interface Feature {
    key: string;
    icon: IconName;
}

const features: Feature[] = [
    { key: "students", icon: "users" },
    { key: "grades", icon: "book" },
    { key: "schedule", icon: "clock" },
    { key: "finance", icon: "money" },
    { key: "communication", icon: "sms" },
    { key: "analytics", icon: "chart" },
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
        <section
            id="features"
            className="relative overflow-hidden py-24 md:py-32"
            style={{
                background: "var(--eduflow-surface-card)",
                borderBottom: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            <div className="container mx-auto px-4">
                <div className="mb-20">
                    <p
                        className="mb-4 text-[10px] font-black uppercase tracking-[0.3em]"
                        style={{ color: "var(--brand-600)" }}
                    >
                        Fonctionnalités
                    </p>
                    <h2
                        className="eduflow-display text-4xl font-black uppercase leading-[0.9] tracking-tighter md:text-5xl"
                        style={{ color: "var(--eduflow-text-primary)" }}
                    >
                        Une architecture logicielle <br />
                        <span style={{ color: "var(--eduflow-text-tertiary)" }}>sans compromis</span>
                    </h2>
                </div>

                <motion.div
                    className="mx-auto grid max-w-7xl grid-cols-1 gap-px border md:grid-cols-2 lg:grid-cols-3"
                    style={{
                        background: "var(--eduflow-border-subtle)",
                        borderColor: "var(--eduflow-border-subtle)",
                    }}
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-80px" }}
                >
                    {features.map((feature) => (
                        <motion.div
                            key={feature.key}
                            variants={itemVariants}
                            className="group cursor-crosshair p-10 transition-colors hover:bg-[var(--eduflow-surface-sunken)]"
                            style={{ background: "var(--eduflow-surface-card)" }}
                        >
                            <div
                                className="mb-8 inline-flex h-10 w-10 items-center justify-center border"
                                style={{ borderColor: "var(--eduflow-border-default)" }}
                            >
                                <Icon name={feature.icon} size={20} color="var(--brand-600)" />
                            </div>
                            <h3
                                className="mb-4 text-xs font-black uppercase tracking-widest"
                                style={{ color: "var(--eduflow-text-primary)" }}
                            >
                                {t(`landing.features.${feature.key}.title`)}
                            </h3>
                            <p
                                className="text-sm font-medium leading-relaxed"
                                style={{ color: "var(--eduflow-text-secondary)" }}
                            >
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
                    className="mx-auto mt-24 max-w-7xl border p-8 md:p-12"
                    style={{ borderColor: "var(--eduflow-border-subtle)" }}
                >
                    <div className="grid grid-cols-1 gap-12 md:grid-cols-3">
                        {onboardingSteps.map((step) => (
                            <div key={step.id} className="group">
                                <div
                                    className="mb-6 text-[10px] font-black uppercase tracking-widest"
                                    style={{ color: "var(--eduflow-text-tertiary)" }}
                                >
                                    Phase {step.id}
                                </div>
                                <h4
                                    className="mb-4 text-sm font-black uppercase tracking-tight"
                                    style={{ color: "var(--eduflow-text-primary)" }}
                                >
                                    {step.title}
                                </h4>
                                <p
                                    className="mb-6 text-xs font-medium leading-relaxed"
                                    style={{ color: "var(--eduflow-text-secondary)" }}
                                >
                                    {step.description}
                                </p>
                                <Link href={step.href}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 text-[10px] font-black uppercase tracking-widest group-hover:translate-x-1"
                                    >
                                        {step.cta} →
                                    </Button>
                                </Link>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
