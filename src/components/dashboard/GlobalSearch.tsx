"use client";

import { type ComponentType, useEffect, useMemo, useRef, useState } from "react";
import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput, 
  CommandItem, 
  CommandList,
  CommandSeparator,
  CommandShortcut
} from "@/components/ui/command";
import { Search, Users, GraduationCap, BookOpen, FileText, Settings, UserPlus, CreditCard, ShieldAlert, CalendarCheck, Bell } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useSession } from "next-auth/react";
import { t } from "@/lib/i18n";

type QuickCommand = {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  shortcut?: string;
  group: "actions" | "navigation" | "settings" | "context";
  keywords?: string[];
  contextPrefixes?: string[];
  roles?: Array<"SUPER_ADMIN" | "SCHOOL_ADMIN" | "DIRECTOR" | "TEACHER" | "ACCOUNTANT" | "PARENT" | "STUDENT">;
};

const COMMAND_USAGE_KEY = "edupilot_command_usage_v1";
type CommandUsageMap = Record<string, { count: number; lastUsedAt: number }>;

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [commandUsage, setCommandUsage] = useState<CommandUsageMap>(() => {
    if (typeof window === "undefined") return {};
    const raw = window.localStorage.getItem(COMMAND_USAGE_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const sequenceRef = useRef<{ key: string | null; timeout: number | null }>({ key: null, timeout: null });
  const userRole = session?.user?.role;

  const commands = useMemo<QuickCommand[]>(
    () => [
      {
        id: "action-new-student",
        label: t("globalSearch.commands.newStudent"),
        href: "/dashboard/students/new",
        icon: UserPlus,
        shortcut: "N",
        group: "actions",
      },
      {
        id: "action-new-payment",
        label: "Enregistrer un paiement",
        href: "/dashboard/finance/payments/new",
        icon: CreditCard,
        group: "actions",
      },
      {
        id: "nav-dashboard",
        label: "Tableau de bord",
        href: "/dashboard",
        icon: BookOpen,
        shortcut: "G D",
        group: "navigation",
      },
      {
        id: "nav-students",
        label: t("globalSearch.commands.students"),
        href: "/dashboard/students",
        icon: Users,
        shortcut: "G E",
        group: "navigation",
        keywords: ["élèves", "inscriptions", "students"],
      },
      {
        id: "nav-teachers",
        label: "Enseignants",
        href: "/dashboard/teachers",
        icon: GraduationCap,
        group: "navigation",
      },
      {
        id: "nav-classes",
        label: "Classes",
        href: "/dashboard/classes",
        icon: BookOpen,
        group: "navigation",
      },
      {
        id: "nav-grades",
        label: "Notes et bulletins",
        href: "/dashboard/grades",
        icon: FileText,
        group: "navigation",
        contextPrefixes: ["/dashboard/grades", "/dashboard/students"],
      },
      {
        id: "nav-attendance",
        label: "Feuille d'appel",
        href: "/dashboard/attendance",
        icon: CalendarCheck,
        group: "navigation",
        contextPrefixes: ["/dashboard/students", "/dashboard/attendance"],
      },
      {
        id: "nav-messages",
        label: "Messagerie",
        href: "/dashboard/messages",
        icon: FileText,
        shortcut: "G M",
        group: "navigation",
      },
      {
        id: "nav-analytics",
        label: "Analytics",
        href: "/dashboard/analytics",
        icon: FileText,
        shortcut: "G A",
        group: "navigation",
      },
      {
        id: "nav-incidents",
        label: "Incidents disciplinaires",
        href: "/dashboard/incidents",
        icon: ShieldAlert,
        shortcut: "G I",
        group: "navigation",
      },
      {
        id: "nav-notifications",
        label: "Centre de notifications",
        href: "/dashboard/notifications",
        icon: Bell,
        group: "navigation",
      },
      {
        id: "nav-settings",
        label: t("globalSearch.commands.settings"),
        href: "/dashboard/settings",
        icon: Settings,
        group: "settings",
        roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
      },
      {
        id: "ctx-entry-grades",
        label: t("globalSearch.commands.enterEvaluation"),
        href: "/dashboard/grades/entry",
        icon: FileText,
        group: "context",
        contextPrefixes: ["/dashboard/grades", "/dashboard/students"],
        roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"],
      },
      {
        id: "ctx-new-incident",
        label: t("globalSearch.commands.declareIncident"),
        href: "/dashboard/incidents/new",
        icon: ShieldAlert,
        group: "context",
        contextPrefixes: ["/dashboard/incidents", "/dashboard/students"],
        roles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"],
      },
    ],
    []
  );

  const filteredCommands = useMemo(() => {
    return commands.filter((command) => {
      if (!command.roles || command.roles.length === 0) return true;
      if (!userRole) return false;
      return command.roles.includes(userRole as any);
    });
  }, [commands, userRole]);

  const commandById = useMemo(() => {
    const map = new Map<string, QuickCommand>();
    filteredCommands.forEach((c) => map.set(c.id, c));
    return map;
  }, [filteredCommands]);

  const historyCommands = useMemo(() => {
    return Object.entries(commandUsage)
      .map(([id, usage]) => {
        const command = commandById.get(id);
        if (!command) return null;
        const pathBoost = pathname.startsWith(command.href) ? 5 : 0;
        const score = usage.count * 1_000_000 + usage.lastUsedAt + pathBoost;
        return { command, score };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.score || 0) - (a?.score || 0))
      .slice(0, 6)
      .map((item) => item?.command as QuickCommand);
  }, [commandById, commandUsage, pathname]);

  const contextualCommands = useMemo(() => {
    return filteredCommands.filter((c) =>
      c.group === "context" && (c.contextPrefixes || []).some((prefix) => pathname.startsWith(prefix))
    );
  }, [filteredCommands, pathname]);

  const pushUsage = (commandId: string) => {
    setCommandUsage((prev) => {
      const current = prev[commandId];
      const next: CommandUsageMap = {
        ...prev,
        [commandId]: {
          count: (current?.count || 0) + 1,
          lastUsedAt: Date.now(),
        },
      };
      localStorage.setItem(COMMAND_USAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const runCommand = (command: QuickCommand) => {
    setOpen(false);
    pushUsage(command.id);
    router.push(command.href);
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
        return;
      }

      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (sequenceRef.current.key === "g") {
          if (sequenceRef.current.timeout) window.clearTimeout(sequenceRef.current.timeout);
          sequenceRef.current.key = null;
          const goMap: Record<string, string> = {
            d: "/dashboard",
            e: "/dashboard/students",
            m: "/dashboard/messages",
            a: "/dashboard/analytics",
            i: "/dashboard/incidents",
          };
          if (goMap[k]) {
            e.preventDefault();
            router.push(goMap[k]);
            return;
          }
        }

        if (k === "g") {
          sequenceRef.current.key = "g";
          sequenceRef.current.timeout = window.setTimeout(() => {
            sequenceRef.current.key = null;
          }, 900);
          return;
        }

        if (k === "n") {
          const createMap: Array<{ prefix: string; href: string }> = [
            { prefix: "/dashboard/students", href: "/dashboard/students/new" },
            { prefix: "/dashboard/finance", href: "/dashboard/finance/payments/new" },
            { prefix: "/dashboard/users", href: "/dashboard/users/new" },
            { prefix: "/dashboard/classes", href: "/dashboard/classes/new" },
          ];
          const found = createMap.find((r) => pathname.startsWith(r.prefix));
          if (found) {
            e.preventDefault();
            router.push(found.href);
          }
        }
      }
    };
    document.addEventListener("keydown", down);
    return () => {
      document.removeEventListener("keydown", down);
      if (sequenceRef.current.timeout) window.clearTimeout(sequenceRef.current.timeout);
    };
  }, [pathname, router]);

  const isMac = typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac');

  return (
    <>
      <div 
        className="hidden lg:flex items-center flex-1 max-w-md relative group cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <Input
          
          className="h-8 pl-9 pr-12 bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-primary/30 text-xs transition-all w-full cursor-pointer pointer-events-none"
          readOnly
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border bg-background text-[10px] text-muted-foreground font-mono pointer-events-none">
          <span className="text-[9px]" suppressHydrationWarning>{isMac ? '⌘' : 'Ctrl'}</span>K
        </div>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>

          {historyCommands.length > 0 && (
            <>
              <CommandGroup heading={t("globalSearch.groups.recents")}>
                {historyCommands.map((command) => (
                  <CommandItem key={command.id} onSelect={() => runCommand(command)}>
                    <command.icon className="mr-2 h-4 w-4" />
                    <span>{command.label}</span>
                    {command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {contextualCommands.length > 0 && (
            <>
              <CommandGroup heading="Contexte">
                {contextualCommands.map((command) => (
                  <CommandItem key={command.id} onSelect={() => runCommand(command)}>
                    <command.icon className="mr-2 h-4 w-4" />
                    <span>{command.label}</span>
                    {command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          <CommandGroup heading="Actions Rapides">
            {filteredCommands.filter((c) => c.group === "actions").map((command) => (
              <CommandItem key={command.id} onSelect={() => runCommand(command)}>
                <command.icon className="mr-2 h-4 w-4" />
                <span>{command.label}</span>
                {command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Navigation">
            {filteredCommands.filter((c) => c.group === "navigation").map((command) => (
              <CommandItem key={command.id} onSelect={() => runCommand(command)}>
                <command.icon className="mr-2 h-4 w-4" />
                <span>{command.label}</span>
                {command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t("globalSearch.groups.settings")}>
            {filteredCommands.filter((c) => c.group === "settings").map((command) => (
              <CommandItem key={command.id} onSelect={() => runCommand(command)}>
                <command.icon className="mr-2 h-4 w-4" />
                <span>{command.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
