"use client";

import * as React from "react";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { 
  Search, 
  Home, 
  Users, 
  GraduationCap, 
  Receipt, 
  Calendar, 
  BarChart3, 
  Settings,
  Bell,
  FileText,
  LogOut,
  ChevronRight,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  X
} from "lucide-react";

interface CommandItem {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
  shortcut?: string[];
  href?: string;
  action?: () => void;
  category: "Navigation" | "Action" | "Document";
}

const commands: CommandItem[] = [
  {
    id: "home",
    label: "Tableau de bord",
    subtitle: "Vue d'ensemble",
    icon: <Home className="h-4 w-4" />,
    href: "/dashboard",
    category: "Navigation",
    shortcut: ["⌘", "D"],
  },
  {
    id: "students",
    label: "Élèves",
    subtitle: "Gestion des élèves",
    icon: <Users className="h-4 w-4" />,
    href: "/dashboard/students",
    category: "Navigation",
    shortcut: ["⌘", "E"],
  },
  {
    id: "classes",
    label: "Classes",
    subtitle: "Gestion des classes",
    icon: <GraduationCap className="h-4 w-4" />,
    href: "/dashboard/classes",
    category: "Navigation",
  },
  {
    id: "finance",
    label: "Finances",
    subtitle: "Paiements & factures",
    icon: <Receipt className="h-4 w-4" />,
    href: "/dashboard/finance",
    category: "Navigation",
  },
  {
    id: "schedule",
    label: "Planning",
    subtitle: "Emplois du temps",
    icon: <Calendar className="h-4 w-4" />,
    href: "/dashboard/schedule",
    category: "Navigation",
  },
  {
    id: "analytics",
    label: "Analytics",
    subtitle: "Statistiques & rapports",
    icon: <BarChart3 className="h-4 w-4" />,
    href: "/dashboard/analytics",
    category: "Navigation",
  },
  {
    id: "settings",
    label: "Paramètres",
    subtitle: "Configuration",
    icon: <Settings className="h-4 w-4" />,
    href: "/dashboard/settings",
    category: "Navigation",
    shortcut: ["⌘", ","],
  },
  {
    id: "notifications",
    label: "Notifications",
    subtitle: "3 non lues",
    icon: <Bell className="h-4 w-4" />,
    href: "/dashboard/notifications",
    category: "Navigation",
  },
  {
    id: "reports",
    label: "Rapports",
    subtitle: "Documents officiels",
    icon: <FileText className="h-4 w-4" />,
    href: "/dashboard/reports",
    category: "Document",
  },
  {
    id: "logout",
    label: "Déconnexion",
    subtitle: "Quitter la session",
    icon: <LogOut className="h-4 w-4" />,
    action: () => console.log("Logout"),
    category: "Action",
  },
];

export function SwissCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Filter commands based on query
  const filtered = commands.filter((cmd) => {
    const search = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(search) ||
      cmd.subtitle?.toLowerCase().includes(search) ||
      cmd.category.toLowerCase().includes(search)
    );
  });

  // Group by category
  const grouped = filtered.reduce((acc, item) => {
    const cat = item.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  const execute = useCallback((item: CommandItem) => {
    if (item.action) {
      item.action();
    } else if (item.href) {
      window.location.href = item.href;
    }
    setOpen(false);
  }, []);

  const openPalette = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          openPalette();
        }
      }
      // Escape to close
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
      // Navigation
      if (open) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setActiveIndex((i) => Math.max(i - 1, 0));
        }
        if (e.key === "Enter" && filtered[activeIndex]) {
          e.preventDefault();
          execute(filtered[activeIndex]);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, activeIndex, filtered, execute, openPalette]);

  if (!open) {
    return (
      <button
        onClick={openPalette}
        className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-[hsl(var(--surface-base))] border border-border rounded-sm text-[13px] text-text-secondary hover:text-text-primary hover:border-[hsl(var(--primary)/0.45)] transition-colors"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Rechercher...</span>
        <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-muted text-text-secondary rounded-sm">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[hsl(var(--foreground)/0.24)] backdrop-blur-[2px]"
        onClick={() => setOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-[640px] bg-[hsl(var(--surface-base))] border border-border rounded-sm shadow-xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="h-4 w-4 text-text-secondary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Rechercher une commande..."
            className="flex-1 bg-transparent text-[15px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded-sm hover:bg-muted text-text-secondary transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-[13px] text-text-secondary">
                Aucun résultat pour &quot;{query}&quot;
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category} className="mb-2">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                  {category}
                </div>
                <div className="space-y-0.5">
                  {items.map((item, idx) => {
                    const globalIndex = filtered.findIndex((f) => f.id === item.id);
                    const isActive = globalIndex === activeIndex;

                    return (
                      <button
                        key={item.id}
                        onClick={() => execute(item)}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-sm text-left transition-colors",
                          isActive
                            ? "bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]"
                            : "text-text-primary hover:bg-muted"
                        )}
                      >
                        <div
                          className={cn(
                            "p-1.5 rounded-sm",
                            isActive ? "bg-[hsl(var(--sidebar-hover))] text-[hsl(var(--sidebar-fg))]" : "bg-muted text-text-secondary"
                          )}
                        >
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            {item.label}
                          </div>
                          {item.subtitle && (
                            <div
                              className={cn(
                                "text-[11px] truncate",
                                isActive ? "text-[hsl(var(--sidebar-muted))]" : "text-text-secondary"
                              )}
                            >
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                        {item.shortcut && (
                          <div className="flex items-center gap-1">
                            {item.shortcut.map((key, i) => (
                              <kbd
                                key={i}
                                className={cn(
                                  "px-1.5 py-0.5 text-[10px] font-medium rounded-sm",
                                  isActive
                                    ? "bg-[hsl(var(--sidebar-hover))] text-[hsl(var(--sidebar-fg))]"
                                    : "bg-muted text-text-secondary"
                                )}
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        )}
                        <ChevronRight
                          className={cn(
                            "h-4 w-4",
                            isActive ? "text-[hsl(var(--sidebar-muted))]" : "text-text-tertiary"
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/40">
          <div className="flex items-center gap-4 text-[11px] text-text-secondary">
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> sélectionner
            </span>
            <span className="flex items-center gap-1">
              <ArrowUp className="h-3 w-3" />
              <ArrowDown className="h-3 w-3" /> naviguer
            </span>
            <span className="flex items-center gap-1">
              <span className="px-1 bg-muted rounded text-[10px]">ESC</span> fermer
            </span>
          </div>
          <div className="text-[11px] text-text-tertiary">
            {filtered.length} commande{filtered.length > 1 ? "s" : ""}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SwissCommandPalette;
