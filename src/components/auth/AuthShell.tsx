"use client";

import * as React from "react";
import { Avatar, Logo } from "@/components/edu";
import { cn } from "@/lib/utils";

export interface AuthShellProps {
    title: React.ReactNode;
    /** Optional subtitle line under the headline. */
    subtitle?: React.ReactNode;
    /** Form content. */
    children: React.ReactNode;
    /** Override the right-panel testimonial. */
    testimonial?: AuthTestimonial;
    /** Hide the right brand panel (single-column auth screens). */
    soloColumn?: boolean;
}

export interface AuthTestimonial {
    quote: string;
    author: string;
    role: string;
    eyebrow?: string;
}

// Promesse produit, pas un témoignage : l'ancien « +38 % de recouvrement »
// attribué à « Mme Akpovi » n'avait aucune source.
const DEFAULT_TESTIMONIAL: AuthTestimonial = {
    quote: "Notes, présences, paiements et bulletins de votre établissement, au même endroit.",
    author: "EduPilot",
    role: "Gestion scolaire · Bénin",
};

/**
 * Split-screen authentication shell matching the EduPilot v3 design.
 *
 * Layout: 1fr (form) / 1.1fr (brand testimonial gradient).
 * Collapses to single column under 880px (md breakpoint).
 */
export function AuthShell({
    title,
    subtitle,
    children,
    testimonial = DEFAULT_TESTIMONIAL,
    soloColumn,
}: AuthShellProps) {
    return (
        <div
            className={cn(
                "eduflow-scope auth-shell grid min-h-dvh w-full",
                soloColumn
                    ? "grid-cols-1"
                    : "grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
            )}
            style={{
                background: "var(--eduflow-surface-page)",
                color: "var(--eduflow-text-primary)",
                fontFamily: "var(--eduflow-font-body)",
            }}
        >
            <div
                className="flex min-h-dvh flex-col justify-between gap-4"
                style={{
                    padding: "clamp(24px, 5vw, 48px) clamp(24px, 6vw, 64px)",
                    background: "var(--eduflow-surface-card)",
                }}
            >
                <div className="flex items-center gap-2.5">
                    <Logo size={32} />
                    <span
                        className="eduflow-display text-lg font-bold tracking-tight"
                    >
                        EduPilot
                    </span>
                </div>
                <div className="w-full max-w-[420px]">
                    <h1
                        className="eduflow-display m-0 mb-2 text-[clamp(28px,4vw,36px)] font-bold leading-tight tracking-tight"
                    >
                        {title}
                    </h1>
                    {subtitle ? (
                        <p
                            className="mb-8 text-sm leading-relaxed"
                            style={{ color: "var(--eduflow-text-secondary)" }}
                        >
                            {subtitle}
                        </p>
                    ) : (
                        <div className="h-6" />
                    )}
                    {children}
                </div>
                <div
                    className="flex flex-wrap items-center justify-between gap-2 text-[11px] max-md:justify-center max-md:text-center"
                    style={{ color: "var(--eduflow-text-tertiary)" }}
                >
                    <span>© {new Date().getFullYear()} EduPilot</span>
                    <span>Aide · Confidentialité · CGV</span>
                </div>
            </div>

            {!soloColumn ? (
                <aside
                    aria-hidden
                    className="relative hidden min-h-dvh flex-col justify-end overflow-hidden p-[clamp(32px,5vw,56px)] text-white md:flex"
                    style={{
                        background:
                            "linear-gradient(135deg, var(--brand-700), var(--brand-accent-600, #4F46E5))",
                    }}
                >
                    <div
                        className="pointer-events-none absolute inset-0"
                        style={{
                            background:
                                "radial-gradient(60% 50% at 80% 20%, rgba(255,255,255,0.18), transparent 60%)",
                        }}
                    />
                    <div className="relative">
                        {testimonial.eyebrow ? (
                            <div className="mb-[18px] text-[11px] font-bold opacity-70">
                                {testimonial.eyebrow}
                            </div>
                        ) : null}
                        <p
                            className="eduflow-display m-0 mb-7 text-[clamp(24px,3.6vw,36px)] font-semibold leading-tight tracking-tight text-white"
                        >
                            {testimonial.quote}
                        </p>
                        <div className="flex items-center gap-3">
                            <Avatar name={testimonial.author} size="md" />
                            <div>
                                <div className="text-sm font-bold">{testimonial.author}</div>
                                <div className="text-xs opacity-80">{testimonial.role}</div>
                            </div>
                        </div>
                    </div>
                </aside>
            ) : null}
        </div>
    );
}
