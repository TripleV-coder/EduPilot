"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  GraduationCap, 
  Receipt, 
  Calendar, 
  BarChart3, 
  Settings,
  Bell,
  Search,
  ChevronRight,
  LogOut
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

const navigation: NavItem[] = [
  { name: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
  { name: "Élèves", href: "/dashboard/students", icon: Users, badge: 1250 },
  { name: "Classes", href: "/dashboard/classes", icon: GraduationCap },
  { name: "Finances", href: "/dashboard/finance", icon: Receipt },
  { name: "Planning", href: "/dashboard/schedule", icon: Calendar },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
];

const footerNav: NavItem[] = [
  { name: "Paramètres", href: "/dashboard/settings", icon: Settings },
  { name: "Notifications", href: "/dashboard/notifications", icon: Bell, badge: 3 },
];

interface SwissSidebarProps {
  className?: string;
}

export function SwissSidebar({ className }: SwissSidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div 
      className={cn(
        "flex flex-col h-screen bg-[hsl(var(--surface-ground))] border-r border-border transition-all duration-200",
        isCollapsed ? "w-16" : "w-60",
        className
      )}
    >
      {/* Logo Section */}
      <div className="flex items-center justify-between h-14 px-3 border-b border-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-sm flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="font-semibold text-[15px] text-text-primary tracking-tight">
              EduPilot
            </span>
          </div>
        )}
        {isCollapsed && (
          <div className="w-8 h-8 bg-primary rounded-sm flex items-center justify-center mx-auto">
            <span className="text-white font-bold text-sm">E</span>
          </div>
        )}
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden lg:flex p-1 rounded-sm hover:bg-muted/60 text-text-secondary transition-colors"
        >
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform",
            !isCollapsed && "rotate-180"
          )} />
        </button>
      </div>

      {/* Search */}
      {!isCollapsed && (
        <div className="p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-[hsl(var(--surface-base))] border border-border rounded-sm">
            <Search className="h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              placeholder="Rechercher..."
              className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-sm text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]"
                      : "text-text-secondary hover:text-text-primary hover:bg-muted/40"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className={cn(
                    "h-4 w-4 flex-shrink-0",
                    isActive ? "text-[hsl(var(--sidebar-fg))]" : "text-text-secondary"
                  )} />
                  {!isCollapsed && (
                    <span className="flex-1 truncate">{item.name}</span>
                  )}
                  {!isCollapsed && item.badge && (
                    <span className={cn(
                      "px-1.5 py-0 text-[10px] font-medium rounded-sm",
                      isActive 
                        ? "bg-[hsl(var(--sidebar-hover))] text-[hsl(var(--sidebar-fg))]"
                        : "bg-muted text-text-secondary"
                    )}>
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Divider */}
        <div className="mx-3 my-3 h-px bg-border" />

        {/* Footer Navigation */}
        <ul className="space-y-0.5 px-2">
          {footerNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-sm text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-[hsl(var(--sidebar-bg))] text-[hsl(var(--sidebar-fg))]"
                      : "text-text-secondary hover:text-text-primary hover:bg-muted/40"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <Icon className={cn(
                    "h-4 w-4 flex-shrink-0",
                    isActive ? "text-[hsl(var(--sidebar-fg))]" : "text-text-secondary"
                  )} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 truncate">{item.name}</span>
                      {item.badge && (
                        <span className={cn(
                          "px-1.5 py-0 text-[10px] font-medium rounded-sm",
                          isActive 
                            ? "bg-[hsl(var(--sidebar-hover))] text-[hsl(var(--sidebar-fg))]"
                            : "bg-muted text-text-secondary"
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-2 border-t border-border">
        <button className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 rounded-sm text-[13px] text-text-secondary hover:text-text-primary hover:bg-muted/40 transition-colors",
          isCollapsed && "justify-center"
        )}>
          <div className="w-6 h-6 bg-muted rounded-sm flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-medium text-text-secondary">AD</span>
          </div>
          {!isCollapsed && (
            <>
              <span className="flex-1 text-left truncate">Admin</span>
              <LogOut className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default SwissSidebar;
