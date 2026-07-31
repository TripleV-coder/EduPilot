"use client";

import { motion } from "framer-motion";
import { type ElementType } from "react";

interface SectionHeaderProps {
    badgeIcon?: ElementType;
    badgeText: string;
    title: string;
    subtitle: string;
    className?: string;
}

export function SectionHeader({ badgeIcon: BadgeIcon, badgeText, title, subtitle, className = "" }: SectionHeaderProps) {
    return (
        <motion.div
            className={`mx-auto mb-16 max-w-2xl text-center ${className}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
        >
            <span
                className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
                style={{
                    background: "var(--brand-50)",
                    color: "var(--brand-700)",
                }}
            >
                {BadgeIcon ? <BadgeIcon className="h-4 w-4" /> : null}
                {badgeText}
            </span>
            <h2
                className="eduflow-display mb-4 text-3xl font-bold tracking-tight md:text-4xl"
                style={{ color: "var(--eduflow-text-primary)" }}
            >
                {title}
            </h2>
            <p className="text-lg" style={{ color: "var(--eduflow-text-secondary)" }}>
                {subtitle}
            </p>
        </motion.div>
    );
}
