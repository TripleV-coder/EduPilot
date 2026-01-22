"use client";

import Link from "next/link";
import { HelpCircle, Server, ChevronUp, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// ============================================
// COMPACT FOOTER (Professional SaaS 2026)
// Single-line design with optional expansion
// ============================================

export function Footer() {
    const currentYear = new Date().getFullYear();
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <footer className="border-t border-border bg-slate-900 text-slate-300 shrink-0">
            {/* Compact Socket - Always visible (~48px) */}
            <div className="px-4 lg:px-6 py-2.5">
                <div className="flex items-center justify-between gap-4 text-xs">
                    {/* Left: Logo + Copyright */}
                    <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded bg-slate-700 flex items-center justify-center text-slate-300 text-[10px] font-bold">
                            EP
                        </div>
                        <span className="text-slate-400">
                            © {currentYear} EduPilot
                        </span>
                    </div>

                    {/* Center: Quick Links */}
                    <nav className="hidden md:flex items-center gap-4">
                        <Link href="/help" className="text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1.5">
                            <HelpCircle className="h-3 w-3" />
                            Aide
                        </Link>
                        <span className="text-slate-600">•</span>
                        <Link href="/status" className="text-slate-400 hover:text-slate-100 transition-colors flex items-center gap-1.5">
                            <Server className="h-3 w-3" />
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            Statut
                        </Link>
                        <span className="text-slate-600">•</span>
                        <Link href="/privacy" className="text-slate-400 hover:text-slate-100 transition-colors">
                            Confidentialité
                        </Link>
                        <span className="text-slate-600">•</span>
                        <Link href="/terms" className="text-slate-400 hover:text-slate-100 transition-colors">
                            CGU
                        </Link>
                    </nav>

                    {/* Right: Version + Expand */}
                    <div className="flex items-center gap-3">
                        <span className="text-slate-500">v3.0.0</span>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 rounded hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-200"
                            aria-label={isExpanded ? "Réduire" : "Plus d'options"}
                        >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded Content - Optional */}
            <div className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                isExpanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="px-4 lg:px-6 py-4 border-t border-slate-700">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        {/* Support */}
                        <div>
                            <h4 className="text-slate-100 font-medium mb-2">Support</h4>
                            <div className="space-y-1.5">
                                <Link href="/help" className="block text-slate-400 hover:text-slate-200">Centre d'aide</Link>
                                <Link href="/contact" className="block text-slate-400 hover:text-slate-200">Contact</Link>
                                <Link href="/faq" className="block text-slate-400 hover:text-slate-200">FAQ</Link>
                            </div>
                        </div>
                        {/* Outils */}
                        <div>
                            <h4 className="text-slate-100 font-medium mb-2">Outils</h4>
                            <div className="space-y-1.5">
                                <Link href="/changelog" className="block text-slate-400 hover:text-slate-200">Changelog</Link>
                                <Link href="/api-docs" className="block text-slate-400 hover:text-slate-200">API</Link>
                            </div>
                        </div>
                        {/* Navigation */}
                        <div>
                            <h4 className="text-slate-100 font-medium mb-2">Navigation</h4>
                            <div className="space-y-1.5">
                                <Link href="/dashboard" className="block text-slate-400 hover:text-slate-200">Tableau de bord</Link>
                                <Link href="/settings" className="block text-slate-400 hover:text-slate-200">Paramètres</Link>
                            </div>
                        </div>
                        {/* Langue */}
                        <div>
                            <h4 className="text-slate-100 font-medium mb-2">Langue</h4>
                            <select
                                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500 w-full"
                                defaultValue="fr"
                            >
                                <option value="fr">🇫🇷 Français</option>
                                <option value="en">🇬🇧 English</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}

// ============================================
// STATUS BAR (Minimal version for app header area)
// ============================================

export function StatusBar() {
    return (
        <div className="flex items-center justify-between px-4 h-7 text-[11px] border-t border-border bg-muted/50 text-muted-foreground shrink-0">
            <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span>Opérationnel</span>
            </div>
            <span>v3.0.0</span>
        </div>
    );
}
