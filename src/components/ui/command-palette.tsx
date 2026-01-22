"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
    LayoutDashboard,
    Users,
    GraduationCap,
    BookOpen,
    FileText,
    CheckSquare,
    Calendar,
    CreditCard,
    MessageSquare,
    BarChart3,
    Settings,
    ShieldAlert,
    Search,
    ArrowRight,
    Plus,
    Clock,
} from "lucide-react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// ============================================
// TYPES
// ============================================

interface CommandItem {
    id: string;
    label: string;
    description?: string;
    icon: React.ReactNode;
    action: () => void;
    keywords?: string[];
}

interface CommandGroup {
    heading: string;
    items: CommandItem[];
}

// ============================================
// COMMAND PALETTE COMPONENT
// ============================================

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const router = useRouter();
    const [recentPaths, setRecentPaths] = useState<string[]>([]);

    // Load recent paths from localStorage
    useEffect(() => {
        const stored = localStorage.getItem("edupilot-recent-paths");
        if (stored) {
            try {
                setRecentPaths(JSON.parse(stored).slice(0, 5));
            } catch { }
        }
    }, [open]);

    // Track current path as recent
    const navigate = useCallback((path: string) => {
        const recent = JSON.parse(localStorage.getItem("edupilot-recent-paths") || "[]");
        const updated = [path, ...recent.filter((p: string) => p !== path)].slice(0, 10);
        localStorage.setItem("edupilot-recent-paths", JSON.stringify(updated));
        router.push(path);
        setOpen(false);
    }, [router]);

    // Keyboard shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Command groups
    const navigationItems: CommandGroup = {
        heading: "Navigation",
        items: [
            { id: "dashboard", label: "Vue d'ensemble", icon: <LayoutDashboard className="h-4 w-4" />, action: () => navigate("/dashboard"), keywords: ["accueil", "home"] },
            { id: "students", label: "Élèves", icon: <Users className="h-4 w-4" />, action: () => navigate("/school/students"), keywords: ["étudiants", "inscription"] },
            { id: "teachers", label: "Enseignants", icon: <GraduationCap className="h-4 w-4" />, action: () => navigate("/school/teachers"), keywords: ["professeurs", "profs"] },
            { id: "classes", label: "Classes", icon: <BookOpen className="h-4 w-4" />, action: () => navigate("/school/classes"), keywords: ["cours", "groupes"] },
            { id: "grades", label: "Notes", icon: <FileText className="h-4 w-4" />, action: () => navigate("/grades"), keywords: ["résultats", "bulletins"] },
            { id: "attendance", label: "Présences", icon: <CheckSquare className="h-4 w-4" />, action: () => navigate("/attendance"), keywords: ["absences", "retards"] },
            { id: "schedule", label: "Emploi du temps", icon: <Calendar className="h-4 w-4" />, action: () => navigate("/schedule"), keywords: ["planning", "horaires"] },
            { id: "payments", label: "Paiements", icon: <CreditCard className="h-4 w-4" />, action: () => navigate("/payments"), keywords: ["finances", "scolarité"] },
            { id: "messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" />, action: () => navigate("/messages"), keywords: ["communication", "sms"] },
            { id: "analytics", label: "Statistiques", icon: <BarChart3 className="h-4 w-4" />, action: () => navigate("/analytics"), keywords: ["rapports", "données"] },
        ],
    };

    const actionItems: CommandGroup = {
        heading: "Actions rapides",
        items: [
            { id: "add-student", label: "Ajouter un élève", icon: <Plus className="h-4 w-4" />, action: () => navigate("/school/students/new"), keywords: ["inscription", "nouveau"] },
            { id: "add-teacher", label: "Ajouter un enseignant", icon: <Plus className="h-4 w-4" />, action: () => navigate("/school/teachers/new"), keywords: ["nouveau", "prof"] },
            { id: "add-class", label: "Créer une classe", icon: <Plus className="h-4 w-4" />, action: () => navigate("/school/classes/new"), keywords: ["nouveau", "groupe"] },
            { id: "import", label: "Import en masse", icon: <Plus className="h-4 w-4" />, action: () => navigate("/school/import"), keywords: ["csv", "excel", "données"] },
        ],
    };

    const systemItems: CommandGroup = {
        heading: "Système",
        items: [
            { id: "settings", label: "Paramètres", icon: <Settings className="h-4 w-4" />, action: () => navigate("/settings"), keywords: ["préférences", "configuration"] },
            { id: "admin", label: "Administration", icon: <ShieldAlert className="h-4 w-4" />, action: () => navigate("/admin"), keywords: ["système", "utilisateurs"] },
        ],
    };

    const recentItems: CommandGroup = {
        heading: "Récemment visité",
        items: recentPaths.map((path) => ({
            id: `recent-${path}`,
            label: getPathLabel(path),
            icon: <Clock className="h-4 w-4 text-muted-foreground" />,
            action: () => navigate(path),
        })),
    };

    return (
        <CommandDialog open={open} onOpenChange={setOpen}>
            <CommandInput placeholder="Rechercher une page, une action..." />
            <CommandList>
                <CommandEmpty>
                    <div className="py-6 text-center">
                        <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">
                            Aucun résultat trouvé.
                        </p>
                    </div>
                </CommandEmpty>

                {/* Recent */}
                {recentItems.items.length > 0 && (
                    <>
                        <CommandGroup heading={recentItems.heading}>
                            {recentItems.items.map((item) => (
                                <CommandItem key={item.id} onSelect={item.action}>
                                    {item.icon}
                                    <span className="ml-2">{item.label}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandSeparator />
                    </>
                )}

                {/* Navigation */}
                <CommandGroup heading={navigationItems.heading}>
                    {navigationItems.items.map((item) => (
                        <CommandItem
                            key={item.id}
                            onSelect={item.action}
                            keywords={item.keywords}
                        >
                            {item.icon}
                            <span className="ml-2">{item.label}</span>
                            <ArrowRight className="ml-auto h-3 w-3 text-muted-foreground" />
                        </CommandItem>
                    ))}
                </CommandGroup>

                <CommandSeparator />

                {/* Actions */}
                <CommandGroup heading={actionItems.heading}>
                    {actionItems.items.map((item) => (
                        <CommandItem
                            key={item.id}
                            onSelect={item.action}
                            keywords={item.keywords}
                        >
                            <span className="flex items-center justify-center h-4 w-4 rounded-sm bg-primary/10 text-primary">
                                {item.icon}
                            </span>
                            <span className="ml-2">{item.label}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>

                <CommandSeparator />

                {/* System */}
                <CommandGroup heading={systemItems.heading}>
                    {systemItems.items.map((item) => (
                        <CommandItem
                            key={item.id}
                            onSelect={item.action}
                            keywords={item.keywords}
                        >
                            {item.icon}
                            <span className="ml-2">{item.label}</span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}

// Helper function
function getPathLabel(path: string): string {
    const pathMap: Record<string, string> = {
        "/dashboard": "Vue d'ensemble",
        "/school/students": "Élèves",
        "/school/teachers": "Enseignants",
        "/school/classes": "Classes",
        "/grades": "Notes",
        "/attendance": "Présences",
        "/schedule": "Emploi du temps",
        "/payments": "Paiements",
        "/messages": "Messages",
        "/analytics": "Statistiques",
        "/settings": "Paramètres",
        "/admin": "Administration",
    };
    return pathMap[path] || path;
}
