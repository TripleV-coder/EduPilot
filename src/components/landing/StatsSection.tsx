"use client";

import { useState, useEffect } from "react";
import { t } from "@/lib/i18n";
import { Spinner } from "@/components/edu";
import { Reveal, useInViewOnce } from "./Reveal";
import { useExplorerOverview } from "./use-explorer-overview";

function AnimatedCounter({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
    const { ref, inView: isInView } = useInViewOnce<HTMLSpanElement>("-80px");
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!isInView) return;
        let start = 0;
        const increment = target / (duration / 16);
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                setCount(target);
                clearInterval(timer);
            } else {
                setCount(Math.floor(start));
            }
        }, 16);
        return () => clearInterval(timer);
    }, [isInView, target, duration]);

    return (
        <span
            ref={ref}
            className="eduflow-display text-[clamp(2.5rem,6vw,4.5rem)] font-black tabular-nums tracking-tighter"
            style={{ color: "var(--eduflow-text-primary)" }}
        >
            {count.toLocaleString("fr-FR")}
            {suffix}
        </span>
    );
}

export function StatsSection() {
    // Même requête que le bandeau du haut de page : SWR n'en envoie qu'une
    const { data, error, isLoading: loading } = useExplorerOverview();
    const stats = {
        schools: Number(data?.schools ?? 0),
        students: Number(data?.students ?? 0),
        classes: Number(data?.classes ?? 0),
        teachers: Number(data?.teachers ?? 0),
    };

    const statItems = [
        { key: "students", target: stats.students, suffix: "" },
        { key: "schools", target: stats.schools, suffix: "" },
        { key: "classes", target: stats.classes, suffix: "" },
        { key: "teachers", target: stats.teachers, suffix: "" },
    ];

    return (
        <section
            className="py-24"
            style={{
                background: "var(--eduflow-surface-sunken)",
                borderBottom: "1px solid var(--eduflow-border-subtle)",
            }}
        >
            <div className="container mx-auto px-4">
                <div className="mx-auto grid max-w-7xl grid-cols-2 gap-8 md:grid-cols-4 md:gap-4">
                    {statItems.map((stat, idx) => (
                        <Reveal
                            key={stat.key}
                            className="flex flex-col items-start p-6"
                            style={{ borderLeft: "1px solid var(--eduflow-border-default)" }}
                            dy={0}
                            delay={idx * 100}
                        >
                            <div className="mb-4">
                                {loading ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Spinner size={24} />
                                    </span>
                                ) : error ? (
                                    // Chiffres indisponibles : aucun faux « 0 »
                                    <span
                                        className="eduflow-display text-[clamp(2.5rem,6vw,4.5rem)] font-black"
                                        style={{ color: "var(--eduflow-text-tertiary)" }}
                                        aria-label="Chiffre indisponible"
                                    >
                                        —
                                    </span>
                                ) : (
                                    <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                                )}
                            </div>
                            <p
                                className="text-xs font-black uppercase tracking-[0.2em]"
                                style={{ color: "var(--eduflow-text-tertiary)" }}
                            >
                                {t(`landing.stats.${stat.key}`)}
                            </p>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}
