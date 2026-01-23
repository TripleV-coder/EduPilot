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
        <footer className="border-t border-white/10 bg-apogee-abyss/90 text-apogee-metal/80 shrink-0">
            {/* Compact Socket - Always visible (~48px) */}
            <div className="px-4 lg:px-6 py-2.5">
                <div className="flex items-center justify-between gap-4 text-xs">
                    {/* Left: Logo + Copyright */}
                    <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded bg-white/10 flex items-center justify-center text-apogee-metal/80 text-[10px] font-bold">
                            EP
                        </div>
                        <span className="text-apogee-metal/70">
                            © {currentYear} EduPilot
                        </span>
                    </div>

                    {/* Center: Quick Links */}
                    <nav className="hidden md:flex items-center gap-4">
                        <Link href="/help" className="text-apogee-metal/70 hover:text-white transition-colors flex items-center gap-1.5">
                            <HelpCircle className="h-3 w-3" />
                            Aide
                        </Link>
                        <span className="text-apogee-metal/40">•</span>
                        <Link href="/status" className="text-apogee-metal/70 hover:text-white transition-colors flex items-center gap-1.5">
                            <Server className="h-3 w-3" />
                            <span className="w-1.5 h-1.5 rounded-full bg-apogee-emerald" />
                            Statut
                        </Link>
                        <span className="text-apogee-metal/40">•</span>
                        <Link href="/privacy" className="text-apogee-metal/70 hover:text-white transition-colors">
                            Confidentialité
                        </Link>
                        <span className="text-apogee-metal/40">•</span>
                        <Link href="/terms" className="text-apogee-metal/70 hover:text-white transition-colors">
                            CGU
                        </Link>
                    </nav>

                    {/* Right: Version + Expand */}
                    <div className="flex items-center gap-3">
                        <span className="text-apogee-metal/50">v3.0.0</span>
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-apogee-metal/70 hover:text-white"
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
                <div className="px-4 lg:px-6 py-4 border-t border-white/10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        {/* Support */}
                        <div>
                            <h4 className="text-white font-medium mb-2">Support</h4>
                            <div className="space-y-1.5">
                                <Link href="/help" className="block text-apogee-metal/70 hover:text-white">Centre d'aide</Link>
                                <Link href="/contact" className="block text-apogee-metal/70 hover:text-white">Contact</Link>
                                <Link href="/faq" className="block text-apogee-metal/70 hover:text-white">FAQ</Link>
                            </div>
                        </div>
                        {/* Outils */}
                        <div>
                            <h4 className="text-white font-medium mb-2">Outils</h4>
                            <div className="space-y-1.5">
                                <Link href="/changelog" className="block text-apogee-metal/70 hover:text-white">Changelog</Link>
                                <Link href="/api-docs" className="block text-apogee-metal/70 hover:text-white">API</Link>
                            </div>
                        </div>
                        {/* Navigation */}
                        <div>
                            <h4 className="text-white font-medium mb-2">Navigation</h4>
                            <div className="space-y-1.5">
                                <Link href="/dashboard" className="block text-apogee-metal/70 hover:text-white">Tableau de bord</Link>
                                <Link href="/settings" className="block text-apogee-metal/70 hover:text-white">Paramètres</Link>
                            </div>
                        </div>
                        {/* Langue */}
                        <div>
                            <h4 className="text-white font-medium mb-2">Langue</h4>
                            <select
                                className="bg-apogee-abyss/70 border border-white/10 rounded px-2 py-1 text-xs text-apogee-metal/80 focus:outline-none focus:ring-1 focus:ring-apogee-cobalt/60 w-full"
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
        <div className="flex items-center justify-between px-4 h-7 text-[10px] border-t border-white/10 bg-apogee-abyss/80 text-apogee-metal/70 shrink-0">
            <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-apogee-emerald" />
                <span>Opérationnel</span>
            </div>
            <span className="text-apogee-metal/50">v3.0.0</span>
        </div>
    );
}
