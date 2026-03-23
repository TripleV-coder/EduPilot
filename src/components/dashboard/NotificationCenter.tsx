"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Bell, AlertCircle, GraduationCap, DollarSign, ShieldAlert, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useNotificationStream } from "@/lib/socket";
import {
  NOTIFICATION_FILTERS,
  formatNotificationRelativeTime,
  toNotificationUiType,
  type NotificationUiType,
} from "@/lib/notifications/ui";

interface Notification {
  id: string;
  type: NotificationUiType;
  title: string;
  description: string;
  entityName?: string;
  entityLink?: string;
  timestamp: string;
  isRead: boolean;
  isGlobal?: boolean;
}

const typeConfigs = {
  critical: { icon: ShieldAlert, color: "text-destructive", bg: "bg-destructive/10" },
  academic: { icon: GraduationCap, color: "text-[hsl(var(--info))]", bg: "bg-[hsl(var(--info-bg))]" },
  finance: { icon: DollarSign, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning-bg))]" },
  discipline: { icon: AlertCircle, color: "text-[hsl(var(--warning))]", bg: "bg-[hsl(var(--warning-bg))]" },
  success: { icon: CheckCircle2, color: "text-[hsl(var(--success))]", bg: "bg-[hsl(var(--success-bg))]" },
  info: { icon: Bell, color: "text-primary", bg: "bg-primary/10" },
};

type ApiNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  createdAt: string;
  isGlobal?: boolean;
};

const mapApiToNotification = (n: ApiNotification): Notification => ({
  id: n.id,
  type: toNotificationUiType(n.type),
  title: n.title,
  description: n.message,
  entityName: n.link ? "Ouvrir" : undefined,
  entityLink: n.link || undefined,
  timestamp: formatNotificationRelativeTime(n.createdAt),
  isRead: !!n.isRead,
  isGlobal: n.isGlobal,
});

export function NotificationCenter() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | NotificationUiType>("all");
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleIncomingNotifications = useCallback((items: Array<{ id: string; type: string; title: string; message: string; link?: string | null; isRead: boolean; createdAt: string }>) => {
    if (!items?.length) return;
    setNotifications((prev) => {
      const mapped = items.map(mapApiToNotification);
      const ids = new Set(prev.map((n) => n.id));
      const deduped = mapped.filter((n) => !ids.has(n.id));
      return [...deduped, ...prev].slice(0, 120);
    });
  }, []);

  const { isConnected } = useNotificationStream({
    enabled: !!session?.user?.id,
    onNotification: handleIncomingNotifications,
  });

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      const list: ApiNotification[] = Array.isArray(data?.notifications) ? data.notifications : [];
      setNotifications(list.map(mapApiToNotification));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetchNotifications();
  }, [fetchNotifications, session?.user?.id]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = useMemo(() => notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "critical") return n.type === "critical";
    return n.type === filter;
  }), [filter, notifications]);

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    await fetch("/api/notifications", { method: "PATCH", credentials: "include" }).catch(() => null);
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    await fetch(`/api/notifications/${id}`, { method: "PATCH", credentials: "include" }).catch(() => null);
  };

  return (
    <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-background" />
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col h-full bg-card border-l border-border/50">
        <SheetHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
          <SheetTitle className="text-sm font-semibold tracking-wide text-foreground flex items-center gap-2">
            Centre de Notifications
            <span className={cn("inline-flex h-2 w-2 rounded-full", isConnected ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--warning))]")} />
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-bold">
                {unreadCount}
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Filtres */}
        <div className="flex items-center gap-1.5 p-2 overflow-x-auto border-b border-border/50 bg-muted/20 custom-scrollbar text-xs">
          {NOTIFICATION_FILTERS.map((f) => {
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-tight transition-all border whitespace-nowrap",
                  filter === f.id 
                    ? "bg-primary text-primary-foreground border-primary" 
                    : "bg-background text-muted-foreground border-border hover:border-primary/30"
                )}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Liste */}
        <div className="flex-1 overflow-y-auto custom-scrollbar font-sans">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Bell className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-xs font-medium text-muted-foreground">Aucune notification à afficher.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredNotifications.map((n) => {
                const config = typeConfigs[n.type] || typeConfigs.info;
                return (
                  <div 
                    key={n.id} 
                    onClick={() => {
                      if (!n.isRead) markAsRead(n.id);
                    }}
                    className={cn(
                      "p-4 transition-colors relative group cursor-pointer",
                      !n.isRead ? "bg-primary/5 shadow-[inset_2px_0_0_0_theme(colors.primary.DEFAULT)]" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex gap-3">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", config.bg)}>
                        <config.icon className={cn("w-4 h-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2">
                          <p className={cn("text-xs font-bold leading-tight", !n.isRead ? "text-foreground" : "text-muted-foreground")}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {n.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          {n.description}
                        </p>
                        {n.entityName && (
                          <div className="mt-2 flex items-center gap-2">
                             <Link 
                              href={n.entityLink || "#"} 
                              className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              {n.entityName}
                            </Link>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions bas */}
        {unreadCount > 0 && (
          <div className="p-3 border-t border-border/50 bg-muted/20">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full h-8 text-[11px] font-semibold tracking-tight"
              onClick={markAllRead}
            >
              Tout marquer comme lu
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
