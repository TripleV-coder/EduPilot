"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavGroup, NavItem, SidebarSection } from "@/lib/config/navigation";
import { sectionLabelMap } from "@/lib/config/navigation";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarNavItem } from "./SidebarNavItem";

interface SidebarNavGroupProps {
    group: NavGroup;
    visibleItems: NavItem[];
    section: SidebarSection;
    isCollapsed: boolean;
    hasActiveItem: boolean;
    showSectionLabel: boolean;
    openGroups: string[];
    onItemClick?: () => void;
}

export function SidebarNavGroup({
    group,
    visibleItems,
    section,
    isCollapsed,
    hasActiveItem,
    showSectionLabel,
    openGroups,
    onItemClick,
}: SidebarNavGroupProps) {
    const pathname = usePathname();
    const isGroupOpen = !isCollapsed && openGroups.includes(group.id);
    const isAlertsWithCritical = group.id === "alerts" && Number(group.badge || 0) > 0;

    if (isCollapsed) {
        return (
            <Tooltip key={group.id}>
                <TooltipTrigger asChild>
                    <div className={cn(
                        "flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-all duration-200 cursor-pointer mb-1",
                        hasActiveItem ? "bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-fg))]" : "text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg))]",
                        isAlertsWithCritical && "bg-[#5A2E2E]/40"
                    )}>
                        <group.icon className={cn("w-5 h-5", isAlertsWithCritical && "text-[#C0392B]")} />
                        {isAlertsWithCritical && (
                            <span className="absolute top-0 right-0 w-2 h-2 bg-[#C0392B] rounded-full" />
                        )}
                    </div>
                </TooltipTrigger>
                <TooltipContent
                    side="right"
                    sideOffset={8}
                    className="bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))] border-[hsl(var(--sidebar-border))] font-semibold text-xs tracking-wide"
                >
                    {group.title}
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <div key={group.id}>
            {showSectionLabel && (
                <div className="pt-2 pb-1 px-3">
                    <div className="h-px w-full bg-white/10 mb-2" />
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[hsl(var(--sidebar-muted))] font-semibold">
                        {sectionLabelMap[section]}
                    </p>
                </div>
            )}
            <AccordionItem value={group.id} className="border-none">
                <AccordionTrigger className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-white/5 hover:no-underline transition-colors text-sm font-semibold",
                    isAlertsWithCritical
                        ? "bg-[#5A2E2E]/40 text-[hsl(var(--sidebar-fg))]"
                        : hasActiveItem && !isGroupOpen ? "text-[hsl(var(--sidebar-fg))]" : "text-[hsl(var(--sidebar-muted))]"
                )}>
                    <div className="flex items-center gap-3 flex-1 text-left">
                        <group.icon className={cn("w-5 h-5 shrink-0", isAlertsWithCritical && "text-[#C0392B]")} />
                        <span className="truncate">{group.title}</span>
                    </div>
                    {group.badge && !isGroupOpen && (
                        <span className={cn(
                            "mr-2 px-2 py-0.5 rounded-full text-[11px] font-black",
                            group.badgeVariant === "info"
                                ? "bg-[#2E6DA4]/20 text-[#5B9BD5]"
                                : "bg-[#C0392B] text-white"
                        )}>
                            {group.badge}
                        </span>
                    )}
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-0 pl-4 space-y-1">
                    {visibleItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        return (
                            <SidebarNavItem
                                key={item.href}
                                item={item}
                                isActive={isActive}
                                isCollapsed={false}
                                onClick={onItemClick}
                            />
                        );
                    })}
                </AccordionContent>
            </AccordionItem>
        </div>
    );
}
