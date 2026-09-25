"use client";

import Link from "next/link";
import { memo, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PageBreadcrumb = { label: string; href?: string };

export type PageHeaderProps = {
    title: string;
    description?: string;
    breadcrumbs?: PageBreadcrumb[];
    actions?: ReactNode;
    className?: string;
    /** Titre de l'onglet s'il doit différer du titre affiché (ex. salutation). */
    documentTitle?: string;
};

export const PageHeader = memo(function PageHeader({
    title,
    description,
    breadcrumbs,
    actions,
    className,
    documentTitle,
}: PageHeaderProps) {
    // WCAG 2.4.2 : chaque page a son propre titre d'onglet (les pages client ne
    // peuvent pas exporter de metadata ; toutes affichaient « EduPilot »).
    const tabTitle = documentTitle ?? title;
    useEffect(() => {
        if (tabTitle) document.title = `${tabTitle} — EduPilot`;
    }, [tabTitle]);

    return (
        <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
            <div className="min-w-0 flex-1">
                {breadcrumbs && breadcrumbs.length > 0 ? (
                    <nav
                        aria-label="Fil d'Ariane"
                        className="mb-1 flex flex-wrap items-center gap-1.5 text-xs"
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
                    className="m-0 text-[22px] font-bold leading-tight tracking-[-0.02em] md:text-2xl"
                    style={{ color: "var(--eduflow-text-primary)" }}
                >
                    {title}
                </h1>
                {description ? (
                    <p
                        className="mt-0.5 text-sm leading-relaxed"
                        style={{ color: "var(--eduflow-text-secondary)" }}
                    >
                        {description}
                    </p>
                ) : null}
            </div>
            {/* Sur mobile, les actions passent sous le titre et vont à la ligne (plus de débordement). */}
            {actions ? <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div> : null}
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
                // La zone de contenu (<main>) porte déjà la marge : pas de seconde marge ici.
                "mx-auto flex w-full flex-col gap-4",
                className
            )}
        >
            {children}
        </div>
    );
}
