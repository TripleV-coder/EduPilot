import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: 'Bonjour ! Je suis EduBot. Comment puis-je vous aider aujourd\'hui ?' }
    ]);
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage = inputValue.trim();
        setInputValue("");
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        try {
            const res = await fetch('/api/ai/chatbot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: messages.slice(-5) // Send sparse history context
                }),
            });

            if (!res.ok) throw new Error("Erreur");

            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response || "Je n'ai pas compris." }]);
        } catch (_error) {
            setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, je rencontre un problème technique." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {!isOpen && (
                <Button
                    onClick={() => setIsOpen(true)}
                    className="rounded-full h-14 w-14 shadow-[0_18px_40px_rgba(30,60,140,0.55)] bg-gradient-to-br from-apogee-cobalt to-apogee-emerald"
                >
                    <MessageCircle className="h-6 w-6 text-white" />
                </Button>
            )}

            {isOpen && (
                <Card className="w-80 md:w-96 shadow-2xl animate-in slide-in-from-bottom-5">
                    <CardHeader className="bg-gradient-to-r from-apogee-cobalt to-apogee-emerald text-white rounded-t-lg p-4 flex flex-row justify-between items-center">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Bot className="h-4 w-4" /> EduPilot Assistant
                        </CardTitle>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-white hover:bg-white/15 rounded-full"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </CardHeader>

                    <CardContent className="p-0">
                        <ScrollArea className="h-80 p-4">
                            <div className="space-y-4">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`max-w-[80%] rounded-lg p-3 text-sm ${msg.role === 'user'
                                                ? 'bg-apogee-cobalt text-white rounded-br-none'
                                                : 'bg-apogee-abyss/80 border border-white/10 text-apogee-metal/90 rounded-bl-none'
                                                }`}
                                        >
                                            {msg.content}
                                        </div>
                                    </div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-apogee-abyss/80 border border-white/10 rounded-lg p-3 rounded-bl-none text-xs text-apogee-metal/70">
                                            Écriture en cours...
                                        </div>
                                    </div>
                                )}
                                <div ref={scrollRef} />
                            </div>
                        </ScrollArea>
                    </CardContent>

                    <CardFooter className="p-3 border-t border-white/10">
                        <form
                            className="flex w-full gap-2"
                            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                        >
                            <Input
                                placeholder="Posez une question..."
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={isLoading}
                                className="flex-1 text-sm"
                            />
                            <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
                                <Send className="h-4 w-4" />
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            )}
        </div>
    );
}
