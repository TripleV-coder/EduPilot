"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button, Icon, Spinner, type IconName } from "@/components/edu";
import { cn } from "@/lib/utils";

export function PageLoading({ label = "Chargement en cours…" }: { label?: string }) {
    return (
        <div
            className="flex min-h-[240px] flex-col items-center justify-center gap-3"
            role="status"
            aria-live="polite"
        >
            <Spinner size={28} />
            <p className="text-sm" style={{ color: "var(--eduflow-text-secondary)" }}>
                {label}
            </p>
        </div>
    );
}

export function PageError({
    message,
    onRetry,
}: {
    message: string;
    onRetry?: () => void;
}) {
    return (
        <div
            role="alert"
            className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-card border px-6 py-10 text-center"
            style={{
                background: "var(--eduflow-danger-50)",
                borderColor: "var(--eduflow-danger-200)",
                color: "var(--eduflow-danger-800)",
            }}
        >
            <Icon name="warning" size={28} color="var(--eduflow-danger-600)" />
            <div>
                <p className="text-sm font-semibold">Une erreur est survenue</p>
                <p className="mt-1 text-sm opacity-90">{message}</p>
            </div>
            {onRetry ? (
                <Button variant="secondary" size="sm" onClick={onRetry}>
                    Réessayer
                </Button>
            ) : null}
        </div>
    );
}

type PageEmptyAction = {
    label: string;
    href?: string;
    onClick?: () => void;
};

export function PageEmpty({
    icon = "cards",
    title,
    description,
    actions,
    className,
}: {
    icon?: IconName;
    title: string;
    description?: string;
    actions?: PageEmptyAction[];
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex min-h-[240px] flex-col items-center justify-center gap-4 rounded-card border border-dashed px-6 py-12 text-center",
                className
            )}
            style={{
                borderColor: "var(--eduflow-border-default)",
                background: "var(--eduflow-surface-sunken)",
            }}
        >
            <div
                className="grid h-14 w-14 place-items-center rounded-soft"
                style={{ background: "var(--eduflow-surface-card)" }}
            >
                <Icon name={icon} size={24} color="var(--eduflow-text-tertiary)" />
            </div>
            <div>
                <h3
                    className="text-base font-semibold"
                    style={{ color: "var(--eduflow-text-primary)" }}
                >
                    {title}
                </h3>
                {description ? (
                    <p
                        className="mx-auto mt-1 max-w-md text-sm leading-relaxed"
                        style={{ color: "var(--eduflow-text-secondary)" }}
                    >
                        {description}
                    </p>
                ) : null}
            </div>
            {actions && actions.length > 0 ? (
                <div className="flex flex-wrap items-center justify-center gap-2">
                    {actions.map((action) =>
                        action.href ? (
                            <Link key={action.label} href={action.href}>
                                <Button variant="primary" size="sm">
                                    {action.label}
                                </Button>
                            </Link>
                        ) : (
                            <Button
                                key={action.label}
                                variant="secondary"
                                size="sm"
                                onClick={action.onClick}
                            >
                                {action.label}
                            </Button>
                        )
                    )}
                </div>
            ) : null}
        </div>
    );
}

export function PageStateBoundary({
    loading,
    error,
    empty,
    isEmpty,
    onRetry,
    children,
}: {
    loading?: boolean;
    error?: string | null;
    empty?: ReactNode;
    isEmpty?: boolean;
    onRetry?: () => void;
    children: ReactNode;
}) {
    if (loading) return <PageLoading />;
    if (error) return <PageError message={error} onRetry={onRetry} />;
    if (isEmpty && empty) return <>{empty}</>;
    return <>{children}</>;
}
