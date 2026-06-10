"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { t } from "@/lib/i18n";
import { BarChart3, Loader2 } from "lucide-react";
import { SectionHeader } from "./SectionHeader";

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
        <span ref={ref} className="font-sans text-5xl md:text-7xl font-black tabular-nums text-zinc-900 dark:text-white tracking-tighter">
            {count.toLocaleString("fr-FR")}{suffix}
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
        <section className="py-24 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-900">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 max-w-7xl mx-auto">
                    {statItems.map((stat, idx) => (
                        <motion.div
                            key={stat.key}
                            className="flex flex-col items-start p-6 border-l border-zinc-200 dark:border-zinc-800"
                            initial={{ opacity: 0 }}
                            whileInView={{ opacity: 1 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: idx * 0.1 }}
                        >
                            <div className="mb-4">
                                {loading ? (
                                    <span className="inline-flex items-center justify-center text-3xl font-bold text-zinc-300 animate-pulse">
                                        ...
                                    </span>
                                ) : (
                                    <AnimatedCounter target={stat.target} suffix={stat.suffix} />
                                )}
                            </div>
                            <p className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.2em]">
                                {t(`landing.stats.${stat.key}`)}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
