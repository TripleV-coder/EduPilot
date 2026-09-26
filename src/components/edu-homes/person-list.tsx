"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon } from "@/components/edu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RoleActionGuard } from "@/components/guard/role-action-guard";
import { CARD_COLORS, initials } from "./home-kit";
import styles from "./home.module.css";

/* Liste « Personnes » façon Google Classroom, dans le langage des listes de
   l'accueil validé (docs/design/directions/live) : avatar coloré, nom, une
   ligne de détail, actions secondaires dans le menu « ⋮ ». Partagée par les
   pages Élèves, Parents, Enseignants et Utilisateurs. */

export type PersonAction = {
    label: string;
    href?: string;
    onSelect?: () => void;
    danger?: boolean;
    /** Action visible seulement pour ces rôles. */
    allowedRoles?: ComponentProps<typeof RoleActionGuard>["allowedRoles"];
};

export function PersonList({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section className={styles.block} aria-label={label}>
            <ul className={styles.watch}>{children}</ul>
        </section>
    );
}

export function PersonRow({
    index,
    name,
    detail,
    href,
    onNavigate,
    actions = [],
}: {
    index: number;
    name: string;
    detail?: string;
    href?: string;
    onNavigate?: () => void;
    actions?: PersonAction[];
}) {
    const itemClass = "block w-full rounded-md px-3 py-2 text-left text-sm no-underline";
    return (
        <li className={styles.watchItem}>
            <span className={styles.avatar} style={{ background: CARD_COLORS[index % CARD_COLORS.length] }} aria-hidden="true">
                {initials(name)}
            </span>
            <div className="min-w-0">
                {href ? (
                    <Link href={href} onClick={onNavigate} className={`${styles.name} block truncate no-underline hover:underline`}>
                        {name}
                    </Link>
                ) : (
                    <span className={`${styles.name} block truncate`}>{name}</span>
                )}
                {detail ? <div className={`${styles.detail} truncate`}>{detail}</div> : null}
            </div>
            {actions.length > 0 ? (
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            aria-label={`Actions pour ${name}`}
                            className="grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[var(--eduflow-surface-sunken)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/50"
                        >
                            <Icon name="more" size={18} color="var(--eduflow-text-secondary)" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-52 p-1">
                        {actions.map((action) => {
                            const style = { color: action.danger ? "var(--eduflow-danger-700)" : "var(--eduflow-text-primary)" };
                            const hover = action.danger ? "hover:bg-[var(--eduflow-danger-50)]" : "hover:bg-[var(--eduflow-surface-sunken)]";
                            const item = action.href ? (
                                <Link key={action.label} href={action.href} onClick={onNavigate} className={`${itemClass} ${hover}`} style={style}>
                                    {action.label}
                                </Link>
                            ) : (
                                <button key={action.label} type="button" onClick={action.onSelect} className={`${itemClass} ${hover}`} style={style}>
                                    {action.label}
                                </button>
                            );
                            return action.allowedRoles ? (
                                <RoleActionGuard key={action.label} allowedRoles={action.allowedRoles}>
                                    {item}
                                </RoleActionGuard>
                            ) : (
                                item
                            );
                        })}
                    </PopoverContent>
                </Popover>
            ) : null}
        </li>
    );
}
