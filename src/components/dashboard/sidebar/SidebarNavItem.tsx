"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/lib/config/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarNavItemProps {
    item: NavItem;
    isActive: boolean;
    isCollapsed: boolean;
    onClick?: () => void;
}

export function SidebarNavItem({ item, isActive, isCollapsed, onClick }: SidebarNavItemProps) {
    const content = (
        <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
                "flex items-center gap-3 h-[34px] px-3 rounded-md text-sm transition-all duration-150 relative group",
                isActive
                    ? "text-[hsl(var(--sidebar-fg))] bg-[hsl(var(--sidebar-active))] font-semibold"
                    : "text-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-fg))] hover:bg-[hsl(var(--sidebar-hover))]",
                isCollapsed && "justify-center px-0 mx-auto w-10 h-10"
            )}
        >
            {/* Active indicator bar */}
            {isActive && (
                <div className={cn(
                    "absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full bg-[hsl(var(--primary))]",
                    isCollapsed && "left-[-4px]"
                )} />
            )}
            <item.icon className={cn(
                "shrink-0 w-5 h-5 transition-transform duration-200 group-hover:scale-110",
                isActive ? "text-[hsl(var(--sidebar-fg))]" : "text-[hsl(var(--sidebar-muted))] group-hover:text-[hsl(var(--sidebar-fg))]"
            )} />
            {!isCollapsed && <span className="truncate flex-1 font-medium">{item.name}</span>}
            {!isCollapsed && (item.badge || (item.notifications ?? 0) > 0) && (
                <span className={cn(
                    "px-2 py-0.5 rounded-full text-[11px] font-black uppercase",
                    item.badgeVariant === "warning"
                        ? "bg-[#D4830F]/20 text-[#D4830F]"
                        : item.badgeVariant === "info"
                            ? "bg-[#2E6DA4]/20 text-[#2E6DA4]"
                            : item.badgeVariant === "destructive" || (item.notifications ?? 0) > 0
                                ? "bg-[#C0392B] text-white"
                                : "bg-[#2D6A4F]/20 text-[#4A9E7A]"
                )}>
                    {item.badge || item.notifications}
                </span>
            )}
            {isCollapsed && (item.notifications ?? 0) > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[hsl(var(--destructive))] rounded-full border-2 border-[hsl(var(--sidebar-bg))]" />
            )}
        </Link>
    );

    if (isCollapsed) {
        return (
            <Tooltip key={item.href}>
                <TooltipTrigger asChild>{content}</TooltipTrigger>
                <TooltipContent
                    side="right"
                    sideOffset={8}
                    className="bg-[#1A1A18] text-white border-white/10 font-bold text-xs uppercase tracking-widest"
                >
                    {item.name}
                </TooltipContent>
            </Tooltip>
        );
    }
    return content;
}
