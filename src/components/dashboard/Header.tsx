"use client";

import { useEffect, useState } from "react";
import { Menu, Mail, ChevronRight, Minimize2, Maximize2, PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import { useSidebar } from "@/components/dashboard/DashboardLayoutClient";
import { useSchool } from "@/components/providers/school-provider";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

import { NotificationCenter } from "./NotificationCenter";
import { GlobalSearch } from "./GlobalSearch";

export function Header() {
    const { data: session } = useSession();
    const { toggle, setIsMobileOpen, density, setDensity, isFocusMode, toggleFocusMode } = useSidebar();
    const { currentPeriodName } = useSchool();
    const pathname = usePathname();
    const [isElevated, setIsElevated] = useState(false);
    
    const userName = session?.user?.name || "Utilisateur";
    
    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    // Breadcrumbs logic
    const pathSegments = pathname.split("/").filter(Boolean);
    const segmentLabelMap: Record<string, string> = {
        dashboard: "Tableau de bord",
        "root-control": "Console racine",
        settings: "Paramètres",
        system: "Système",
        compliance: "Conformité",
        "audit-logs": "Journal d’audit",
        students: "Élèves",
        teachers: "Enseignants",
        parents: "Parents",
        users: "Personnel & Comptes",
        finance: "Finances",
        grades: "Notes & Bulletins",
        attendance: "Présences",
        schedule: "Emploi du temps",
        events: "Événements",
        messages: "Messagerie",
        documents: "Documents",
        resources: "Ressources",
        incidents: "Discipline",
        analytics: "Analytique",
        alerts: "Alertes",
        ai: "Assistant IA",
        canteen: "Cantine",
        medical: "Infirmerie",
        scholarships: "Bourses",
        courses: "Cours & LMS",
        performances: "Performances",
        announcements: "Annonces",
        appointments: "Rendez-vous",
        library: "Bibliothèque",
        orientation: "Orientation",
        gamification: "Gamification",
        rooms: "Salles & lieux",
        locale: "Langue & région",
        appearance: "Apparence",
        security: "Sécurité",
        academic: "Années & périodes",
        periods: "Périodes",
        subjects: "Niveaux & matières",
        levels: "Niveaux",
        "class-levels": "Niveaux de classe",
        "class-subjects": "Matières par classe",
        "evaluation-types": "Types d’évaluation",
        profile: "Profil",
        notifications: "Notifications",
        retention: "Rétention",
        monitoring: "Monitoring",
        backup: "Sauvegardes",
        reforms: "Réformes",
        plans: "Plans & formules",
        schools: "Établissements",
        logs: "Logs",
        maintenance: "Maintenance",
        "data-requests": "Demandes de données",
        sms: "SMS",
        "bulk-invoice": "Facturation en lot",
        reconciliation: "Rapprochement",
        reports: "Rapports",
        entry: "Saisie",
        bulletins: "Bulletins",
        cahier: "Cahier de notes",
    };
    const breadcrumbs = pathSegments.map((segment, index) => {
        const href = `/${pathSegments.slice(0, index + 1).join("/")}`;
        const isLast = index === pathSegments.length - 1;
        const label =
            segmentLabelMap[segment] ??
            segment
                .split("-")
                .filter(Boolean)
                .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
                .join(" ");
        
        // Skip 'dashboard' if it's the first segment to keep it clean
        if (segment === "dashboard" && index === 0) return null;

        return { label, href, isLast };
    }).filter(Boolean);

    useEffect(() => {
        let frame = 0;
        const update = () => {
            setIsElevated((window.scrollY || 0) > 8);
            frame = 0;
        };
        const onScroll = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(update);
        };
        update();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", onScroll);
        };
    }, []);

    return (
        <header className={cn(
            "sticky top-0 z-30 h-[52px] w-full border-b flex items-center justify-between px-4 gap-4 shrink-0 transition-all duration-200",
            isElevated
                ? "bg-white border-[#E8E7E4] shadow-[0_8px_16px_hsl(24_8%_12%_/_0.08)]"
                : "bg-white border-[#E8E7E4]"
        )}>
            <div className="flex items-center gap-3 flex-1 overflow-hidden">
                {/* Hamburger / Toggle */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                    onClick={() => {
                        if (window.innerWidth < 768) {
                            setIsMobileOpen(true);
                        } else {
                            toggle();
                        }
                    }}
                >
                    <Menu className="w-4 h-4" />
                </Button>

                {/* Breadcrumbs */}
                <nav className="hidden sm:flex items-center gap-1 text-[13px] text-[#9A9A92] overflow-hidden whitespace-nowrap">
                    <Link href="/dashboard" className="hover:text-[#2A2A28] transition-colors">Tableau de bord</Link>
                    {breadcrumbs.map((bc, idx) => {
                        if (!bc) return null;
                        return (
                            <div key={bc.href || idx} className="flex items-center gap-1">
                                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 mx-1" />}
                                {bc.isLast ? (
                                    <span className="text-[#2A2A28] font-medium truncate">{bc.label}</span>
                                ) : (
                                    <Link href={bc.href || "#"} className="hover:text-[#2A2A28] transition-colors truncate">{bc.label}</Link>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </div>

            {/* Recherche Globale */}
            <GlobalSearch />

            {/* Actions Droite */}
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
                {/* Contexte Période */}
                {currentPeriodName && (
                    <div className="hidden md:flex items-center h-7 px-3 rounded-full bg-[#EEF7F3] border border-[#B8DFC8] text-[11px] font-medium text-[#2D6A4F]">
                        {currentPeriodName}
                    </div>
                )}

                {/* Messages */}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Mail className="w-4 h-4" />
                </Button>

                {/* Densité */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", density === "dense" && "bg-muted/70")}
                    onClick={() => setDensity(density === "dense" ? "comfort" : "dense")}
                    title={density === "dense" ? "Mode confort" : "Mode dense"}
                >
                    <PanelsTopLeft className="w-4 h-4" />
                </Button>

                {/* Focus mode */}
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", isFocusMode && "bg-muted/70")}
                    onClick={toggleFocusMode}
                    title={isFocusMode ? "Quitter mode focus" : "Activer mode focus"}
                >
                    {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </Button>

                {/* Notifications */}
                <NotificationCenter />

                {/* User Avatar */}
                <div className="h-7 w-7 rounded-full bg-[#EEF7F3] text-[#1A4535] flex items-center justify-center text-[11px] font-bold border border-[#B8DFC8] shrink-0 cursor-pointer hover:bg-[#E4F2EB] transition-colors ml-1">
                    {initials}
                </div>
            </div>
        </header>
    );
}
