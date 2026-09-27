"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/edu";
import styles from "./home.module.css";

/* Kit des accueils — mêmes blocs que l'accueil direction validé
   (docs/design/directions/live). Une couleur par module. */
export const MODULE = {
    blue: "var(--edu-module-blue)",
    green: "var(--edu-module-green)",
    orange: "var(--edu-module-orange)",
    purple: "var(--edu-module-purple)",
    pink: "var(--edu-module-pink)",
    teal: "var(--edu-module-teal)",
} as const;
export const CARD_COLORS = [MODULE.blue, MODULE.orange, MODULE.purple, MODULE.green, MODULE.teal, MODULE.pink];

export const decimal = (value: number, digits = 1) => value.toFixed(digits).replace(".", ",");

export function initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function HomePage({ children }: { children: ReactNode }) {
    return <div className={styles.page}>{children}</div>;
}

export function HomeHeader({ title, sub }: { title: string; sub: string }) {
    return (
        <header className={styles.head}>
            <div>
                <h1 className={styles.title}>{title}</h1>
                <p className={styles.sub}>{sub}</p>
            </div>
        </header>
    );
}

/** Rangée 2/3 + 1/3 (« wide ») ou deux moitiés (« split »). */
export function Row({ children, variant = "wide" }: { children: ReactNode; variant?: "wide" | "split" }) {
    return <div className={variant === "split" ? styles.split : styles.top}>{children}</div>;
}

export function Block({
    id,
    title,
    link,
    children,
}: {
    id: string;
    title: string;
    link?: { href: string; label: string };
    children: ReactNode;
}) {
    return (
        <section className={styles.block} aria-labelledby={id}>
            <div className={styles.blockHead}>
                <h2 id={id} className={styles.blockTitle}>
                    {title}
                </h2>
                {link ? (
                    <Link href={link.href} className={styles.link}>
                        {link.label}
                    </Link>
                ) : null}
            </div>
            {children}
        </section>
    );
}

export interface Figure {
    label: string;
    value: string;
    note: string;
    color: string;
    href?: string;
}

export function Figures({ items }: { items: Figure[] }) {
    return (
        <div className={styles.figs}>
            {items.map((f) => {
                const inner = (
                    <>
                        <span className={styles.figLabel}>
                            <span className={styles.dot} style={{ background: f.color }} aria-hidden="true" />
                            {f.label}
                        </span>
                        <span className={styles.figValue} style={{ display: "block" }}>
                            {f.value}
                        </span>
                        <span className={styles.figNote} style={{ display: "block" }}>
                            {f.note}
                        </span>
                    </>
                );
                return f.href ? (
                    <Link key={f.label} href={f.href} className={styles.fig}>
                        {inner}
                    </Link>
                ) : (
                    <div key={f.label} className={styles.fig}>
                        {inner}
                    </div>
                );
            })}
        </div>
    );
}

export interface WatchItem {
    key: string;
    avatar: ReactNode;
    color: string;
    name: string;
    detail: string;
    action?: { href: string; label: string };
}

export function WatchList({ items, calm }: { items: WatchItem[]; calm: string }) {
    if (items.length === 0) {
        return (
            <p className={styles.calm}>
                <Icon name="success" size={20} color={MODULE.green} />
                {calm}
            </p>
        );
    }
    return (
        <ul className={styles.watch}>
            {items.map((w) => (
                <li key={w.key} className={styles.watchItem}>
                    <span className={styles.avatar} style={{ background: w.color }} aria-hidden="true">
                        {w.avatar}
                    </span>
                    <div>
                        <div className={styles.name}>{w.name}</div>
                        <div className={styles.detail}>{w.detail}</div>
                    </div>
                    {w.action ? (
                        <Link href={w.action.href} className={styles.pill}>
                            {w.action.label}
                        </Link>
                    ) : (
                        <span />
                    )}
                </li>
            ))}
        </ul>
    );
}

export interface QuickAction {
    href: string;
    label: string;
    icon: IconName;
    color: string;
}

export function QuickActions({ actions }: { actions: QuickAction[] }) {
    return (
        <div className={styles.tiles}>
            {actions.map((a) => (
                <Link key={a.href + a.label} href={a.href} className={styles.tile}>
                    <span className={styles.tileIcon} style={{ background: a.color }} aria-hidden="true">
                        <Icon name={a.icon} size={18} color="#fff" />
                    </span>
                    {a.label}
                </Link>
            ))}
        </div>
    );
}

export interface ColorCard {
    key: string;
    title: string;
    meta: string;
    footLabel: string;
    footValue: string;
    href?: string;
}

/** Cartes à bandeau coloré façon Google Classroom (classes, enfants, matières). */
export function ColorCards({ items }: { items: ColorCard[] }) {
    return (
        <div className={styles.classes}>
            {items.map((c, i) => {
                const inner = (
                    <>
                        <div className={styles.banner} style={{ background: CARD_COLORS[i % CARD_COLORS.length] }}>
                            <span className={styles.className}>{c.title}</span>
                            <span className={styles.classMeta}>{c.meta}</span>
                        </div>
                        <div className={styles.classBody}>
                            <span>{c.footLabel}</span>
                            <span>{c.footValue}</span>
                        </div>
                    </>
                );
                return c.href ? (
                    <Link key={c.key} href={c.href} className={styles.classCard}>
                        {inner}
                    </Link>
                ) : (
                    <div key={c.key} className={styles.classCard}>
                        {inner}
                    </div>
                );
            })}
        </div>
    );
}

export interface DayItem {
    key: string;
    time: string;
    title: string;
    sub: string;
    state: "done" | "now" | "next";
    /** Raccourcis du créneau (ex. Appel, Notes), ouverts directement sur la classe. */
    actions?: { href: string; label: string }[];
}

/** Frise du jour, bornée à `limit` créneaux à partir du cours en cours ou à venir. */
export function DayTimeline({
    items,
    empty,
    limit = 4,
    more,
}: {
    items: DayItem[];
    empty: string;
    limit?: number;
    more?: { href: string; label: (hidden: number) => string };
}) {
    if (items.length === 0) return <p className={styles.empty}>{empty}</p>;
    const firstOpen = items.findIndex((d) => d.state !== "done");
    const from =
        firstOpen === -1 ? Math.max(0, items.length - limit) : Math.min(firstOpen, Math.max(0, items.length - limit));
    const shown = items.slice(from, from + limit);
    const hidden = items.length - shown.length;
    return (
        <>
            <ol className={styles.day}>
                {shown.map((d) => (
                    <li key={d.key} className={styles.dayRow} data-state={d.state}>
                        <time className={styles.dayTime}>{d.time}</time>
                        <span className={styles.dayDot} aria-hidden="true" />
                        <div>
                            <div className={styles.name}>
                                {d.title}
                                {d.state === "now" ? <span className={styles.nowTag}>En cours</span> : null}
                            </div>
                            <div className={styles.detail}>{d.sub}</div>
                            {d.actions?.length ? (
                                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                                    {d.actions.map((a) => (
                                        <Link key={a.href} href={a.href} className={styles.pill} style={{ height: 32, padding: "0 12px", fontSize: 13 }}>
                                            {a.label}
                                        </Link>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    </li>
                ))}
            </ol>
            {hidden > 0 && more ? (
                <Link href={more.href} className={styles.link} style={{ display: "inline-block", marginTop: 8 }}>
                    {more.label(hidden)}
                </Link>
            ) : null}
        </>
    );
}

/** Moyennes sur 20 en barres (matières), couleur selon le niveau. */
export function Bars({ items, empty }: { items: { label: string; value: number }[]; empty: string }) {
    if (items.length === 0) return <p className={styles.empty}>{empty}</p>;
    return (
        <ul className={styles.bars}>
            {items.map((b) => {
                const v = Math.max(0, Math.min(20, b.value));
                const color = v >= 14 ? MODULE.green : v >= 10 ? MODULE.blue : MODULE.orange;
                // 0 = aucune note publiée (même convention que les cartes de classe).
                const shown = v > 0 ? `${decimal(v)}/20` : "—";
                return (
                    <li key={b.label} className={styles.barRow}>
                        <span className={styles.name}>{b.label}</span>
                        <span className={styles.barValue}>{shown}</span>
                        <span className={styles.barTrack} role="img" aria-label={v > 0 ? `${b.label} : ${decimal(v)} sur 20` : `${b.label} : pas encore de note`}>
                            <span
                                className={styles.barFill}
                                style={{
                                    width: `${(v / 20) * 100}%`,
                                    background: color,
                                    display: "block",
                                }}
                            />
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export function Empty({ children }: { children: ReactNode }) {
    return <p className={styles.empty}>{children}</p>;
}
