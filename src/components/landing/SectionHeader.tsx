"use client";

import { motion } from "framer-motion";
import { type ElementType } from "react";

interface SectionHeaderProps {
    badgeIcon?: any;
    badgeText: string;
    title: string;
    subtitle: string;
    className?: string;
}

export function SectionHeader({ badgeIcon: Icon, badgeText, title, subtitle, className = "" }: SectionHeaderProps) {
    return (
        <motion.div
            className={`text-center max-w-2xl mx-auto mb-16 ${className}`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
        >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                {Icon && <Icon className="h-4 w-4" />}
                {badgeText}
            </span>
            <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight mb-4 text-slate-900 dark:text-white">
                {title}
            </h2>
            <p className="text-lg text-muted-foreground">
                {subtitle}
            </p>
        </motion.div>
    );
}
