"use client";

import { useTabContext } from "@/lib/contexts/tab-context";
import { X, Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect } from "react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

// ============================================
// TAB BAR COMPONENT
// ============================================

export function TabBar() {
    const { tabs, activeTabId, setActiveTab, closeTab, closeAllTabs, closeOtherTabs } = useTabContext();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showLeftScroll, setShowLeftScroll] = useState(false);
    const [showRightScroll, setShowRightScroll] = useState(false);

    // Check scroll indicators
    useEffect(() => {
        const checkScroll = () => {
            if (scrollRef.current) {
                const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
                setShowLeftScroll(scrollLeft > 0);
                setShowRightScroll(scrollLeft + clientWidth < scrollWidth - 1);
            }
        };

        checkScroll();
        const el = scrollRef.current;
        el?.addEventListener("scroll", checkScroll);
        window.addEventListener("resize", checkScroll);

        return () => {
            el?.removeEventListener("scroll", checkScroll);
            window.removeEventListener("resize", checkScroll);
        };
    }, [tabs]);

    // Scroll active tab into view
    useEffect(() => {
        if (activeTabId && scrollRef.current) {
            const activeTab = scrollRef.current.querySelector(`[data-tab-id="${activeTabId}"]`);
            activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
    }, [activeTabId]);

    const scroll = (direction: "left" | "right") => {
        if (scrollRef.current) {
            const amount = 200;
            scrollRef.current.scrollBy({
                left: direction === "left" ? -amount : amount,
                behavior: "smooth",
            });
        }
    };

    if (tabs.length === 0) return null;

    return (
        <div
            className="flex items-center border-b border-white/10 bg-apogee-abyss/70 backdrop-blur"
            style={{ height: "var(--tab-bar-height)" }}
        >
            {/* Scroll left indicator */}
            {showLeftScroll && (
                <button
                    onClick={() => scroll("left")}
                    className="flex items-center justify-center w-6 h-full border-r border-white/10 bg-apogee-abyss/80 hover:bg-white/5 transition-colors text-apogee-metal/70"
                >
                    <span>‹</span>
                </button>
            )}

            {/* Tabs container */}
            <div
                ref={scrollRef}
                className="flex-1 flex items-center overflow-x-auto scrollbar-none"
            >
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        data-tab-id={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "group flex items-center gap-2 h-full px-3 min-w-[120px] max-w-[200px] border-r border-white/10 cursor-pointer transition-colors",
                            activeTabId === tab.id
                                ? "bg-white/10 text-white"
                                : "bg-transparent text-apogee-metal/70 hover:bg-white/5 hover:text-white"
                        )}
                    >
                        {/* Dirty indicator */}
                        {tab.isDirty && (
                            <span className="w-2 h-2 rounded-full bg-apogee-gold shrink-0" />
                        )}

                        {/* Title */}
                        <span className="flex-1 text-sm truncate">{tab.title}</span>

                        {/* Close button */}
                        {tab.closeable !== false && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    closeTab(tab.id);
                                }}
                                className={cn(
                                    "shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors",
                                    activeTabId === tab.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                )}
                            >
                                <X className="h-3.5 w-3.5" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* Scroll right indicator */}
            {showRightScroll && (
                <button
                    onClick={() => scroll("right")}
                    className="flex items-center justify-center w-6 h-full border-l border-white/10 bg-apogee-abyss/80 hover:bg-white/5 transition-colors text-apogee-metal/70"
                >
                    <span>›</span>
                </button>
            )}

            {/* Actions menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-full w-9 rounded-none border-l border-white/10 text-apogee-metal/70 hover:text-white"
                    >
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => closeOtherTabs(activeTabId!)}>
                        Fermer les autres onglets
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={closeAllTabs}>
                        Fermer tous les onglets
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-muted-foreground text-xs">
                        {tabs.length} / 10 onglets
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
