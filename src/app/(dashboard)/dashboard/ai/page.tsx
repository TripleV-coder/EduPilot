"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";

import { Badge, Button, Card, Icon } from "@/components/edu";
import { PageHeader, SubLabel } from "@/components/edu-homes/_shared";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
};

export default function AiAssistantPage() {
    const { data: session } = useSession();
    const userInitial =
        session?.user?.name?.charAt(0)?.toUpperCase() ||
        session?.user?.email?.charAt(0)?.toUpperCase() ||
        "U";

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusHint, setStatusHint] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const starterPrompts = useMemo(
        () => [
            "Analyse le niveau de risque de décrochage de ma classe et propose un plan d'action.",
            "Prépare un message clair aux parents pour améliorer l'assiduité cette semaine.",
            "Résume les priorités académiques à traiter avant la fin de période.",
            "Donne-moi 5 actions concrètes pour améliorer les résultats en mathématiques.",
        ],
        []
    );

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/ai/v2/chat", { method: "GET" });
                const data = await res.json().catch(() => null);
                if (cancelled) return;
                if (!res.ok) {
                    setStatusHint(null);
                    return;
                }
                const providers = data?.status?.providers;
                if (providers) {
                    const parts: string[] = [];
                    if (providers.externalConfigured) parts.push("Externe");
                    if (providers.n8nConfigured) parts.push("n8n");
                    setStatusHint(parts.length ? `Moteurs · ${parts.join(" · ")}` : null);
                }
            } catch {
                // ignore
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const stopGeneration = () => {
        abortRef.current?.abort();
        abortRef.current = null;
        setIsLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);
        setError(null);

        try {
            const assistantId = (Date.now() + 1).toString();
            setMessages((prev) => [
                ...prev,
                {
                    id: assistantId,
                    role: "assistant",
                    content: "",
                    timestamp: new Date(),
                },
            ]);

            const controller = new AbortController();
            abortRef.current = controller;

            const response = await fetch("/api/ai/v2/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg.content, stream: true }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const data = await response.json().catch(() => null);
                const retryAfter = response.headers.get("Retry-After");
                const hint = retryAfter ? ` (réessayer dans ${retryAfter}s)` : "";
                throw new Error((data?.error || "Erreur de communication") + hint);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("Flux indisponible");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const parts = buffer.split("\n\n");
                buffer = parts.pop() || "";

                for (const part of parts) {
                    const line = part.split("\n").find((l) => l.startsWith("data: "));
                    if (!line) continue;
                    const payloadRaw = line.replace(/^data:\s*/, "");
                    try {
                        const payload = JSON.parse(payloadRaw);
                        if (payload.type === "token") {
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantId
                                        ? { ...m, content: m.content + String(payload.content || "") }
                                        : m
                                )
                            );
                        }
                        if (payload.type === "done") {
                            const final = String(payload.content || "");
                            setMessages((prev) =>
                                prev.map((m) =>
                                    m.id === assistantId ? { ...m, content: final || m.content } : m
                                )
                            );
                        }
                        if (payload.type === "error") {
                            throw new Error(payload.message || "Erreur IA");
                        }
                    } catch {
                        // ignore malformed token
                    }
                }
            }
        } catch (err) {
            const isAbort =
                err instanceof Error && err.name === "AbortError";
            if (!isAbort) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            }
        } finally {
            abortRef.current = null;
            setIsLoading(false);
        }
    };

    return (
        <PageGuard
            permission={Permission.SCHOOL_READ}
            roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}
        >
            <div
                className="eduflow-scope mx-auto flex max-w-[1000px] flex-col gap-4 pb-6"
                style={{ minHeight: "calc(100vh - 120px)" }}
            >
                <PageHeader
                    greeting="Assistant EduPilot"
                    sub="Intelligence artificielle d'aide à la décision et au suivi pédagogique."
                    breadcrumb={["Tableau de bord", "Assistant IA"]}
                    actions={
                        <>
                            <Badge variant="neutral" icon="sparkle" size="sm">
                                {messages.length} message{messages.length > 1 ? "s" : ""}
                            </Badge>
                            {isLoading ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon="x"
                                    onClick={stopGeneration}
                                >
                                    Arrêter
                                </Button>
                            ) : null}
                            <Button
                                variant="ghost"
                                size="sm"
                                icon="x"
                                onClick={() => setMessages([])}
                                disabled={isLoading || messages.length === 0}
                            >
                                Effacer
                            </Button>
                        </>
                    }
                />

                <Card
                    padding={0}
                    style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        background: "var(--eduflow-surface-card)",
                    }}
                >
                    <div
                        className="custom-scrollbar"
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: "clamp(16px, 3vw, 28px)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 20,
                            background: "var(--eduflow-surface-sunken)",
                        }}
                    >
                        {messages.length === 0 ? (
                            <div
                                style={{
                                    padding: 20,
                                    borderRadius: "var(--eduflow-radius-card)",
                                    background: "var(--eduflow-surface-card)",
                                    border: "1px solid var(--eduflow-border-subtle)",
                                }}
                            >
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        marginBottom: 14,
                                    }}
                                >
                                    <AvatarGradient />
                                    <div>
                                        <div
                                            style={{
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: "var(--eduflow-text-primary)",
                                            }}
                                        >
                                            Bonjour {session?.user?.name?.split(" ")[0] || ""} 👋
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "var(--eduflow-text-secondary)",
                                            }}
                                        >
                                            Je peux analyser vos données, rédiger pour vous, et vous suggérer des actions.
                                        </div>
                                    </div>
                                </div>
                                <SubLabel>Démarrer rapidement</SubLabel>
                                <div
                                    style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 8,
                                        marginTop: 4,
                                    }}
                                >
                                    {starterPrompts.map((prompt) => (
                                        <button
                                            key={prompt}
                                            type="button"
                                            onClick={() => setInput(prompt)}
                                            style={{
                                                padding: "10px 14px",
                                                fontSize: 12,
                                                fontWeight: 500,
                                                color: "var(--eduflow-text-primary)",
                                                background: "var(--brand-50)",
                                                border: "1px solid var(--brand-100)",
                                                borderRadius: 999,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                textAlign: "left",
                                                maxWidth: 320,
                                                lineHeight: 1.4,
                                                transition:
                                                    "background var(--eduflow-motion-fast) var(--eduflow-ease-out), border-color var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background =
                                                    "var(--brand-100)";
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background =
                                                    "var(--brand-50)";
                                            }}
                                        >
                                            {prompt}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {messages.map((message) => (
                            <MessageBubble
                                key={message.id}
                                message={message}
                                userInitial={userInitial}
                            />
                        ))}

                        {isLoading ? (
                            <div
                                style={{
                                    display: "flex",
                                    gap: 12,
                                    alignItems: "flex-end",
                                }}
                            >
                                <AvatarGradient />
                                <div
                                    style={{
                                        padding: "14px 18px",
                                        borderRadius: "18px 18px 18px 4px",
                                        background: "var(--eduflow-surface-card)",
                                        border: "1px solid var(--eduflow-border-subtle)",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: 6,
                                    }}
                                >
                                    <TypingDot delay="0s" />
                                    <TypingDot delay="0.15s" />
                                    <TypingDot delay="0.3s" />
                                </div>
                            </div>
                        ) : null}

                        {error ? (
                            <div
                                style={{
                                    margin: "0 auto",
                                    maxWidth: 460,
                                    padding: "12px 16px",
                                    borderRadius: 12,
                                    background: "var(--eduflow-danger-50)",
                                    border: "1px solid var(--eduflow-danger-200)",
                                    color: "var(--eduflow-danger-800)",
                                    display: "flex",
                                    gap: 10,
                                    alignItems: "flex-start",
                                    fontSize: 13,
                                    fontWeight: 500,
                                }}
                            >
                                <Icon
                                    name="warning"
                                    size={16}
                                    color="var(--eduflow-danger-600)"
                                />
                                {error}
                            </div>
                        ) : null}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Composer */}
                    <div
                        style={{
                            borderTop: "1px solid var(--eduflow-border-subtle)",
                            padding: 16,
                            background: "var(--eduflow-surface-card)",
                        }}
                    >
                        <form
                            onSubmit={handleSubmit}
                            style={{
                                position: "relative",
                                maxWidth: 720,
                                margin: "0 auto",
                            }}
                        >
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Posez votre question…"
                                disabled={isLoading}
                                aria-label="Message"
                                style={{
                                    width: "100%",
                                    height: 48,
                                    padding: "0 56px 0 18px",
                                    background: "var(--eduflow-surface-sunken)",
                                    border: "1px solid var(--eduflow-border-default)",
                                    borderRadius: 999,
                                    fontFamily: "inherit",
                                    fontSize: 14,
                                    color: "var(--eduflow-text-primary)",
                                    outline: "none",
                                    transition:
                                        "border-color var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = "var(--brand-600)";
                                    e.currentTarget.style.boxShadow =
                                        "0 0 0 3px var(--brand-100)";
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor =
                                        "var(--eduflow-border-default)";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                aria-label="Envoyer"
                                style={{
                                    position: "absolute",
                                    right: 6,
                                    top: 6,
                                    width: 36,
                                    height: 36,
                                    borderRadius: 999,
                                    border: 0,
                                    background:
                                        !input.trim() || isLoading
                                            ? "var(--eduflow-neutral-200)"
                                            : "var(--gradient-cta)",
                                    color: "#fff",
                                    cursor:
                                        !input.trim() || isLoading
                                            ? "not-allowed"
                                            : "pointer",
                                    display: "grid",
                                    placeItems: "center",
                                    boxShadow:
                                        !input.trim() || isLoading
                                            ? "none"
                                            : "var(--eduflow-shadow-cta)",
                                    transition:
                                        "background var(--eduflow-motion-fast) var(--eduflow-ease-out), box-shadow var(--eduflow-motion-fast) var(--eduflow-ease-out)",
                                }}
                            >
                                <Icon name="arrowRight" size={16} color="#fff" />
                            </button>
                        </form>
                        <div
                            style={{
                                marginTop: 10,
                                textAlign: "center",
                                fontSize: 11,
                                color: "var(--eduflow-text-tertiary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                            }}
                        >
                            <Icon name="sparkle" size={12} color="var(--brand-600)" />
                            {statusHint || "Assistant IA · réponses générées en français"}
                        </div>
                    </div>
                </Card>
            </div>
        </PageGuard>
    );
}

function MessageBubble({
    message,
    userInitial,
}: {
    message: Message;
    userInitial: string;
}) {
    const isUser = message.role === "user";
    return (
        <div
            style={{
                display: "flex",
                gap: 12,
                flexDirection: isUser ? "row-reverse" : "row",
                alignItems: "flex-end",
            }}
        >
            {isUser ? (
                <div
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: "50%",
                        background: "var(--brand-100)",
                        color: "var(--brand-700)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        flexShrink: 0,
                    }}
                >
                    {userInitial}
                </div>
            ) : (
                <AvatarGradient />
            )}

            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    maxWidth: "78%",
                    alignItems: isUser ? "flex-end" : "flex-start",
                }}
            >
                <div
                    style={{
                        padding: "12px 16px",
                        fontSize: 14,
                        lineHeight: 1.55,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        borderRadius: isUser
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                        background: isUser
                            ? "var(--brand-600)"
                            : "var(--eduflow-surface-card)",
                        color: isUser ? "#fff" : "var(--eduflow-text-primary)",
                        border: isUser
                            ? "1px solid var(--brand-700)"
                            : "1px solid var(--eduflow-border-subtle)",
                        boxShadow: isUser
                            ? "var(--eduflow-shadow-sm)"
                            : "var(--eduflow-shadow-xs)",
                        fontWeight: isUser ? 500 : 400,
                    }}
                >
                    {message.content || (
                        <span
                            style={{
                                opacity: 0.55,
                                fontStyle: "italic",
                                fontSize: 13,
                            }}
                        >
                            …
                        </span>
                    )}
                </div>
                <span
                    style={{
                        fontSize: 10,
                        color: "var(--eduflow-text-tertiary)",
                        padding: "0 6px",
                        fontWeight: 500,
                    }}
                >
                    {message.timestamp.toLocaleTimeString("fr-FR", {
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </span>
            </div>
        </div>
    );
}

function AvatarGradient() {
    return (
        <div
            style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background:
                    "linear-gradient(135deg, var(--brand-700), var(--brand-accent-600, #4F46E5))",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.28)",
            }}
            aria-hidden
        >
            <Icon name="sparkle" size={16} color="#fff" />
        </div>
    );
}

function TypingDot({ delay }: { delay: string }) {
    return (
        <span
            className="animate-bounce"
            style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--brand-400, #60A5FA)",
                animationDelay: delay,
                display: "inline-block",
            }}
        />
    );
}
