"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, Bell, HelpCircle, ChevronRight, Command } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MobileSidebarTrigger } from "./sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

// ============================================
// BREADCRUMB MAPPING
// ============================================

const breadcrumbMap: Record<string, string> = {
    dashboard: "Vue d'ensemble",
    school: "École",
    students: "Élèves",
    teachers: "Enseignants",
    classes: "Classes",
    grades: "Notes",
    attendance: "Présences",
    schedule: "Emploi du temps",
    payments: "Paiements",
    messages: "Messages",
    analytics: "Statistiques",
    settings: "Paramètres",
    admin: "Administration",
    subjects: "Matières",
    new: "Nouveau",
    edit: "Modifier",
    import: "Import",
};

// ============================================
// HEADER COMPONENT
// ============================================

export function Header() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const [isMac, setIsMac] = useState(false);

    useEffect(() => {
        setIsMac(navigator.platform.toUpperCase().indexOf("MAC") >= 0);
    }, []);

    // Generate breadcrumbs from pathname
    const pathSegments = pathname.split("/").filter(Boolean);
    const breadcrumbs = pathSegments.map((segment, index) => {
        const path = "/" + pathSegments.slice(0, index + 1).join("/");
        const label = breadcrumbMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
        return { path, label };
    });

    const handleSearchClick = () => {
        // Dispatch custom event to open command palette
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: !isMac }));
    };

    return (
        <header
            className="flex items-center gap-4 px-4 lg:px-6 border-b border-border bg-card shadow-sm sticky top-0 z-30"
            style={{ height: "var(--header-height)" }}
        >
            {/* Mobile menu trigger */}
            <MobileSidebarTrigger />

            {/* Logo - Desktop (cliquable vers dashboard) */}
            <Link
                href="/dashboard"
                className="hidden lg:flex items-center gap-2 shrink-0"
            >
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                    <span className="text-sm font-bold">EP</span>
                </div>
            </Link>

            {/* Separator */}
            <div className="hidden lg:block h-6 w-px bg-border" />

            {/* Breadcrumbs - Desktop */}
            <nav className="hidden md:flex items-center gap-1 text-sm">
                <Link
                    href="/dashboard"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    Accueil
                </Link>
                {breadcrumbs.map((crumb, index) => (
                    <div key={crumb.path} className="flex items-center gap-1">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                        {index === breadcrumbs.length - 1 ? (
                            <span className="font-medium text-foreground">{crumb.label}</span>
                        ) : (
                            <Link
                                href={crumb.path}
                                className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {crumb.label}
                            </Link>
                        )}
                    </div>
                ))}
            </nav>

            {/* Spacer to push search to center */}
            <div className="flex-1" />

            {/* Search Trigger - Center */}
            <button
                onClick={handleSearchClick}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 border border-border rounded-lg hover:bg-muted hover:border-muted-foreground/30 transition-all duration-200 md:w-72 shadow-sm"
            >
                <Search className="h-4 w-4" />
                <span className="hidden md:inline flex-1 text-left">Rechercher un élève, paiement...</span>
                <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium bg-background border border-border rounded">
                    {isMac ? <Command className="h-2.5 w-2.5" /> : "Ctrl"}
                    <span>K</span>
                </kbd>
            </button>

            {/* Right Actions */}
            <div className="flex items-center gap-1">
                {/* Help */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    title="Aide"
                >
                    <HelpCircle className="h-4 w-4" />
                </Button>

                {/* Notifications */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground relative"
                        >
                            <Bell className="h-4 w-4" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80">
                        <DropdownMenuLabel className="flex items-center justify-between">
                            Notifications
                            <Button variant="ghost" size="sm" className="h-auto text-xs text-primary">
                                Tout marquer lu
                            </Button>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <div className="py-4 text-center text-sm text-muted-foreground">
                            Aucune notification
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Separator */}
                <div className="h-6 w-px bg-border mx-1" />

                {/* Profile */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            className="h-9 gap-2 px-2 hover:bg-muted"
                        >
                            <Avatar className="h-7 w-7">
                                <AvatarImage src={session?.user?.image || ""} />
                                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                    {(session?.user?.firstName?.[0] || "") + (session?.user?.lastName?.[0] || "U")}
                                </AvatarFallback>
                            </Avatar>
                            <div className="hidden lg:flex flex-col items-start text-xs">
                                <span className="font-medium">
                                    {session?.user?.firstName || "Utilisateur"}
                                </span>
                                <span className="text-muted-foreground text-[10px]">
                                    {session?.user?.role || "Invité"}
                                </span>
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild>
                            <Link href="/settings">Paramètres</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link href="/settings?tab=security">Sécurité</Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                            Déconnexion
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
