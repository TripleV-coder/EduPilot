"use client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Plus, Loader2 } from "lucide-react";
import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function MessagesPage() {
    const [recipientId, setRecipientId] = useState<string | null>(null);
    const [newMessage, setNewMessage] = useState("");
    const scrollRef = useRef<HTMLDivElement>(null);
    const queryClient = useQueryClient();

    // 1. Fetch Conversations (Inbox)
    const { data: inboxData, isLoading: loadingInbox } = useQuery({
        queryKey: ["messages", "inbox"],
        queryFn: async () => {
            const res = await fetch("/api/messages?type=inbox");
            if (!res.ok) throw new Error("Failed to load inbox");
            return res.json();
        }
    });

    // 2. Fetch Sent to simulate conversation (Basic approach)
    // In a real app, we would group by conversation/thread. Here we simplify by listing messages.
    // For this demo, let's assume the API returns a flat list and we group client-side or similar.
    // Actually, the API returns messages. We'll use the inbox list as "contacts".

    // Send Mutation
    const sendMutation = useMutation({
        mutationFn: async (payload: { recipientId: string, subject: string, content: string }) => {
            const res = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error("Erreur envoi");
            return res.json();
        },
        onSuccess: () => {
            setNewMessage("");
            queryClient.invalidateQueries({ queryKey: ["messages"] });
            toast.success("Message envoyé");
        },
        onError: () => toast.error("Échec de l'envoi")
    });

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !recipientId) return;

        // Hardcoded subject for chat-like experience
        sendMutation.mutate({
            recipientId,
            subject: "Message Direct",
            content: newMessage
        });
    };

    const messages = inboxData?.messages || [];

    // Distinct contacts (Mock grouped by sender for UI)
    // Real implementation would need a specific 'conversations' endpoint.
    // We will display just the list of received messages for now to show functionality.

    return (
        <div className="h-[calc(100vh-120px)] flex gap-4">
            {/* Sidebar Contact List */}
            <Card className="w-80 flex flex-col" variant="glass">
                <div className="p-4 border-b space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="font-bold text-xl">Boîte de Réception</h2>
                        <Button size="icon" variant="ghost"><Plus className="h-5 w-5" /></Button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Rechercher..." className="pl-8 bg-muted/50" />
                    </div>
                </div>
                <ScrollArea className="flex-1">
                    <div className="p-2 space-y-2">
                        {loadingInbox ? (
                            <div className="flex justify-center p-4"><Loader2 className="animate-spin h-5 w-5" /></div>
                        ) : messages.length === 0 ? (
                            <div className="text-center text-muted-foreground p-4 text-sm">Aucun message reçu</div>
                        ) : (
                            messages.map((msg: any) => (
                                <button
                                    key={msg.id}
                                    onClick={() => setRecipientId(msg.sender.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                                        recipientId === msg.sender.id ? "bg-primary/10" : "hover:bg-muted/50"
                                    )}
                                >
                                    <Avatar>
                                        <AvatarFallback className="bg-primary text-primary-foreground">
                                            {msg.sender.firstName[0]}{msg.sender.lastName[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium truncate">{msg.sender.firstName} {msg.sender.lastName}</span>
                                            <span className="text-xs text-muted-foreground">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate">{msg.subject}</p>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </Card>

            {/* Main Chat Area */}
            <Card className="flex-1 flex flex-col overflow-hidden" variant="glass">
                {recipientId ? (
                    <>
                        {/* Chat Header */}
                        <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarFallback>U</AvatarFallback>
                                </Avatar>
                                <div>
                                    <h3 className="font-bold">Conversation</h3>
                                    <p className="text-xs text-muted-foreground">En ligne</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages List - Mixed Sent/Received in real app, here checking filtering */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                            {messages.filter((m: any) => m.sender.id === recipientId).map((msg: any) => (
                                <div key={msg.id} className="flex flex-col gap-1 items-start">
                                    <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-none text-sm max-w-[80%]">
                                        {msg.content}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground ml-2">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                                </div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
                            <form onSubmit={handleSend} className="flex gap-2">
                                <Input
                                    placeholder="Répondre..."
                                    className="flex-1"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    disabled={sendMutation.isPending}
                                />
                                <Button type="submit" size="icon" className="shrink-0" disabled={sendMutation.isPending}>
                                    {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-4">
                        <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center">
                            <Send className="h-8 w-8 opacity-50" />
                        </div>
                        <p>Sélectionnez une conversation pour commencer</p>
                    </div>
                )}
            </Card>
        </div>
    );
}
