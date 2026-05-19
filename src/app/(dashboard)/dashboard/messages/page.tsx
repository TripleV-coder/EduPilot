"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";

import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import {
    Avatar,
    Badge,
    Button,
    Card,
    Icon,
    Input,
    Spinner,
} from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type UserStub = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
};

type RawMessage = {
    id: string;
    subject: string;
    content: string;
    isRead: boolean;
    isArchived: boolean;
    createdAt: string;
    sender: UserStub;
    recipient: UserStub;
    parent: { id: string; subject: string } | null;
};

type Conversation = {
    otherUserId: string;
    otherUser: UserStub;
    messages: RawMessage[];
    lastMessage: RawMessage;
    unreadCount: number;
};

const ROLE_LABEL: Record<string, string> = {
    SUPER_ADMIN: "Super Admin",
    SCHOOL_ADMIN: "Direction",
    DIRECTOR: "Direction",
    TEACHER: "Enseignant",
    STUDENT: "Élève",
    PARENT: "Parent",
    ACCOUNTANT: "Comptabilité",
    STAFF: "Vie scolaire",
};

function fmtRelative(iso: string): string {
    try {
        const d = new Date(iso);
        const ms = Date.now() - d.getTime();
        const m = Math.floor(ms / 60000);
        if (m < 1) return "à l'instant";
        if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60);
        if (h < 24) return `${h} h`;
        const days = Math.floor(h / 24);
        if (days < 2) return "hier";
        if (days < 7) return `${days} j`;
        return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    } catch {
        return iso;
    }
}

function fmtTime(iso: string): string {
    try {
        return new Date(iso).toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function fmtDayLabel(iso: string): string {
    try {
        const d = new Date(iso);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
        if (d.toDateString() === yesterday.toDateString()) return "Hier";
        return d.toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
        });
    } catch {
        return iso;
    }
}

export default function MessagesPage() {
    const { data: session } = useSession();
    const myId = session?.user?.id;

    const [messages, setMessages] = useState<RawMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [activeOtherId, setActiveOtherId] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const threadRef = useRef<HTMLDivElement>(null);

    const refresh = async () => {
        try {
            const [inboxRes, sentRes] = await Promise.all([
                fetch("/api/messages?type=inbox&limit=100"),
                fetch("/api/messages?type=sent&limit=100"),
            ]);
            const [inbox, sent] = await Promise.all([
                inboxRes.json().catch(() => ({})),
                sentRes.json().catch(() => ({})),
            ]);
            const all: RawMessage[] = [
                ...(inbox.messages ?? inbox.data ?? []),
                ...(sent.messages ?? sent.data ?? []),
            ];
            // Dedup by id (a sent message could appear in both via threading)
            const map = new Map<string, RawMessage>();
            for (const m of all) map.set(m.id, m);
            setMessages(Array.from(map.values()));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    const conversations = useMemo<Conversation[]>(() => {
        if (!myId) return [];
        const buckets = new Map<string, Conversation>();
        for (const m of messages) {
            const otherUser = m.sender.id === myId ? m.recipient : m.sender;
            const key = otherUser.id;
            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = {
                    otherUserId: key,
                    otherUser,
                    messages: [],
                    lastMessage: m,
                    unreadCount: 0,
                };
                buckets.set(key, bucket);
            }
            bucket.messages.push(m);
            if (
                new Date(m.createdAt).getTime() >
                new Date(bucket.lastMessage.createdAt).getTime()
            ) {
                bucket.lastMessage = m;
            }
            if (!m.isRead && m.recipient.id === myId) {
                bucket.unreadCount += 1;
            }
        }
        for (const c of buckets.values()) {
            c.messages.sort(
                (a, b) =>
                    new Date(a.createdAt).getTime() -
                    new Date(b.createdAt).getTime()
            );
        }
        return Array.from(buckets.values()).sort(
            (a, b) =>
                new Date(b.lastMessage.createdAt).getTime() -
                new Date(a.lastMessage.createdAt).getTime()
        );
    }, [messages, myId]);

    const filteredConversations = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return conversations;
        return conversations.filter((c) => {
            const name = `${c.otherUser.firstName} ${c.otherUser.lastName}`.toLowerCase();
            return (
                name.includes(q) ||
                c.lastMessage.subject.toLowerCase().includes(q) ||
                c.lastMessage.content.toLowerCase().includes(q)
            );
        });
    }, [conversations, search]);

    // Pick a default active conversation
    useEffect(() => {
        if (activeOtherId) return;
        if (conversations.length > 0) {
            setActiveOtherId(conversations[0].otherUserId);
        }
    }, [activeOtherId, conversations]);

    const active = useMemo(
        () => conversations.find((c) => c.otherUserId === activeOtherId) ?? null,
        [conversations, activeOtherId]
    );

    const totalUnread = useMemo(
        () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
        [conversations]
    );

    // Mark active conversation's inbound messages as read
    useEffect(() => {
        if (!active || !myId) return;
        const unreadIds = active.messages
            .filter((m) => !m.isRead && m.recipient.id === myId)
            .map((m) => m.id);
        if (unreadIds.length === 0) return;
        Promise.all(
            unreadIds.map((id) =>
                fetch(`/api/messages/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ isRead: true }),
                }).catch(() => null)
            )
        ).then(() => {
            setMessages((prev) =>
                prev.map((m) =>
                    unreadIds.includes(m.id) ? { ...m, isRead: true } : m
                )
            );
        });
    }, [active, myId]);

    // Auto-scroll thread to bottom on switch / new message
    useEffect(() => {
        if (threadRef.current) {
            threadRef.current.scrollTop = threadRef.current.scrollHeight;
        }
    }, [active?.otherUserId, active?.messages.length]);

    const handleSend = async () => {
        if (!active || !draft.trim() || sending) return;
        setSending(true);
        try {
            const lastInThread = active.messages[active.messages.length - 1];
            const subject =
                lastInThread?.subject?.startsWith("Re:")
                    ? lastInThread.subject
                    : `Re: ${lastInThread?.subject ?? "Conversation"}`;
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recipientId: active.otherUser.id,
                    subject,
                    content: draft.trim(),
                    parentId: lastInThread?.id,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || "Échec de l'envoi");
            }
            setDraft("");
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur inconnue");
        } finally {
            setSending(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_READ}>
            <div className="eduflow-scope mx-auto flex max-w-6xl flex-col gap-4 pb-12">
                <PageHeader
                    greeting="Messagerie"
                    sub={`Conversations internes · parents · enseignants · ${totalUnread} non lu${totalUnread > 1 ? "s" : ""}`}
                    breadcrumb={["Communication", "Messagerie"]}
                    actions={
                        <Button
                            icon="plus"
                            onClick={() => {
                                // Best-effort: focus the composer if a conversation is active.
                                const el = document.getElementById(
                                    "message-composer"
                                ) as HTMLInputElement | null;
                                el?.focus();
                            }}
                        >
                            Répondre
                        </Button>
                    }
                />

                {error ? (
                    <Card
                        padding={14}
                        style={{
                            borderLeft: "3px solid var(--eduflow-danger-500)",
                            background: "var(--eduflow-danger-50)",
                        }}
                    >
                        <div className="flex items-center gap-3">
                            <Icon name="warning" size={18} color="var(--eduflow-danger-600)" />
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13,
                                    color: "var(--eduflow-danger-800)",
                                    fontWeight: 500,
                                }}
                            >
                                {error}
                            </p>
                        </div>
                    </Card>
                ) : null}

                {loading ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                        <Spinner size={28} color="var(--brand-600)" />
                        <span style={{ fontSize: 13, color: "var(--eduflow-text-secondary)" }}>
                            Chargement des conversations…
                        </span>
                    </div>
                ) : null}

                {!loading ? (
                    <Card
                        padding={0}
                        style={{
                            height: 620,
                            display: "grid",
                            gridTemplateColumns: "280px 1fr 280px",
                        }}
                        className="msg-grid"
                    >
                        {/* Conversation list */}
                        <div
                            style={{
                                borderRight: "1px solid var(--eduflow-border-subtle)",
                                overflow: "auto",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <div
                                style={{
                                    padding: 14,
                                    borderBottom: "1px solid var(--eduflow-border-subtle)",
                                    background: "var(--eduflow-surface-card)",
                                    position: "sticky",
                                    top: 0,
                                    zIndex: 1,
                                }}
                            >
                                <Input
                                    icon="search"
                                    placeholder="Rechercher…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            {filteredConversations.length === 0 ? (
                                <div
                                    style={{
                                        padding: "32px 18px",
                                        textAlign: "center",
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                    }}
                                >
                                    {conversations.length === 0
                                        ? "Aucune conversation pour l'instant."
                                        : "Aucun résultat."}
                                </div>
                            ) : (
                                filteredConversations.map((c) => {
                                    const isActive = c.otherUserId === activeOtherId;
                                    const name = `${c.otherUser.firstName} ${c.otherUser.lastName}`;
                                    return (
                                        <button
                                            key={c.otherUserId}
                                            type="button"
                                            onClick={() => setActiveOtherId(c.otherUserId)}
                                            style={{
                                                padding: 14,
                                                borderBottom:
                                                    "1px solid var(--eduflow-border-subtle)",
                                                background: isActive
                                                    ? "var(--brand-50)"
                                                    : "transparent",
                                                cursor: "pointer",
                                                display: "flex",
                                                gap: 12,
                                                border: 0,
                                                borderRight: 0,
                                                borderTop: 0,
                                                borderLeft: 0,
                                                width: "100%",
                                                textAlign: "left",
                                                fontFamily: "inherit",
                                            }}
                                        >
                                            <Avatar name={name} size="md" />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        justifyContent: "space-between",
                                                        alignItems: "baseline",
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            fontSize: 13,
                                                            fontWeight: c.unreadCount > 0 ? 700 : 500,
                                                            color: "var(--eduflow-text-primary)",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {name}
                                                    </span>
                                                    <span
                                                        style={{
                                                            fontSize: 10,
                                                            color:
                                                                "var(--eduflow-text-tertiary)",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {fmtRelative(c.lastMessage.createdAt)}
                                                    </span>
                                                </div>
                                                <div
                                                    style={{
                                                        fontSize: 11,
                                                        color: c.unreadCount > 0
                                                            ? "var(--eduflow-text-primary)"
                                                            : "var(--eduflow-text-tertiary)",
                                                        fontWeight: c.unreadCount > 0 ? 600 : 400,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        whiteSpace: "nowrap",
                                                        marginTop: 2,
                                                    }}
                                                >
                                                    {c.lastMessage.content}
                                                </div>
                                            </div>
                                            {c.unreadCount > 0 ? (
                                                <span
                                                    style={{
                                                        width: 18,
                                                        height: 18,
                                                        borderRadius: 9,
                                                        background: "var(--brand-600)",
                                                        color: "#fff",
                                                        fontSize: 10,
                                                        fontWeight: 700,
                                                        display: "grid",
                                                        placeItems: "center",
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {c.unreadCount}
                                                </span>
                                            ) : null}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* Active thread */}
                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                overflow: "hidden",
                            }}
                        >
                            {active ? (
                                <>
                                    <div
                                        style={{
                                            padding: "14px 20px",
                                            borderBottom:
                                                "1px solid var(--eduflow-border-subtle)",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 12,
                                        }}
                                    >
                                        <Avatar
                                            name={`${active.otherUser.firstName} ${active.otherUser.lastName}`}
                                            size="sm"
                                        />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 700,
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {active.otherUser.firstName} {active.otherUser.lastName}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 11,
                                                    color: "var(--eduflow-text-tertiary)",
                                                }}
                                            >
                                                {ROLE_LABEL[active.otherUser.role] ?? active.otherUser.role}
                                            </div>
                                        </div>
                                    </div>
                                    <div
                                        ref={threadRef}
                                        style={{
                                            flex: 1,
                                            padding: 20,
                                            overflow: "auto",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 12,
                                            background:
                                                "var(--eduflow-surface-page, #f6f7fb)",
                                        }}
                                    >
                                        {renderThread(active.messages, myId)}
                                    </div>
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            handleSend();
                                        }}
                                        style={{
                                            padding: 14,
                                            borderTop:
                                                "1px solid var(--eduflow-border-subtle)",
                                            display: "flex",
                                            gap: 8,
                                            alignItems: "center",
                                            background: "var(--eduflow-surface-card)",
                                        }}
                                    >
                                        <input
                                            id="message-composer"
                                            placeholder="Écrire un message…"
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            style={{
                                                flex: 1,
                                                height: 38,
                                                padding: "0 12px",
                                                borderRadius:
                                                    "var(--eduflow-radius-input)",
                                                border:
                                                    "1px solid var(--eduflow-border-default)",
                                                background:
                                                    "var(--eduflow-surface-card)",
                                                fontFamily: "inherit",
                                                fontSize: 13,
                                                color: "var(--eduflow-text-primary)",
                                                outline: "none",
                                            }}
                                        />
                                        <Button
                                            size="md"
                                            icon={sending ? undefined : "chevron"}
                                            loading={sending}
                                            onClick={handleSend}
                                            disabled={!draft.trim() || sending}
                                        >
                                            Envoyer
                                        </Button>
                                    </form>
                                </>
                            ) : (
                                <div
                                    style={{
                                        flex: 1,
                                        display: "grid",
                                        placeItems: "center",
                                        textAlign: "center",
                                        padding: 24,
                                        color: "var(--eduflow-text-tertiary)",
                                        fontSize: 13,
                                    }}
                                >
                                    Sélectionne une conversation pour démarrer.
                                </div>
                            )}
                        </div>

                        {/* Right context */}
                        <div
                            style={{
                                borderLeft: "1px solid var(--eduflow-border-subtle)",
                                padding: 16,
                                overflow: "auto",
                                background: "var(--eduflow-surface-card)",
                            }}
                        >
                            {active ? (
                                <>
                                    <div style={{ textAlign: "center" }}>
                                        <div
                                            style={{
                                                display: "inline-block",
                                                margin: "0 auto",
                                            }}
                                        >
                                            <Avatar
                                                name={`${active.otherUser.firstName} ${active.otherUser.lastName}`}
                                                size="xl"
                                            />
                                        </div>
                                    </div>
                                    <div style={{ textAlign: "center", marginTop: 10 }}>
                                        <div
                                            className="eduflow-display"
                                            style={{ fontSize: 16, fontWeight: 700 }}
                                        >
                                            {active.otherUser.firstName} {active.otherUser.lastName}
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                            }}
                                        >
                                            {ROLE_LABEL[active.otherUser.role] ?? active.otherUser.role}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            marginTop: 18,
                                            paddingTop: 18,
                                            borderTop:
                                                "1px solid var(--eduflow-border-subtle)",
                                        }}
                                    >
                                        <SubLabel>Contact</SubLabel>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "var(--eduflow-text-secondary)",
                                                marginTop: 6,
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: 6,
                                            }}
                                        >
                                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                                <Icon
                                                    name="sms"
                                                    size={12}
                                                    color="var(--brand-700)"
                                                />
                                                <a
                                                    href={`mailto:${active.otherUser.email}`}
                                                    style={{
                                                        color: "var(--eduflow-text-secondary)",
                                                        textDecoration: "none",
                                                    }}
                                                >
                                                    {active.otherUser.email}
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 18 }}>
                                        <SubLabel>
                                            Conversation · {active.messages.length} message{active.messages.length > 1 ? "s" : ""}
                                        </SubLabel>
                                        <div
                                            style={{
                                                fontSize: 11,
                                                color: "var(--eduflow-text-tertiary)",
                                                marginTop: 6,
                                                lineHeight: 1.6,
                                            }}
                                        >
                                            Démarrée le{" "}
                                            {new Date(active.messages[0].createdAt).toLocaleDateString("fr-FR", {
                                                day: "numeric",
                                                month: "long",
                                                year: "numeric",
                                            })}
                                            <br />
                                            {active.unreadCount > 0 ? (
                                                <Badge variant="warning" size="sm">
                                                    {active.unreadCount} non lu{active.unreadCount > 1 ? "s" : ""}
                                                </Badge>
                                            ) : (
                                                <Badge variant="success" size="sm" icon="check">
                                                    À jour
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: "var(--eduflow-text-tertiary)",
                                        textAlign: "center",
                                        padding: "32px 8px",
                                    }}
                                >
                                    Sélectionne une conversation pour voir le contact.
                                </div>
                            )}
                        </div>
                    </Card>
                ) : null}
            </div>

            <style jsx global>{`
                @media (max-width: 1100px) {
                    .msg-grid {
                        grid-template-columns: 260px 1fr !important;
                    }
                    .msg-grid > div:last-child {
                        display: none !important;
                    }
                }
                @media (max-width: 760px) {
                    .msg-grid {
                        grid-template-columns: 1fr !important;
                    }
                    .msg-grid > div:first-child {
                        height: 280px;
                    }
                }
            `}</style>
        </PageGuard>
    );
}

function renderThread(messages: RawMessage[], myId: string | undefined): React.ReactNode {
    if (messages.length === 0) {
        return (
            <div
                style={{
                    margin: "auto",
                    fontSize: 12,
                    color: "var(--eduflow-text-tertiary)",
                }}
            >
                Aucun message dans cette conversation.
            </div>
        );
    }
    const out: React.ReactNode[] = [];
    let lastDay: string | null = null;
    for (const m of messages) {
        const dayKey = new Date(m.createdAt).toDateString();
        if (dayKey !== lastDay) {
            out.push(
                <div
                    key={`day-${dayKey}`}
                    style={{
                        alignSelf: "center",
                        padding: "4px 12px",
                        borderRadius: 12,
                        background: "var(--eduflow-surface-card)",
                        fontSize: 10,
                        color: "var(--eduflow-text-tertiary)",
                        border: "1px solid var(--eduflow-border-subtle)",
                    }}
                >
                    {fmtDayLabel(m.createdAt)}
                </div>
            );
            lastDay = dayKey;
        }
        const fromMe = m.sender.id === myId;
        out.push(
            <div
                key={m.id}
                style={{
                    alignSelf: fromMe ? "flex-end" : "flex-start",
                    display: "flex",
                    gap: 8,
                    maxWidth: "70%",
                }}
            >
                {!fromMe ? (
                    <Avatar
                        name={`${m.sender.firstName} ${m.sender.lastName}`}
                        size="xs"
                    />
                ) : null}
                <div>
                    {m.subject && !m.subject.startsWith("Re:") ? (
                        <div
                            style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "var(--eduflow-text-tertiary)",
                                marginBottom: 4,
                                textTransform: "uppercase",
                                letterSpacing: "0.06em",
                                textAlign: fromMe ? "right" : "left",
                            }}
                        >
                            {m.subject}
                        </div>
                    ) : null}
                    <div
                        style={{
                            padding: "10px 14px",
                            background: fromMe
                                ? "var(--brand-600)"
                                : "var(--eduflow-surface-card)",
                            color: fromMe ? "#fff" : "var(--eduflow-text-primary)",
                            borderRadius: 14,
                            borderBottomRightRadius: fromMe ? 4 : 14,
                            borderBottomLeftRadius: !fromMe ? 4 : 14,
                            fontSize: 13,
                            lineHeight: 1.5,
                            boxShadow: !fromMe ? "var(--shadow-sm)" : "none",
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                        }}
                    >
                        {m.content}
                    </div>
                    <div
                        style={{
                            fontSize: 9,
                            color: "var(--eduflow-text-tertiary)",
                            marginTop: 4,
                            textAlign: fromMe ? "right" : "left",
                        }}
                    >
                        {fmtTime(m.createdAt)}
                        {fromMe ? (m.isRead ? " · lu" : " · envoyé") : ""}
                    </div>
                </div>
            </div>
        );
    }
    return out;
}
