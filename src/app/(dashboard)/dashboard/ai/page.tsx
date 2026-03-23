"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Permission } from "@/lib/rbac/permissions";
import { Send, Bot, User, Sparkles, AlertCircle, Trash2, Square } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
};

export default function AiAssistantPage() {
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
                    setStatusHint(parts.length ? `Moteurs: ${parts.join(" · ")}` : null);
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
            // Prepare placeholder assistant message for streaming
            const assistantId = (Date.now() + 1).toString();
            setMessages((prev) => [
                ...prev,
                { id: assistantId, role: "assistant", content: "", timestamp: new Date() },
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

                // SSE framing: events lines; we only parse `data: ...`
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
                                    m.id === assistantId ? { ...m, content: m.content + String(payload.content || "") } : m
                                )
                            );
                        }
                        if (payload.type === "done") {
                            // Ensure final content is aligned
                            const final = String(payload.content || "");
                            setMessages((prev) =>
                                prev.map((m) => (m.id === assistantId ? { ...m, content: final || m.content } : m))
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
        } catch (err: any) {
            if (err?.name === "AbortError") {
                setError(null);
            } else {
                setError(err.message);
            }
        } finally {
            abortRef.current = null;
            setIsLoading(false);
        }
    };

    return (
        <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
            <div className="space-y-6 flex flex-col h-[calc(100vh-120px)] max-w-[1000px] mx-auto dashboard-motion animate-fade-in">
                <div className="flex justify-between items-center">
                    <PageHeader title="Assistant EduPilot" description="Intelligence Artificielle d'aide à la décision et au suivi pédagogique." />
                    <div className="flex items-center gap-2">
                        <div className="hidden md:flex items-center gap-1 rounded-full border border-border/70 bg-muted/35 px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                            <Sparkles className="w-3 h-3 text-primary" />
                            {messages.length} message{messages.length > 1 ? "s" : ""}
                        </div>
                        {isLoading ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive gap-2"
                                onClick={stopGeneration}
                            >
                                <Square className="w-3.5 h-3.5" />
                                Stop
                            </Button>
                        ) : null}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-[10px] font-bold uppercase text-muted-foreground hover:text-destructive gap-2"
                            onClick={() => setMessages([])}
                            disabled={isLoading}
                        >
                        <Trash2 className="w-3.5 h-3.5" />
                        Effacer Chat
                        </Button>
                    </div>
                </div>

                <Card className="dashboard-block flex-1 flex flex-col border-none shadow-none bg-muted/20 overflow-hidden rounded-2xl" data-reveal>
                    <CardContent className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 custom-scrollbar">
                        {messages.length === 0 && (
                            <div className="dashboard-panel rounded-xl border border-border/60 bg-background/50 p-4 space-y-3" data-reveal>
                                <p className="text-xs font-semibold tracking-wide text-muted-foreground">Démarrer rapidement</p>
                                <div className="flex flex-wrap gap-2">
                                    {starterPrompts.map((prompt) => (
                                        <Button
                                            key={prompt}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="max-w-full text-left h-auto whitespace-normal py-1.5"
                                            onClick={() => setInput(prompt)}
                                        >
                                            {prompt}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {messages.map((message) => (
                            <div key={message.id} className={cn("flex gap-4", message.role === "user" ? "flex-row-reverse" : "flex-row")}>
                                <div className={cn(
                                    "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border shadow-sm",
                                    message.role === "user" ? "bg-primary text-white border-primary" : "bg-background text-primary border-border/50"
                                )}>
                                    {message.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                </div>

                                <div className={cn("flex flex-col gap-1.5 max-w-[80%]", message.role === "user" ? "items-end" : "items-start")}>
                                    <div className={cn(
                                        "px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm",
                                        message.role === "user" 
                                            ? "bg-primary text-white rounded-tr-none font-medium" 
                                            : "dashboard-panel bg-background border border-border/50 rounded-tl-none text-foreground"
                                    )}>
                                        {message.content}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground px-1 font-medium opacity-70">
                                        {message.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {isLoading && (
                            <div className="flex gap-4">
                                <div className="w-8 h-8 rounded-xl bg-background border border-border/50 flex items-center justify-center shrink-0 shadow-sm">
                                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                                </div>
                                <div className="px-5 py-4 rounded-2xl bg-background border border-border/50 rounded-tl-none flex items-center gap-1.5 shadow-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0.2s]" />
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0.4s]" />
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="mx-auto max-w-md bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-bold">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </CardContent>

                    {/* Footer Area */}
                    <div className="p-4 bg-background/40 border-t border-border/50 backdrop-blur-md">
                        <form onSubmit={handleSubmit} className="relative max-w-2xl mx-auto flex items-center">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                
                                className="h-12 pr-12 pl-5 bg-background border-none ring-1 ring-border/50 shadow-lg text-sm rounded-xl focus-visible:ring-primary/30"
                                disabled={isLoading}
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={!input.trim() || isLoading}
                                className="absolute right-1.5 h-9 w-9 rounded-lg bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90"
                            >
                                <Send className="w-4 h-4" />
                            </Button>
                        </form>
                        <p className="text-[10px] text-center text-muted-foreground mt-3 font-medium flex items-center justify-center gap-1.5 tracking-tight opacity-70">
                            <Sparkles className="w-3 h-3 text-primary" />
                            {statusHint ? statusHint : "Assistant IA"}
                        </p>
                    </div>
                </Card>
            </div>
        </PageGuard>
    );
}
