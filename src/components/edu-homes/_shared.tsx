"use client";

import * as React from "react";
import { Button } from "@/components/edu";

export function PageHeader({
    greeting,
    sub,
    actions,
    breadcrumb,
}: {
    greeting: React.ReactNode;
    sub?: React.ReactNode;
    actions?: React.ReactNode;
    /** Optional breadcrumb segments. Last segment is rendered as the current location. */
    breadcrumb?: React.ReactNode[];
}) {
    return (
        <div
            className="mb-6 flex flex-wrap items-end justify-between gap-3"
            style={{ color: "var(--eduflow-text-primary)" }}
        >
            <div>
                {breadcrumb && breadcrumb.length > 0 ? (
                    <nav
                        aria-label="Fil d'Ariane"
                        style={{
                            display: "flex",
                            gap: 8,
                            fontSize: 11,
                            color: "var(--eduflow-text-tertiary)",
                            marginBottom: 6,
                            flexWrap: "wrap",
                        }}
                    >
                        {breadcrumb.map((segment, i) => {
                            const isLast = i === breadcrumb.length - 1;
                            return (
                                <React.Fragment key={i}>
                                    <span
                                        style={{
                                            fontWeight: isLast ? 600 : 400,
                                            color: isLast
                                                ? "var(--eduflow-text-secondary)"
                                                : "inherit",
                                        }}
                                    >
                                        {segment}
                                    </span>
                                    {!isLast ? <span aria-hidden>›</span> : null}
                                </React.Fragment>
                            );
                        })}
                    </nav>
                ) : null}
                <h1
                    className="eduflow-display"
                    style={{
                        fontSize: "clamp(24px, 3.6vw, 32px)",
                        margin: 0,
                        letterSpacing: "-0.025em",
                        color: "var(--eduflow-text-primary)",
                    }}
                >
                    {greeting}
                </h1>
                {sub ? (
                    <p
                        style={{
                            margin: "6px 0 0",
                            color: "var(--eduflow-text-secondary)",
                            fontSize: 14,
                        }}
                    >
                        {sub}
                    </p>
                ) : null}
            </div>
            {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
    );
}

export function SubLabel({ children }: { children: React.ReactNode }) {
    return (
        <div
            style={{
                fontSize: 11,
                fontWeight: 600,
                color: "var(--eduflow-text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 10,
            }}
        >
            {children}
        </div>
    );
}

export function PrimaryCta({
    label,
    icon,
    iconRight,
    onClick,
}: {
    label: string;
    icon?: React.ComponentProps<typeof Button>["icon"];
    iconRight?: React.ComponentProps<typeof Button>["iconRight"];
    onClick?: () => void;
}) {
    return (
        <Button icon={icon} iconRight={iconRight} onClick={onClick}>
            {label}
        </Button>
    );
}

export function SecondaryCta({
    label,
    icon,
    onClick,
}: {
    label: string;
    icon?: React.ComponentProps<typeof Button>["icon"];
    onClick?: () => void;
}) {
    return (
        <Button variant="secondary" icon={icon} onClick={onClick}>
            {label}
        </Button>
    );
}

export function formatFcfa(value: number): string {
    if (!value) return "0";
    if (value >= 1_000_000_000)
        return `${(value / 1_000_000_000).toLocaleString("fr-FR", {
            maximumFractionDigits: 2,
        })} Mrd`;
    if (value >= 1_000_000)
        return `${(value / 1_000_000).toLocaleString("fr-FR", {
            maximumFractionDigits: 1,
        })} M`;
    return value.toLocaleString("fr-FR");
}

export function formatNumber(value: number): string {
    return value.toLocaleString("fr-FR");
}

export function frenchToday(): string {
    const formatter = new Intl.DateTimeFormat("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
    });
    return formatter.format(new Date());
}
