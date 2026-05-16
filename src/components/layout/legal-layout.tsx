import Link from "next/link";
import React from "react";

interface LegalLayoutProps {
    title: string;
    lastUpdated: string;
    children: React.ReactNode;
    otherLink: {
        href: string;
        label: string;
    };
}

export function LegalLayout({ title, lastUpdated, children, otherLink }: LegalLayoutProps) {
    return (
        <main
            className="eduflow-scope"
            style={{
                minHeight: "100vh",
                background: "var(--eduflow-surface-page)",
                padding: "48px 16px",
            }}
        >
            <div
                style={{
                    maxWidth: "768px",
                    margin: "0 auto",
                    background: "var(--eduflow-surface-card)",
                    borderRadius: "var(--eduflow-radius-card)",
                    boxShadow: "var(--eduflow-shadow-card)",
                    border: "1px solid var(--eduflow-border-subtle)",
                    padding: "40px",
                }}
            >
                <div style={{ marginBottom: "32px" }}>
                    <Link
                        href="/login"
                        style={{
                            color: "var(--brand-700)",
                            fontSize: 13,
                            fontWeight: 500,
                            textDecoration: "none",
                        }}
                    >
                        ← Retour à la connexion
                    </Link>
                </div>

                <h1
                    className="eduflow-display"
                    style={{
                        fontSize: 32,
                        fontWeight: 700,
                        color: "var(--eduflow-text-primary)",
                        margin: 0,
                        letterSpacing: "-0.025em",
                    }}
                >
                    {title}
                </h1>
                <p
                    style={{
                        color: "var(--eduflow-text-tertiary)",
                        fontSize: 13,
                        marginTop: 8,
                        marginBottom: 32,
                    }}
                >
                    Dernière mise à jour : {lastUpdated}
                </p>

                <div
                    style={{
                        color: "var(--eduflow-text-secondary)",
                        fontSize: 14,
                        lineHeight: "var(--eduflow-leading-loose)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 24,
                    }}
                >
                    {children}
                </div>

                <div
                    style={{
                        marginTop: 40,
                        paddingTop: 24,
                        borderTop: "1px solid var(--eduflow-border-subtle)",
                        fontSize: 13,
                        color: "var(--eduflow-text-tertiary)",
                        display: "flex",
                        gap: 16,
                    }}
                >
                    <Link
                        href={otherLink.href}
                        style={{
                            color: "var(--eduflow-text-secondary)",
                            textDecoration: "none",
                        }}
                    >
                        {otherLink.label}
                    </Link>
                    <Link
                        href="/login"
                        style={{
                            color: "var(--eduflow-text-secondary)",
                            textDecoration: "none",
                        }}
                    >
                        Connexion
                    </Link>
                </div>
            </div>
        </main>
    );
}
