"use client";

import * as React from "react";
import { Avatar, Logo } from "@/components/edu";

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

const DEFAULT_TESTIMONIAL: AuthTestimonial = {
    eyebrow: "L'École, simplifiée",
    quote:
        "« Le recouvrement a bondi de 38% en un trimestre. EduPilot fait le travail à notre place. »",
    author: "Mme Akpovi",
    role: "Directrice · Cours Bénin Excellence",
};

/**
 * Split-screen authentication shell matching the EduPilot v3 design.
 *
 * Layout: 1fr (form) / 1.1fr (brand testimonial gradient).
 * Collapses to single column under 880px.
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
            className="eduflow-scope auth-shell"
            style={{
                minHeight: "100vh",
                width: "100%",
                background: "var(--eduflow-surface-page)",
                color: "var(--eduflow-text-primary)",
                fontFamily: "var(--eduflow-font-body)",
                display: "grid",
                gridTemplateColumns: soloColumn ? "1fr" : "minmax(0, 1fr) minmax(0, 1.1fr)",
            }}
        >
            <div
                style={{
                    padding: "clamp(24px, 5vw, 48px) clamp(24px, 6vw, 64px)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    background: "var(--eduflow-surface-card)",
                    minHeight: "100vh",
                    gap: 32,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Logo size={32} />
                    <span
                        className="eduflow-display"
                        style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em" }}
                    >
                        EduPilot
                    </span>
                </div>
                <div style={{ maxWidth: 420, width: "100%" }}>
                    <h1
                        className="eduflow-display"
                        style={{
                            fontSize: "clamp(28px, 4vw, 36px)",
                            fontWeight: 700,
                            margin: "0 0 8px",
                            letterSpacing: "-0.025em",
                            lineHeight: 1.1,
                        }}
                    >
                        {title}
                    </h1>
                    {subtitle ? (
                        <p
                            style={{
                                fontSize: 14,
                                color: "var(--eduflow-text-secondary)",
                                margin: "0 0 32px",
                                lineHeight: 1.55,
                            }}
                        >
                            {subtitle}
                        </p>
                    ) : (
                        <div style={{ height: 24 }} />
                    )}
                    {children}
                </div>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: 11,
                        color: "var(--eduflow-text-tertiary)",
                    }}
                >
                    <span>© {new Date().getFullYear()} EduPilot</span>
                    <span>Aide · Confidentialité · CGV</span>
                </div>
            </div>

            {!soloColumn ? (
                <aside
                    aria-hidden
                    className="hidden md:flex"
                    style={{
                        background:
                            "linear-gradient(135deg, var(--brand-700), var(--brand-accent-600, #4F46E5))",
                        position: "relative",
                        overflow: "hidden",
                        padding: "clamp(32px, 5vw, 56px)",
                        color: "#fff",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                    }}
                >
                    <div
                        style={{
                            position: "absolute",
                            inset: 0,
                            background:
                                "radial-gradient(60% 50% at 80% 20%, rgba(255,255,255,0.18), transparent 60%)",
                            pointerEvents: "none",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            top: 40,
                            right: 40,
                            display: "flex",
                            gap: 6,
                            alignItems: "center",
                            fontSize: 11,
                            opacity: 0.85,
                        }}
                    >
                        <span
                            style={{
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                background: "#fff",
                                boxShadow: "0 0 8px rgba(255,255,255,0.6)",
                            }}
                        />
                        Tous les systèmes opérationnels
                    </div>
                    <div style={{ position: "relative" }}>
                        {testimonial.eyebrow ? (
                            <div
                                style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: "0.14em",
                                    textTransform: "uppercase",
                                    opacity: 0.7,
                                    marginBottom: 18,
                                }}
                            >
                                {testimonial.eyebrow}
                            </div>
                        ) : null}
                        <p
                            className="eduflow-display"
                            style={{
                                fontSize: "clamp(24px, 3.6vw, 36px)",
                                fontWeight: 600,
                                lineHeight: 1.15,
                                letterSpacing: "-0.025em",
                                margin: "0 0 28px",
                                color: "#fff",
                            }}
                        >
                            {testimonial.quote}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <Avatar name={testimonial.author} size="md" />
                            <div>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>
                                    {testimonial.author}
                                </div>
                                <div style={{ fontSize: 12, opacity: 0.78 }}>
                                    {testimonial.role}
                                </div>
                            </div>
                        </div>
                    </div>
                </aside>
            ) : null}
        </div>
    );
}
