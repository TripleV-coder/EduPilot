"use client";

import { Reveal } from "./Reveal";
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

                <Reveal stagger className="mx-auto grid max-w-6xl grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
                    {loading ? (
                        <div
                            className="col-span-full flex items-center justify-center rounded-[2.5rem] border p-20 backdrop-blur-xl"
                            style={{
                                borderColor: "var(--eduflow-border-subtle)",
                                background: "var(--eduflow-surface-card)",
                            }}
                        >
                            <Spinner size={32} />
                        </div>
                    ) : featuredSchools.length === 0 ? (
                        <div
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
                        </div>
                    ) : (
                        featuredSchools.map((school) => (
                            <div key={school.id} className="group">
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
                                                className="shrink-0 rounded-lg px-3 py-1 text-xs font-bold uppercase tracking-widest"
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
                                                    className="mb-1 text-xs font-black uppercase tracking-widest"
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
                                                    className="mb-1 text-xs font-black uppercase tracking-widest"
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
                                                    className="mb-1 text-xs font-black uppercase tracking-widest"
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
                            </div>
                        ))
                    )}
                </Reveal>
            </div>
        </section>
    );
}
