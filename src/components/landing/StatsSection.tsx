"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { t } from "@/lib/i18n";
import { Spinner } from "@/components/edu";

function AnimatedCounter({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
    const ref = useRef<HTMLSpanElement>(null);
    const isInView = useInView(ref, { once: true, margin: "-80px" });
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

type ExplorerOverview = {
    schools: number;
    students: number;
    classes: number;
    teachers: number;
};

export function StatsSection() {
    const [stats, setStats] = useState<ExplorerOverview>({
        schools: 0,
        students: 0,
        classes: 0,
        teachers: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/explorer/overview", { cache: "no-store" });
                if (!res.ok) return;
                const data = (await res.json().catch(() => null)) as ExplorerOverview | null;
                if (cancelled || !data) return;
                setStats({
                    schools: Number(data.schools || 0),
                    students: Number(data.students || 0),
                    classes: Number(data.classes || 0),
                    teachers: Number(data.teachers || 0),
                });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, []);

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
                        <motion.div
                            key={stat.key}
                            className="flex flex-col items-start p-6"
                            style={{ borderLeft: "1px solid var(--eduflow-border-default)" }}
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                        >
                            <div className="mb-4">
                                {loading ? (
                                    <span className="inline-flex items-center gap-2">
                                        <Spinner size={24} />
                                    </span>
                                ) : (
                                    <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                                )}
                            </div>
                            <p
                                className="text-[10px] font-black uppercase tracking-[0.2em]"
                                style={{ color: "var(--eduflow-text-tertiary)" }}
                            >
                                {t(`landing.stats.${stat.key}`)}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
