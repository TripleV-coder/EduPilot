"use client";

import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PageGuard } from "@/components/guard/page-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Permission } from "@/lib/rbac/permissions";
import {
  MessageSquare, Send, Inbox, Search,
  Loader2, AlertCircle, ChevronLeft, Reply, Users
} from "lucide-react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { PageCallout } from "@/components/layout/page-callout";
import { useNotificationStream } from "@/lib/socket";
import { formatUserRoleLabel } from "@/lib/utils/role-label";
import { t } from "@/lib/i18n";

type Message = {
  id: string;
  subject: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  sender: { id: string; firstName: string; lastName: string; role: string };
  recipient: { id: string; firstName: string; lastName: string; role: string };
};

type UserSearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

type ClassOption = {
  id: string;
  name: string;
  classLevel?: { name: string };
};

const FLOW_TRANSITION = { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const };

export default function MessagesPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"inbox" | "sent">("inbox");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshLockRef = useRef<number>(0);

  // Read View State
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  // Compose View State
  const [isComposing, setIsComposing] = useState(false);
  const [composeMode, setComposeMode] = useState<"individual" | "broadcast">("individual");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recipient, setRecipient] = useState<UserSearchResult | null>(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  // Fetch classes for broadcast
  const { data: classesData } = useSWR<any>(
    isComposing && composeMode === "broadcast" ? "/api/classes?limit=200" : null,
    fetcher
  );
  const classes: ClassOption[] = classesData?.data || classesData?.classes || (Array.isArray(classesData) ? classesData : []);

  const canBroadcast = session?.user?.role && ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(session.user.role);

  const fetchMessages = async (tab: "inbox" | "sent") => {
    setLoading(true);
    setError(null);
    setSelectedMessage(null);
    try {
      const res = await fetch(`/api/messages?type=${tab}&limit=50`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      } else {
        throw new Error("Impossible de charger les messages");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages(activeTab);
  }, [activeTab]);

  // Instantané : refresh quand une notification MESSAGE arrive
  useNotificationStream({
    enabled: !!session?.user?.id,
    onNotification: (items) => {
      const hasMessage = items.some((n) => n.type === "MESSAGE");
      if (!hasMessage) return;

      const now = Date.now();
      // anti-spam refresh (max 1 refresh / 2s)
      if (now - refreshLockRef.current < 2000) return;
      refreshLockRef.current = now;

      // Rafraîchit uniquement l'inbox (les notifications sont pour le destinataire)
      if (activeTab === "inbox" && !isComposing) {
        fetchMessages("inbox");
      }
    },
  });

  // Handle user search debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.length >= 2 && !recipient) {
        setIsSearching(true);
        try {
          const res = await fetch(`/api/users?search=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data.data || []);
          }
        } catch {
          // Search failed silently
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, recipient]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim()) return;

    setSending(true);
    setError(null);

    try {
      if (composeMode === "broadcast") {
        if (!selectedClassId) return;
        const res = await fetch("/api/messages/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId: selectedClassId, subject, content }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erreur d'envoi groupé");
        }

        const data = await res.json();
        setError(null);
        // Show success inline
        resetCompose();
        if (activeTab === "sent") {
          fetchMessages("sent");
        } else {
          setActiveTab("sent");
        }
        return;
      }

      // Individual send
      if (!recipient) return;
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: recipient.id, subject, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur d'envoi");
      }

      resetCompose();
      if (activeTab === "sent") {
        fetchMessages("sent");
      } else {
        setActiveTab("sent");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const resetCompose = () => {
    setIsComposing(false);
    setComposeMode("individual");
    setRecipient(null);
    setSearchQuery("");
    setSelectedClassId("");
    setSubject("");
    setContent("");
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Impossible de marquer le message comme lu");
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, isRead: true } : message
        )
      );
      setSelectedMessage((current) =>
        current && current.id === id ? { ...current, isRead: true } : current
      );
    } catch (err: any) {
      setError(err.message || "Erreur lors de la mise à jour du message");
    }
  };

  const displayRole = (role: string) => formatUserRoleLabel(role);

  return (
    <PageGuard permission={Permission.SCHOOL_READ} roles={["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT"]}>
      <div className="space-y-6 max-w-6xl mx-auto pb-12 dashboard-motion">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <PageHeader
            title="Messagerie"
            description="Échangez directement avec le personnel, les élèves et les parents."
            breadcrumbs={[
              { label: "Tableau de bord", href: "/dashboard" },
              { label: "Messages" },
            ]}
          />
          {!isComposing && (
            <Button onClick={() => { setIsComposing(true); setSelectedMessage(null); }} className="gap-2 shadow-sm shrink-0 touch-target">
              <Send className="h-4 w-4" />
              {t("common.newMessage")}
            </Button>
          )}
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-[hsl(var(--error-bg))] border border-[hsl(var(--error-border))] text-destructive flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6" data-reveal>
          {/* Sidebar / Folders */}
          <div className="space-y-2 md:col-span-1">
            <button
              onClick={() => { setActiveTab("inbox"); setIsComposing(false); setSelectedMessage(null); }}
              className={`touch-target w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'inbox' && !isComposing ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card/85 text-foreground hover:bg-muted/70 border border-border/60'}`}
            >
              <Inbox className="w-5 h-5" />
              Boîte de réception
            </button>
            <button
              onClick={() => { setActiveTab("sent"); setIsComposing(false); setSelectedMessage(null); }}
              className={`touch-target w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === 'sent' && !isComposing ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card/85 text-foreground hover:bg-muted/70 border border-border/60'}`}
            >
              <Send className="w-5 h-5" />
              Messages Envoyés
            </button>
          </div>

          {/* Main Content Area */}
          <Card className="dashboard-block md:col-span-3 border-border shadow-sm min-h-[500px]" data-reveal>
            <AnimatePresence mode="wait">
            {isComposing ? (
              <motion.div
                key="compose"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={FLOW_TRANSITION}
                className="p-6 flex flex-col h-full"
              >
                <div className="flex items-center gap-3 mb-6 pb-4 border-b">
                  <Button variant="ghost" size="icon" onClick={resetCompose}>
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <h3 className="text-lg font-semibold">{t("common.newMessage")}</h3>
                </div>

                {/* Mode toggle: Individual vs Broadcast */}
                {canBroadcast && (
                  <div className="dashboard-panel flex items-center gap-2 mb-5 w-fit rounded-full border border-border/70 bg-muted/35 p-1">
                    <button
                      type="button"
                      onClick={() => { setComposeMode("individual"); setSelectedClassId(""); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        composeMode === "individual"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-transparent text-muted-foreground hover:bg-card/80 border border-transparent"
                      }`}
                    >
                      <Send className="h-3 w-3 inline mr-1.5" />
                      Individuel
                    </button>
                    <button
                      type="button"
                      onClick={() => { setComposeMode("broadcast"); setRecipient(null); setSearchQuery(""); }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        composeMode === "broadcast"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-transparent text-muted-foreground hover:bg-card/80 border border-transparent"
                      }`}
                    >
                      <Users className="h-3 w-3 inline mr-1.5" />
                      Envoyer à une classe
                    </button>
                  </div>
                )}

                <form onSubmit={handleSend} className="space-y-5 flex-1 flex flex-col">
                  {composeMode === "individual" ? (
                    <div className="space-y-2 relative">
                      <Label>Destinataire</Label>
                      {recipient ? (
                        <div className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                              {recipient.firstName[0]}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{recipient.firstName} {recipient.lastName}</p>
                              <p className="text-xs text-muted-foreground">{displayRole(recipient.role)}</p>
                            </div>
                          </div>
                          <Button type="button" variant="ghost" size="sm" onClick={() => { setRecipient(null); setSearchQuery(""); }}>
                            Changer
                          </Button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                          <Input
                            
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9"
                            disabled={isSearching}
                          />
                          {isSearching && (
                            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      )}

                      {/* Dropdown Results */}
                      {searchResults.length > 0 && !recipient && (
                        <div className="absolute z-10 w-full mt-1 bg-card/95 border border-border/70 rounded-md shadow-lg max-h-60 overflow-y-auto backdrop-blur-sm">
                          {searchResults.map(user => (
                            <button
                              key={user.id}
                              type="button"
                              className="w-full text-left px-4 py-3 hover:bg-muted/70 border-b border-border/60 last:border-0 flex justify-between items-center transition-colors"
                              onClick={() => {
                                setRecipient(user);
                                setSearchResults([]);
                                setSearchQuery(`${user.firstName} ${user.lastName}`);
                              }}
                            >
                              <span className="font-medium text-sm">{user.firstName} {user.lastName}</span>
                              <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">{displayRole(user.role)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && !recipient && (
                        <div className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg p-4 text-sm text-center text-muted-foreground">
                          Aucun utilisateur trouvé.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>Classe destinataire</Label>
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        required
                      >
                        <option value="">Sélectionner une classe...</option>
                        {classes.map(cls => (
                          <option key={cls.id} value={cls.id}>
                            {cls.classLevel?.name ? `${cls.classLevel.name} - ` : ""}{cls.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground">
                        Le message sera envoyé à tous les parents des élèves inscrits dans cette classe.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Sujet</Label>
                    <Input
                      value={subject}
                      onChange={e => setSubject(e.target.value)}
                      
                      required
                    />
                  </div>

                  <div className="space-y-2 flex-1 flex flex-col">
                    <Label>Message</Label>
                    <Textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      
                      className="flex-1 min-h-[200px] resize-none"
                      required
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={
                        sending ||
                        !subject ||
                        !content ||
                        (composeMode === "individual" && !recipient) ||
                        (composeMode === "broadcast" && !selectedClassId)
                      }
                      className="gap-2 action-critical touch-target"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : composeMode === "broadcast" ? <Users className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                      {composeMode === "broadcast" ? "Envoyer à la classe" : "Envoyer"}
                    </Button>
                  </div>
                </form>
              </motion.div>
            ) : selectedMessage ? (
              <motion.div
                key={`detail-${selectedMessage.id}`}
                initial={{ opacity: 0, x: 14 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={FLOW_TRANSITION}
                className="p-0 flex flex-col h-full"
              >
                {/* Message Header */}
                <div className="p-6 border-b bg-muted/10">
                  <div className="flex items-center gap-3 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedMessage(null)} className="h-8 w-8 -ml-2">
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <span className="text-sm font-medium text-muted-foreground">Retour à la liste</span>
                  </div>

                  <h2 className="text-2xl font-bold text-foreground mb-4">{selectedMessage.subject}</h2>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex justify-center items-center font-bold text-lg">
                        {activeTab === 'inbox' ? selectedMessage.sender.firstName[0] : selectedMessage.recipient.firstName[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">
                          {activeTab === 'inbox'
                            ? `${selectedMessage.sender.firstName} ${selectedMessage.sender.lastName}`
                            : `À: ${selectedMessage.recipient.firstName} ${selectedMessage.recipient.lastName}`
                          }
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          {activeTab === 'inbox' ? displayRole(selectedMessage.sender.role) : displayRole(selectedMessage.recipient.role)}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(selectedMessage.createdAt).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" })}
                    </div>
                  </div>
                </div>

                {/* Message Body */}
                <div className="p-6 flex-1 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {selectedMessage.content}
                </div>

                {/* Message Actions */}
                {activeTab === "inbox" && (
                  <div className="p-6 border-t bg-muted/5">
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        setIsComposing(true);
                        setComposeMode("individual");
                        setRecipient(selectedMessage.sender as UserSearchResult);
                        setSubject(`Re: ${selectedMessage.subject}`);
                        setContent("");
                      }}
                    >
                      <Reply className="w-4 h-4" /> Répondre
                    </Button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={`list-${activeTab}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="p-0"
              >
                {loading ? (
                  <div className="p-6 space-y-3">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div key={idx} className="h-14 rounded-lg bg-muted/40 skeleton-shimmer" />
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="p-6">
                    <PageCallout
                      icon={MessageSquare}
                      title="Aucun message"
                      description={
                        activeTab === "inbox"
                          ? "Votre boîte de réception est vide. Vous recevrez ici les messages de l’équipe pédagogique et de l’administration."
                          : "Aucun message envoyé pour le moment. Rédigez un message pour contacter un membre du personnel, un parent ou un élève."
                      }
                      actions={[{ label: "Rédiger un message", href: "/dashboard/messages", variant: "outline" }]}
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        layout
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16 }}
                        onClick={() => {
                          setSelectedMessage(msg);
                          if (!msg.isRead && activeTab === "inbox") {
                            handleMarkAsRead(msg.id);
                          }
                        }}
                        className={`p-4 hover:bg-muted/45 cursor-pointer transition-all duration-200 flex items-center gap-4 ${!msg.isRead && activeTab === 'inbox' ? 'bg-primary/5' : ''}`}
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${!msg.isRead && activeTab === 'inbox' ? 'bg-primary' : 'bg-transparent'}`} />

                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className={`text-sm truncate pr-4 ${!msg.isRead && activeTab === 'inbox' ? 'font-bold text-foreground' : 'font-semibold text-foreground/80'}`}>
                              {activeTab === 'inbox'
                                ? `${msg.sender.firstName} ${msg.sender.lastName}`
                                : `À: ${msg.recipient.firstName} ${msg.recipient.lastName}`
                              }
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {new Date(msg.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                            </span>
                          </div>
                          <p className={`text-sm truncate mb-1 ${!msg.isRead && activeTab === 'inbox' ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                            {msg.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate line-clamp-1">
                            {msg.content}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </Card>
        </div>
      </div>
    </PageGuard>
  );
}
