"use client";

import Link from "next/link";
import { memo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageBreadcrumb = { label: string; href?: string };

export type PageHeaderProps = {
    title: string;
    description?: string;
    breadcrumbs?: PageBreadcrumb[];
    actions?: ReactNode;
    className?: string;
};

export const PageHeader = memo(function PageHeader({
    title,
    description,
    breadcrumbs,
    actions,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
            <div className="min-w-0 flex-1">
                {breadcrumbs && breadcrumbs.length > 0 ? (
                    <nav
                        aria-label="Fil d'Ariane"
                        className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[11px]"
                        style={{ color: "var(--eduflow-text-tertiary)" }}
                    >
                        {breadcrumbs.map((crumb, index) => {
                            const isLast = index === breadcrumbs.length - 1;
                            return (
                                <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1.5">
                                    {index > 0 ? <span aria-hidden>›</span> : null}
                                    {crumb.href && !isLast ? (
                                        <Link
                                            href={crumb.href}
                                            className="transition-colors hover:text-[var(--eduflow-text-secondary)]"
                                            style={{ color: "inherit", textDecoration: "none" }}
                                        >
                                            {crumb.label}
                                        </Link>
                                    ) : (
                                        <span
                                            aria-current={isLast ? "page" : undefined}
                                            style={{
                                                fontWeight: isLast ? 600 : 400,
                                                color: isLast
                                                    ? "var(--eduflow-text-secondary)"
                                                    : "inherit",
                                            }}
                                        >
                                            {crumb.label}
                                        </span>
                                    )}
                                </span>
                            );
                        })}
                    </nav>
                ) : null}
                <h1
                    className="eduflow-display m-0 text-[clamp(24px,3.6vw,32px)] tracking-[-0.025em]"
                    style={{ color: "var(--eduflow-text-primary)" }}
                >
                    {title}
                </h1>
                {description ? (
                    <p
                        className="mt-1.5 text-sm leading-relaxed"
                        style={{ color: "var(--eduflow-text-secondary)" }}
                    >
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
});

export type PageShellProps = {
    children: ReactNode;
    className?: string;
};

export function PageShell({ children, className }: PageShellProps) {
    return (
        <div
            className={cn(
                "mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6",
                className
            )}
        >
            {children}
        </div>
    );
}
