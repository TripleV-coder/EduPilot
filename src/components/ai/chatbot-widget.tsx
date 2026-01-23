"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    MessageCircle, X, Send, Loader2, Bot, Sparkles,
    Minimize2, Maximize2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
}

export function ChatbotWidget() {
    const { data: session } = useSession();
    const [isOpen, setIsOpen] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "assistant",
            content: "Bonjour ! 👋 Je suis votre assistant EduPilot. Comment puis-je vous aider aujourd'hui ?",
            timestamp: new Date(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            role: "user",
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        try {
            const res = await fetch("/api/ai/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: userMessage.content,
                    userId: session?.user?.id || "anonymous",
                    userRole: session?.user?.role || "GUEST",
                }),
            });

            const data = await res.json();

            const assistantMessage: Message = {
                id: (Date.now() + 1).toString(),
                role: "assistant",
                content: data.response || data.message || "Désolé, je n'ai pas pu répondre.",
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch {
            setMessages(prev => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    role: "assistant",
                    content: "Une erreur s'est produite. Veuillez réessayer.",
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    // Chatbot is always visible, but requires login to use

    return (
        <>
            {/* Floating Button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-apogee-cobalt to-apogee-emerald rounded-full shadow-[0_18px_40px_rgba(30,60,140,0.55)] flex items-center justify-center text-white z-50"
                    >
                        <MessageCircle className="w-6 h-6" />
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-apogee-emerald rounded-full animate-pulse" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.8 }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1,
                            height: isMinimized ? "auto" : 500,
                        }}
                        exit={{ opacity: 0, y: 100, scale: 0.8 }}
                        className={cn(
                            "fixed bottom-6 right-6 w-96 bg-apogee-abyss/90 border border-white/10 rounded-2xl shadow-[0_30px_80px_rgba(4,8,18,0.7)] z-50 overflow-hidden flex flex-col backdrop-blur-2xl",
                            isMinimized && "h-auto"
                        )}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-apogee-cobalt to-apogee-emerald p-4 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                                    <Bot className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold">Assistant EduPilot</h3>
                                    <p className="text-xs opacity-80 flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" /> Propulsé par IA
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-white hover:bg-white/15 h-8 w-8"
                                    onClick={() => setIsMinimized(!isMinimized)}
                                >
                                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="text-white hover:bg-white/15 h-8 w-8"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Messages */}
                        {!isMinimized && (
                            <>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-apogee-abyss/60">
                                    {messages.map((message) => (
                                        <motion.div
                                            key={message.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={cn(
                                                "flex",
                                                message.role === "user" ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "max-w-[80%] px-4 py-2 rounded-2xl text-sm",
                                                    message.role === "user"
                                                        ? "bg-apogee-cobalt text-white rounded-br-sm"
                                                        : "bg-apogee-abyss/80 border border-white/10 text-apogee-metal/90 rounded-bl-sm"
                                                )}
                                            >
                                                {message.content}
                                            </div>
                                        </motion.div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex justify-start">
                                            <div className="bg-apogee-abyss/80 border border-white/10 px-4 py-3 rounded-2xl rounded-bl-sm">
                                                <div className="flex gap-1">
                                                    <span className="w-2 h-2 bg-apogee-cobalt rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                                    <span className="w-2 h-2 bg-apogee-cobalt rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                                    <span className="w-2 h-2 bg-apogee-cobalt rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Input */}
                                <form onSubmit={sendMessage} className="p-4 border-t border-white/10 bg-apogee-abyss/80">
                                    <div className="flex gap-2">
                                        <Input
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            placeholder="Posez votre question..."
                                            disabled={isLoading}
                                            className="flex-1"
                                        />
                                        <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                                            {isLoading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Send className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
