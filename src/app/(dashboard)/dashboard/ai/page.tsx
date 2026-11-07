"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { PageGuard } from "@/components/guard/page-guard";
import { Permission } from "@/lib/rbac/permissions";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { useSchool } from "@/components/providers/school-provider";
import { Badge, Button, Card, Icon } from "@/components/edu";
import type { AnswerBlock, AssistantAnswer, AssistantContext, Tone } from "@/lib/ai/assistant/types";

type Message =
    | { id: string; role: "user"; content: string; timestamp: Date }
    | { id: string; role: "assistant"; answer: AssistantAnswer; timestamp: Date };

const TONE_COLORS: Record<Tone, { fg: string; bg: string; border: string }> = {
    neutral: { fg: "var(--eduflow-text-primary)", bg: "var(--eduflow-surface-sunken)", border: "var(--eduflow-border-subtle)" },
    success: { fg: "var(--eduflow-success-800)", bg: "var(--eduflow-success-50)", border: "var(--eduflow-success-200)" },
    warning: { fg: "var(--eduflow-warning-800)", bg: "var(--eduflow-warning-50)", border: "var(--eduflow-warning-200)" },
    danger: { fg: "var(--eduflow-danger-800)", bg: "var(--eduflow-danger-50)", border: "var(--eduflow-danger-200)" },
    info: { fg: "var(--eduflow-info-800)", bg: "var(--eduflow-info-50)", border: "var(--eduflow-info-200)" },
};

const STARTERS: Record<string, string[]> = {
    direction: ["Vue d'ensemble de l'école", "Élèves à risque", "Absences de cette semaine", "Combien reste-t-il à encaisser ?"],
    TEACHER: ["Élèves à risque dans mes classes", "Mon emploi du temps de demain", "Absences de cette semaine", "Que sais-tu faire ?"],
    STUDENT: ["Mes dernières notes", "Ma prévision pour la prochaine période", "Mes devoirs à rendre", "Mon emploi du temps de demain"],
    PARENT: ["Comment va mon enfant ?", "Combien je dois encore payer ?", "Devoirs à rendre", "Absences de ce mois"],
};

function startersFor(role: string | undefined): string[] {
    if (role === "TEACHER" || role === "STUDENT" || role === "PARENT") return STARTERS[role];
    return STARTERS.direction;
}

export default function AiAssistantPage() {
    // Garde avant chargement (TD-024) : aucune requête tant que le rôle n'est pas admis.
    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <AiAssistantPageContent />
        </PageGuard>
    );
}

function AiAssistantPageContent() {
    const { data: session } = useSession();
    const { enabledModules } = useSchool();
    const aiOff = enabledModules.length > 0 && !enabledModules.includes("ai");
    const userInitial = session?.user?.name?.charAt(0)?.toUpperCase() || session?.user?.email?.charAt(0)?.toUpperCase() || "U";

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const contextRef = useRef<AssistantContext | undefined>(undefined);
    const abortRef = useRef<AbortController | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, isLoading]);

    useEffect(() => () => abortRef.current?.abort(), []);

    const ask = async (question: string) => {
        const content = question.trim();
        if (!content || isLoading) return;
        if (aiOff) {
            setError("Le module Assistant IA n'est pas activé pour cet établissement.");
            return;
        }
        setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content, timestamp: new Date() }]);
        setInput("");
        setIsLoading(true);
        setError(null);

        const controller = new AbortController();
        abortRef.current = controller;
        try {
            const response = await fetch("/api/ai/v2/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: content, context: contextRef.current }),
                signal: controller.signal,
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data) {
                const retryAfter = response.headers.get("Retry-After");
                throw new Error((data?.error || "L'assistant n'a pas pu répondre.") + (retryAfter ? ` Réessayez dans ${retryAfter} s.` : ""));
            }
            const answer = data as AssistantAnswer;
            contextRef.current = answer.context;
            setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", answer, timestamp: new Date() }]);
        } catch (err) {
            if (!(err instanceof Error && err.name === "AbortError")) {
                setError(err instanceof Error ? err.message : "Erreur inconnue");
            }
        } finally {
            abortRef.current = null;
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        void ask(input);
    };

    const reset = () => {
        abortRef.current?.abort();
        contextRef.current = undefined;
        setMessages([]);
        setError(null);
    };

    const questionCount = messages.filter((m) => m.role === "user").length;
    const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

    return (
        <PageShell className="eduflow-scope max-w-[1000px] pb-6">
            <div style={{ minHeight: "calc(100vh - 120px)", display: "flex", flexDirection: "column", gap: 16 }}>
                {aiOff ? (
                    <Card padding={16}>
                        <p className="text-sm">Le module Assistant IA n&apos;est pas activé pour cet établissement.</p>
                    </Card>
                ) : null}
                <PageHeader
                    title="Assistant EduPilot"
                    description="Réponses calculées sur les données réelles de votre établissement, sans service externe."
                    breadcrumbs={[{ label: "Tableau de bord", href: "/dashboard" }, { label: "Assistant IA" }]}
                    actions={
                        <>
                            <Badge variant="neutral" icon="sparkle" size="sm">
                                {questionCount} question{questionCount > 1 ? "s" : ""}
                            </Badge>
                            <Button variant="ghost" size="sm" icon="x" onClick={reset} disabled={messages.length === 0}>
                                Nouvelle conversation
                            </Button>
                        </>
                    }
                />

                <Card padding={0} style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--eduflow-surface-card)" }}>
                    <div
                        className="custom-scrollbar"
                        aria-live="polite"
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
                            <Welcome name={session?.user?.name?.split(" ")[0]} starters={startersFor(session?.user?.role)} onPick={(q) => void ask(q)} />
                        ) : null}

                        {messages.map((message) =>
                            message.role === "user" ? (
                                <UserBubble key={message.id} content={message.content} initial={userInitial} timestamp={message.timestamp} />
                            ) : (
                                <AssistantBubble
                                    key={message.id}
                                    answer={message.answer}
                                    timestamp={message.timestamp}
                                    interactive={message.id === lastAssistantId && !isLoading}
                                    onPick={(q) => void ask(q)}
                                />
                            ),
                        )}

                        {isLoading ? (
                            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }} role="status" aria-label="L'assistant cherche la réponse">
                                <AvatarGradient />
                                <div
                                    style={{
                                        padding: "14px 18px",
                                        borderRadius: "18px 18px 18px 4px",
                                        background: "var(--eduflow-surface-card)",
                                        border: "1px solid var(--eduflow-border-subtle)",
                                        display: "inline-flex",
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
                                role="alert"
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
                                <Icon name="warning" size={16} color="var(--eduflow-danger-600)" />
                                {error}
                            </div>
                        ) : null}
                        <div ref={messagesEndRef} />
                    </div>

                    <div style={{ borderTop: "1px solid var(--eduflow-border-subtle)", padding: 16, background: "var(--eduflow-surface-card)" }}>
                        <form onSubmit={handleSubmit} style={{ position: "relative", maxWidth: 720, margin: "0 auto" }}>
                            <input
                                ref={inputRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ex. : élèves à risque en 3e B, absences d'hier…"
                                disabled={isLoading}
                                maxLength={500}
                                aria-label="Votre question"
                                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-600)]"
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
                                    background: !input.trim() || isLoading ? "var(--eduflow-neutral-200)" : "var(--gradient-cta)",
                                    cursor: !input.trim() || isLoading ? "not-allowed" : "pointer",
                                    display: "grid",
                                    placeItems: "center",
                                }}
                            >
                                <Icon name="arrowRight" size={16} color="#fff" />
                            </button>
                        </form>
                        <div
                            style={{
                                marginTop: 10,
                                textAlign: "center",
                                fontSize: 12,
                                color: "var(--eduflow-text-tertiary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                            }}
                        >
                            <Icon name="sparkle" size={12} color="var(--brand-600)" />
                            Calculé sur votre établissement · aucune donnée ne quitte le serveur
                        </div>
                    </div>
                </Card>
            </div>
        </PageShell>
    );
}

function Welcome({ name, starters, onPick }: { name?: string; starters: string[]; onPick: (q: string) => void }) {
    return (
        <div style={{ padding: 20, borderRadius: "var(--eduflow-radius-card)", background: "var(--eduflow-surface-card)", border: "1px solid var(--eduflow-border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <AvatarGradient />
                <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--eduflow-text-primary)" }}>Bonjour{name ? ` ${name}` : ""} 👋</div>
                    <div style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}>
                        Posez une question en français, même avec des fautes : je réponds avec les chiffres de votre établissement.
                    </div>
                </div>
            </div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--eduflow-text-tertiary)", marginBottom: 10 }}>Pour commencer</p>
            <SuggestionChips items={starters} onPick={onPick} />
        </div>
    );
}

function SuggestionChips({ items, onPick }: { items: string[]; onPick: (q: string) => void }) {
    if (items.length === 0) return null;
    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {items.map((item) => (
                <button
                    key={item}
                    type="button"
                    onClick={() => onPick(item)}
                    // Couleurs « info » : inversées en mode sombre (les --brand-50/100 ne le sont pas)
                    className="transition-colors hover:bg-[var(--eduflow-info-100)]"
                    style={{
                        padding: "8px 14px",
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--eduflow-info-800)",
                        background: "var(--eduflow-info-50)",
                        border: "1px solid var(--eduflow-info-200)",
                        borderRadius: 999,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                        lineHeight: 1.4,
                    }}
                >
                    {item}
                </button>
            ))}
        </div>
    );
}

/** Gras `**…**` et sauts de ligne ; tout le reste est rendu comme du texte (aucun HTML injecté). */
function RichText({ text }: { text: string }) {
    return (
        <>
            {text.split("\n").map((line, lineIndex) => (
                <p key={lineIndex} style={{ margin: lineIndex === 0 ? 0 : "6px 0 0" }}>
                    {line.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
                        part.startsWith("**") && part.endsWith("**") ? <strong key={index}>{part.slice(2, -2)}</strong> : <span key={index}>{part}</span>,
                    )}
                </p>
            ))}
        </>
    );
}

function MaybeLink({ href, children }: { href?: string; children: ReactNode }) {
    if (!href) return <>{children}</>;
    return (
        <Link href={href} className="hover:underline" style={{ color: "var(--eduflow-info-700)", fontWeight: 600 }}>
            {children}
        </Link>
    );
}

function BlockTitle({ title }: { title?: string }) {
    if (!title) return null;
    return <div style={{ fontSize: 12, fontWeight: 700, color: "var(--eduflow-text-secondary)", marginBottom: 6 }}>{title}</div>;
}

function Block({ block }: { block: AnswerBlock }) {
    if (block.type === "text") {
        return (
            <div style={{ color: "var(--eduflow-text-secondary)" }}>
                <RichText text={block.text} />
            </div>
        );
    }
    if (block.type === "metrics") {
        return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 }}>
                {block.items.map((item) => {
                    const tone = TONE_COLORS[item.tone ?? "neutral"];
                    return (
                        <div key={item.label} style={{ padding: "10px 12px", borderRadius: 12, background: tone.bg, border: `1px solid ${tone.border}` }}>
                            <div style={{ fontSize: 12, color: "var(--eduflow-text-secondary)" }}>{item.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: tone.fg, fontVariantNumeric: "tabular-nums" }}>{item.value}</div>
                        </div>
                    );
                })}
            </div>
        );
    }
    if (block.type === "table") {
        return (
            <div>
                <BlockTitle title={block.title} />
                <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid var(--eduflow-border-subtle)" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: "var(--eduflow-surface-sunken)" }}>
                                {block.columns.map((column) => (
                                    <th
                                        key={column}
                                        scope="col"
                                        style={{ textAlign: "left", padding: "8px 10px", fontSize: 12, fontWeight: 600, color: "var(--eduflow-text-secondary)", whiteSpace: "nowrap" }}
                                    >
                                        {column}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {block.rows.map((row, rowIndex) => (
                                <tr key={rowIndex} style={{ borderTop: "1px solid var(--eduflow-border-subtle)" }}>
                                    {row.cells.map((cell, cellIndex) => {
                                        const emphasised = cellIndex === row.cells.length - 1 && row.tone;
                                        return (
                                            <td
                                                key={cellIndex}
                                                style={{
                                                    padding: "8px 10px",
                                                    fontVariantNumeric: "tabular-nums",
                                                    color: emphasised ? TONE_COLORS[row.tone ?? "neutral"].fg : "var(--eduflow-text-primary)",
                                                    fontWeight: emphasised ? 600 : 400,
                                                }}
                                            >
                                                {cellIndex === 0 ? <MaybeLink href={row.href}>{cell}</MaybeLink> : cell}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
    if (block.type === "list") {
        return (
            <div>
                <BlockTitle title={block.title} />
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                    {block.items.map((item, index) => {
                        const tone = item.tone ? TONE_COLORS[item.tone] : null;
                        return (
                            <li
                                key={index}
                                style={{
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    background: tone?.bg ?? "var(--eduflow-surface-sunken)",
                                    border: `1px solid ${tone?.border ?? "var(--eduflow-border-subtle)"}`,
                                    fontSize: 13,
                                }}
                            >
                                <MaybeLink href={item.href}>{item.label}</MaybeLink>
                                {item.detail ? <span style={{ color: tone?.fg ?? "var(--eduflow-text-secondary)" }}> — {item.detail}</span> : null}
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }
    return (
        <div>
            <BlockTitle title={block.title} />
            <blockquote
                style={{
                    margin: 0,
                    padding: "10px 14px",
                    borderLeft: "3px solid var(--eduflow-info-500)",
                    background: "var(--eduflow-info-50)",
                    color: "var(--eduflow-text-primary)",
                    borderRadius: 8,
                    fontSize: 14,
                    lineHeight: 1.55,
                }}
            >
                {block.text}
            </blockquote>
        </div>
    );
}

const timeFormat = (date: Date) => date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

function UserBubble({ content, initial, timestamp }: { content: string; initial: string; timestamp: Date }) {
    return (
        <div style={{ display: "flex", gap: 12, flexDirection: "row-reverse", alignItems: "flex-end" }}>
            <div
                aria-hidden
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
                {initial}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: "78%", alignItems: "flex-end" }}>
                <div
                    style={{
                        padding: "12px 16px",
                        fontSize: 14,
                        lineHeight: 1.55,
                        wordBreak: "break-word",
                        borderRadius: "18px 18px 4px 18px",
                        background: "var(--brand-600)",
                        color: "#fff",
                        fontWeight: 500,
                    }}
                >
                    {content}
                </div>
                <span style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)", padding: "0 6px" }}>{timeFormat(timestamp)}</span>
            </div>
        </div>
    );
}

function AssistantBubble({
    answer,
    timestamp,
    interactive,
    onPick,
}: {
    answer: AssistantAnswer;
    timestamp: Date;
    interactive: boolean;
    onPick: (q: string) => void;
}) {
    return (
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <AvatarGradient />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0, maxWidth: 720 }}>
                <div
                    style={{
                        padding: "14px 16px",
                        fontSize: 14,
                        lineHeight: 1.55,
                        wordBreak: "break-word",
                        borderRadius: "18px 18px 18px 4px",
                        background: "var(--eduflow-surface-card)",
                        border: "1px solid var(--eduflow-border-subtle)",
                        color: "var(--eduflow-text-primary)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                    }}
                >
                    <div>
                        <RichText text={answer.text} />
                    </div>
                    {answer.blocks.map((block, index) => (
                        <Block key={index} block={block} />
                    ))}
                    {answer.links.length ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                            {answer.links.map((link) => (
                                <Link
                                    key={`${link.href}-${link.label}`}
                                    href={link.href}
                                    className="hover:underline"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 600, color: "var(--eduflow-info-700)" }}
                                >
                                    {link.label}
                                    <Icon name="arrowRight" size={12} color="var(--eduflow-info-700)" />
                                </Link>
                            ))}
                        </div>
                    ) : null}
                </div>
                {interactive ? <SuggestionChips items={answer.suggestions} onPick={onPick} /> : null}
                <span style={{ fontSize: 12, color: "var(--eduflow-text-tertiary)", padding: "0 6px" }}>
                    {timeFormat(timestamp)}
                    {answer.meta.sources.length ? ` · d'après : ${answer.meta.sources.join(", ")}` : ""}
                </span>
            </div>
        </div>
    );
}

function AvatarGradient() {
    return (
        <div
            aria-hidden
            style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "linear-gradient(135deg, var(--brand-700), var(--brand-accent-600, #4F46E5))",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
            }}
        >
            <Icon name="sparkle" size={16} color="#fff" />
        </div>
    );
}

function TypingDot({ delay }: { delay: string }) {
    return (
        <span
            className="animate-bounce"
            style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand-400, #60A5FA)", animationDelay: delay, display: "inline-block" }}
        />
    );
}
