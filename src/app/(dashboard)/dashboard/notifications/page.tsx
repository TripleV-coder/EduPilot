"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Badge,
    Button,
    Card,
    Icon,
    Spinner,
} from "@/components/edu";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { PageLoading, PageError } from "@/components/layout/page-states";
import { SubLabel } from "@/components/edu-homes/_shared";

type CatColor = "neutral" | "danger" | "warning" | "success" | "info" | "brand";

type Category = {
    key: string;
    label: string;
    color: CatColor;
    count: number;
};

type UiType = "urgent" | "success" | "warning" | "reminder" | "info" | "sms";

type NotifItem = {
    id: string;
    type: string;
    category: string;
    uiType: UiType;
    priority: "P0" | "P1" | "P2";
    title: string;
    body: string;
    link: string | null;
    isRead: boolean;
    createdAt: string;
    relativeTime: string;
    bucket: "urgent" | "today" | "thisWeek" | "older";
};

type Group = {
    bucket: "urgent" | "today" | "thisWeek" | "older";
    title: string;
    subtitle: string;
    items: NotifItem[];
};

type Preview = {
    id: string;
    accent: "info" | "success" | "warning" | "danger";
    badge: string;
    title: string;
    time: string;
    body: string;
    link: string | null;
} | null;

type FeedData = {
    role: string;
    unreadCount: number;
    categories: Category[];
    groups: Group[];
    preview: Preview;
    totalCount: number;
};

const ACCENT_FOR_UI: Record<UiType, "info" | "success" | "warning" | "danger"> = {
    urgent: "danger",
    success: "success",
    warning: "warning",
    reminder: "info",
    info: "info",
    sms: "info",
};

const CHANNELS = [
    { key: "app", label: "App", defaultOn: true },
    { key: "sms", label: "SMS", defaultOn: true },
    { key: "whatsapp", label: "WhatsApp", defaultOn: false },
    { key: "email", label: "Email", defaultOn: true },
];

export default function NotificationsCenterPage() {
    const [activeCat, setActiveCat] = useState("all");
    const [data, setData] = useState<FeedData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [marking, setMarking] = useState(false);

    useEffect(() => {
        let cancelled = false;
        const fetchFeed = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/notifications/feed?category=${activeCat}`);
                const body = await res.json();
                if (!res.ok) throw new Error(body.error || "Erreur");
                if (cancelled) return;
                setData(body);
                setSelectedId(body.preview?.id ?? null);
            } catch (err) {
                if (!cancelled)
                    setError(err instanceof Error ? err.message : "Erreur inconnue");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        fetchFeed();
        return () => {
            cancelled = true;
        };
    }, [activeCat]);

    const allItems = useMemo(() => {
        if (!data) return [] as NotifItem[];
        return data.groups.flatMap((g) => g.items);
    }, [data]);

    const selectedItem = useMemo<NotifItem | null>(() => {
        if (!selectedId) return null;
        return allItems.find((i) => i.id === selectedId) ?? null;
    }, [allItems, selectedId]);

    const livePreview: Preview = useMemo(() => {
        if (!selectedItem) return data?.preview ?? null;
        return {
            id: selectedItem.id,
            accent: ACCENT_FOR_UI[selectedItem.uiType],
            badge:
                selectedItem.priority === "P0"
                    ? "PRIORITÉ HAUTE"
                    : selectedItem.uiType === "success"
                    ? "🎉 RÉUSSITE"
                    : selectedItem.uiType === "sms"
                    ? "MESSAGE"
                    : "INFO",
            title: selectedItem.title,
            time: `Reçu il y a ${selectedItem.relativeTime}`,
            body: selectedItem.body,
            link: selectedItem.link,
        };
    }, [data, selectedItem]);

    const markAllRead = async () => {
        if (marking || !data || data.unreadCount === 0) return;
        setMarking(true);
        try {
            await Promise.all(
                allItems
                    .filter((i) => !i.isRead)
                    .map((i) =>
                        fetch(`/api/notifications/${i.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ isRead: true }),
                        }).catch(() => null)
                    )
            );
            const res = await fetch(`/api/notifications/feed?category=${activeCat}`);
            if (res.ok) {
                const body = await res.json();
                setData(body);
                setSelectedId(body.preview?.id ?? null);
            }
        } finally {
            setMarking(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_READ}>
            <PageShell className="max-w-6xl pb-12">
                <PageHeader
                    title="Centre de notifications"
                    description={
                        data
                            ? `${data.totalCount} messages · ${data.unreadCount} non lus · regroupés et priorisés`
                            : "Vue intelligente · regroupement automatique"
                    }
                    breadcrumbs={[{ label: "Notifications" }]}
                    actions={
                        <>
                            <Link href="/dashboard/settings/notifications">
                                <Button variant="ghost" icon="settings">
                                    Préférences
                                </Button>
                            </Link>
                            <Button
                                variant="secondary"
                                icon="check"
                                loading={marking}
                                onClick={markAllRead}
                                disabled={
                                    !data || data.unreadCount === 0 || marking
                                }
                            >
                                Tout marquer lu
                            </Button>
                        </>
                    }
                />

                {error && !data ? (
                    <PageError message={error} />
                ) : null}

                {loading && !data ? (
                    <PageLoading label="Chargement des notifications…" />
                ) : null}

                {data ? (
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "220px 1.5fr 1fr",
                            gap: 14,
                            alignItems: "start",
                        }}
                        className="notif-grid"
                    >
                        {/* Filter rail */}
                        <Card padding={10}>
                            <SubLabel>Filtrer</SubLabel>
                            <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 2,
                                    marginTop: 6,
                                }}
                            >
                                {data.categories.map((c) => {
                                    const active = c.key === activeCat;
                                    return (
                                        <button
                                            key={c.key}
                                            type="button"
                                            onClick={() => setActiveCat(c.key)}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                padding: "8px 10px",
                                                borderRadius: 8,
                                                border: 0,
                                                background: active
                                                    ? "var(--brand-50)"
                                                    : "transparent",
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                textAlign: "left",
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 8,
                                                    fontSize: 12,
                                                    fontWeight: active ? 700 : 500,
                                                    color: active
                                                        ? "var(--brand-800)"
                                                        : "var(--eduflow-text-secondary)",
                                                }}
                                            >
                                                <span
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: 3,
                                                        background: `var(--eduflow-${c.color}-500, var(--eduflow-neutral-500))`,
                                                    }}
                                                />
                                                {c.label}
                                            </span>
                                            <span
                                                className="tabular"
                                                style={{
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    color:
                                                        "var(--eduflow-text-tertiary)",
                                                    fontVariantNumeric: "tabular-nums",
                                                }}
                                            >
                                                {c.count}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            <div
                                style={{
                                    marginTop: 18,
                                    paddingTop: 14,
                                    borderTop:
                                        "1px solid var(--eduflow-border-subtle)",
                                }}
                            >
                                <SubLabel>Canal préféré</SubLabel>
                                <div
                                    style={{
                                        marginTop: 6,
                                        fontSize: 12,
                                        color: "var(--eduflow-text-secondary)",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 8,
                                    }}
                                >
                                    {CHANNELS.map((ch) => (
                                        <label
                                            key={ch.key}
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 8,
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                defaultChecked={ch.defaultOn}
                                            />
                                            {ch.label}
                                        </label>
                                    ))}
                                </div>
                                <p
                                    style={{
                                        fontSize: 10,
                                        color: "var(--eduflow-text-tertiary)",
                                        marginTop: 10,
                                        lineHeight: 1.5,
                                    }}
                                >
                                    Tes préférences détaillées sont dans Paramètres → Notifications.
                                </p>
                            </div>
                        </Card>

                        {/* Grouped feed */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                            {data.groups.length === 0 ? (
                                <Card padding={36}>
                                    <div className="flex flex-col items-center gap-3 text-center">
                                        <div
                                            className="grid place-items-center"
                                            style={{
                                                width: 60,
                                                height: 60,
                                                borderRadius: 16,
                                                background: "var(--brand-50)",
                                            }}
                                        >
                                            <Icon name="bell" size={26} color="var(--brand-700)" />
                                        </div>
                                        <h3
                                            className="eduflow-display"
                                            style={{ fontSize: 18, margin: 0 }}
                                        >
                                            Tout est calme
                                        </h3>
                                        <p
                                            style={{
                                                fontSize: 13,
                                                color: "var(--eduflow-text-secondary)",
                                                maxWidth: 380,
                                                lineHeight: 1.55,
                                                margin: 0,
                                            }}
                                        >
                                            Aucune notification dans cette catégorie. EduPilot te
                                            préviendra ici dès qu'il faut agir.
                                        </p>
                                    </div>
                                </Card>
                            ) : (
                                data.groups.map((g) => (
                                    <NotifGroup
                                        key={g.bucket}
                                        group={g}
                                        selectedId={selectedId}
                                        onSelect={setSelectedId}
                                    />
                                ))
                            )}
                        </div>

                        {/* Preview */}
                        <div
                            style={{
                                position: "sticky",
                                top: 16,
                                display: "flex",
                                flexDirection: "column",
                                gap: 14,
                            }}
                        >
                            {livePreview ? (
                                <PreviewCard preview={livePreview} />
                            ) : (
                                <Card padding={24}>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "var(--eduflow-text-tertiary)",
                                            textAlign: "center",
                                        }}
                                    >
                                        Sélectionne une notification pour voir le détail.
                                    </div>
                                </Card>
                            )}
                            <Card
                                style={{
                                    background: "var(--brand-50)",
                                    border: "1px solid var(--brand-200)",
                                }}
                            >
                                <div style={{ display: "flex", gap: 10 }}>
                                    <Icon
                                        name="sparkle"
                                        size={16}
                                        color="var(--brand-700)"
                                        style={{ marginTop: 2 }}
                                    />
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: "var(--brand-800)",
                                            lineHeight: 1.55,
                                        }}
                                    >
                                        <strong>Intelligence :</strong> EduPilot regroupe les
                                        alertes répétitives en une seule notification et agit en
                                        ton nom (SMS auto, rappels) selon tes règles.
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                ) : null}
            </PageShell>

            <style jsx global>{`
                @media (max-width: 1100px) {
                    .notif-grid {
                        grid-template-columns: 200px 1fr !important;
                    }
                    .notif-grid > div:last-child {
                        grid-column: 1 / -1;
                    }
                }
                @media (max-width: 760px) {
                    .notif-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </PageGuard>
    );
}

function NotifGroup({
    group,
    selectedId,
    onSelect,
}: {
    group: Group;
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    return (
        <Card padding={0}>
            <div
                style={{
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--eduflow-border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <h3
                    className="eduflow-display"
                    style={{ fontSize: 14, margin: 0, fontWeight: 700 }}
                >
                    {group.title}
                </h3>
                <span
                    style={{
                        fontSize: 11,
                        color: "var(--eduflow-text-tertiary)",
                    }}
                >
                    {group.items.length} · {group.subtitle}
                </span>
            </div>
            <div>
                {group.items.map((item, i) => (
                    <NotifRow
                        key={item.id}
                        item={item}
                        first={i === 0}
                        active={item.id === selectedId}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </Card>
    );
}

function NotifRow({
    item,
    first,
    active,
    onSelect,
}: {
    item: NotifItem;
    first: boolean;
    active: boolean;
    onSelect: (id: string) => void;
}) {
    const accent = ACCENT_FOR_UI[item.uiType];
    const dotColor = `var(--eduflow-${accent}-500)`;
    return (
        <button
            type="button"
            onClick={() => onSelect(item.id)}
            style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "14px 18px",
                borderTop: first ? "none" : "1px solid var(--eduflow-border-subtle)",
                background: active
                    ? "var(--brand-50)"
                    : !item.isRead
                    ? "var(--eduflow-surface-card)"
                    : "transparent",
                cursor: "pointer",
                border: "0",
                borderLeft: active ? "3px solid var(--brand-600)" : "3px solid transparent",
                fontFamily: "inherit",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                }}
            >
                <span
                    style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: dotColor,
                        marginTop: 6,
                        flexShrink: 0,
                    }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                        style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "baseline",
                            gap: 12,
                            marginBottom: 2,
                            flexWrap: "wrap",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 13,
                                fontWeight: item.isRead ? 500 : 700,
                                color: "var(--eduflow-text-primary)",
                            }}
                        >
                            {item.title}
                        </span>
                        <span
                            style={{
                                fontSize: 10,
                                color: "var(--eduflow-text-tertiary)",
                                whiteSpace: "nowrap",
                                fontVariantNumeric: "tabular-nums",
                            }}
                        >
                            {item.relativeTime}
                        </span>
                    </div>
                    <p
                        style={{
                            fontSize: 12,
                            color: "var(--eduflow-text-secondary)",
                            margin: 0,
                            lineHeight: 1.55,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {item.body}
                    </p>
                    {item.priority === "P0" ? (
                        <div style={{ marginTop: 6 }}>
                            <Badge variant="danger" size="sm">
                                Priorité haute · à traiter
                            </Badge>
                        </div>
                    ) : null}
                </div>
            </div>
        </button>
    );
}

function PreviewCard({ preview }: { preview: NonNullable<Preview> }) {
    return (
        <Card padding={0}>
            <div
                style={{
                    padding: "14px 18px",
                    background: `var(--eduflow-${preview.accent}-50)`,
                    borderBottom: `1px solid var(--eduflow-${preview.accent}-200)`,
                }}
            >
                <Badge variant={preview.accent} size="sm">
                    {preview.badge}
                </Badge>
                <h3
                    className="eduflow-display"
                    style={{
                        fontSize: 16,
                        margin: "8px 0 0",
                        lineHeight: 1.3,
                    }}
                >
                    {preview.title}
                </h3>
                <p
                    style={{
                        fontSize: 11,
                        color: `var(--eduflow-${preview.accent}-800)`,
                        margin: "4px 0 0",
                    }}
                >
                    {preview.time}
                </p>
            </div>
            <div style={{ padding: 18 }}>
                <div
                    style={{
                        fontSize: 12,
                        color: "var(--eduflow-text-secondary)",
                        lineHeight: 1.6,
                        marginBottom: 14,
                        whiteSpace: "pre-line",
                    }}
                >
                    {preview.body}
                </div>
                {preview.link ? (
                    <Link href={preview.link} style={{ textDecoration: "none" }}>
                        <Button size="sm" iconRight="chevron">
                            Ouvrir
                        </Button>
                    </Link>
                ) : null}
            </div>
        </Card>
    );
}
