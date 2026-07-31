"use client";

import * as React from "react";
import {
    PageHeader as UnifiedPageHeader,
    type PageBreadcrumb,
} from "@/components/layout/page-shell";
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
    breadcrumb?: React.ReactNode[];
}) {
    const breadcrumbs: PageBreadcrumb[] | undefined = breadcrumb?.map((segment, index) => ({
        label: String(segment),
        href: index < breadcrumb.length - 1 ? undefined : undefined,
    }));

    return (
        <UnifiedPageHeader
            className="mb-6"
            title={typeof greeting === "string" ? greeting : String(greeting)}
            description={typeof sub === "string" ? sub : sub ? String(sub) : undefined}
            breadcrumbs={breadcrumbs}
            actions={actions}
        />
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
