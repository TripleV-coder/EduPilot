"use client";

import { motion } from "framer-motion";
import { Building2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { Icon, Spinner } from "@/components/edu";
import { SectionHeader } from "./SectionHeader";

type ExplorerSchool = {
    id: string;
    name: string;
    city?: string | null;
    studentsCount: number;
    teachersCount: number;
    classesCount: number;
};

const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.2,
        },
    },
};

const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1] as const,
        },
    },
};

export function TestimonialsSection() {
    const [schools, setSchools] = useState<ExplorerSchool[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/explorer/schools", { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json().catch(() => null);
                if (cancelled) return;
                setSchools(Array.isArray(data?.schools) ? data.schools : []);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const featuredSchools = useMemo(() => schools.slice(0, 3), [schools]);

    return (
        <section
            className="relative overflow-hidden py-24 md:py-40"
            style={{ background: "var(--eduflow-surface-sunken)" }}
        >
            <div className="container relative z-10 mx-auto px-6">
                <SectionHeader
                    badgeIcon={Building2}
                    badgeText={t("landing.testimonials.badge")}
                    title={t("landing.testimonials.title")}
                    subtitle={t("landing.testimonials.subtitle")}
                />

                <motion.div
                    className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-100px" }}
                >
                    {loading ? (
                        <motion.div
                            variants={itemVariants}
                            className="col-span-full flex items-center justify-center rounded-[2.5rem] border p-20 backdrop-blur-xl"
                            style={{
                                borderColor: "var(--eduflow-border-subtle)",
                                background: "var(--eduflow-surface-card)",
                            }}
                        >
                            <Spinner size={32} />
                        </motion.div>
                    ) : featuredSchools.length === 0 ? (
                        <motion.div
                            variants={itemVariants}
                            className="col-span-full rounded-[2.5rem] border p-20 text-center backdrop-blur-xl"
                            style={{
                                borderColor: "var(--eduflow-border-subtle)",
                                background: "var(--eduflow-surface-card)",
                            }}
                        >
                            <div
                                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
                                style={{ background: "var(--eduflow-surface-sunken)" }}
                            >
                                <Icon name="school" size={32} color="var(--eduflow-text-tertiary)" />
                            </div>
                            <p
                                className="text-lg font-bold"
                                style={{ color: "var(--eduflow-text-primary)" }}
                            >
                                Aucun établissement actif
                            </p>
                            <p
                                className="mt-2 text-sm"
                                style={{ color: "var(--eduflow-text-secondary)" }}
                            >
                                Les indicateurs apparaissent dès qu'un établissement est configuré.
                            </p>
                        </motion.div>
                    ) : (
                        featuredSchools.map((school) => (
                            <motion.div key={school.id} variants={itemVariants} className="group">
                                <div
                                    className="relative h-full cursor-pointer overflow-hidden rounded-[2rem] border p-8 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl"
                                    style={{
                                        borderColor: "var(--eduflow-border-subtle)",
                                        background: "var(--eduflow-surface-card)",
                                        boxShadow: "var(--eduflow-shadow-sm)",
                                    }}
                                >
                                    <div className="flex h-full flex-col">
                                        <div className="mb-8 flex items-start justify-between gap-4">
                                            <h3
                                                className="text-xl font-black leading-tight transition-colors group-hover:text-[var(--brand-600)]"
                                                style={{ color: "var(--eduflow-text-primary)" }}
                                            >
                                                {school.name}
                                            </h3>
                                            <div
                                                className="shrink-0 rounded-lg px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
                                                style={{
                                                    background: "var(--brand-50)",
                                                    color: "var(--brand-700)",
                                                }}
                                            >
                                                {school.city || "Bénin"}
                                            </div>
                                        </div>

                                        <div className="mt-auto grid grid-cols-3 gap-4">
                                            <div className="flex flex-col">
                                                <span
                                                    className="mb-1 text-[10px] font-black uppercase tracking-widest"
                                                    style={{ color: "var(--eduflow-text-tertiary)" }}
                                                >
                                                    Élèves
                                                </span>
                                                <span
                                                    className="text-lg font-bold"
                                                    style={{ color: "var(--eduflow-text-primary)" }}
                                                >
                                                    {school.studentsCount.toLocaleString("fr-FR")}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span
                                                    className="mb-1 text-[10px] font-black uppercase tracking-widest"
                                                    style={{ color: "var(--eduflow-text-tertiary)" }}
                                                >
                                                    Profs
                                                </span>
                                                <span
                                                    className="text-lg font-bold"
                                                    style={{ color: "var(--eduflow-text-primary)" }}
                                                >
                                                    {school.teachersCount.toLocaleString("fr-FR")}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span
                                                    className="mb-1 text-[10px] font-black uppercase tracking-widest"
                                                    style={{ color: "var(--eduflow-text-tertiary)" }}
                                                >
                                                    Classes
                                                </span>
                                                <span
                                                    className="text-lg font-bold"
                                                    style={{ color: "var(--eduflow-text-primary)" }}
                                                >
                                                    {school.classesCount.toLocaleString("fr-FR")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        className="absolute right-0 top-0 h-24 w-24 -translate-y-1/2 translate-x-1/2 rounded-full blur-3xl transition-colors group-hover:opacity-80"
                                        style={{ background: "var(--brand-100)" }}
                                    />
                                </div>
                            </motion.div>
                        ))
                    )}
                </motion.div>
            </div>
        </section>
    );
}
