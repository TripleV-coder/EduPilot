"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { t } from "@/lib/i18n";

const footerLinks = {
    product: [
        { key: "features", href: "#features" },
        { key: "pricing", href: "#pricing" },
        { key: "explorer", href: "/explorer" },
    ],
    company: [
        { key: "about", href: "/explorer" },
        { key: "contact", href: "/setup" },
        { key: "blog", href: "/explorer" },
    ],
    legal: [
        { key: "privacy", href: "/privacy" },
        { key: "terms", href: "/terms" },
        { key: "rgpd", href: "/privacy" },
    ],
};

export function FooterSection() {
    return (
        <footer className="border-t border-border bg-card/50">
            <div className="container mx-auto px-6 py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                    {/* Brand column */}
                    <div className="md:col-span-1">
                        <Link href="/" className="flex items-center gap-2 mb-4 group">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                                <GraduationCap className="text-primary-foreground w-5 h-5" />
                            </div>
                            <span className="font-display font-bold text-lg tracking-tight">EduPilot</span>
                        </Link>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                            {t("landing.footer.description")}
                        </p>
                    </div>

                    {/* Link columns */}
                    {(["product", "company", "legal"] as const).map((section) => (
                        <div key={section}>
                            <h4 className="text-sm font-semibold text-foreground mb-4 uppercase tracking-wide">
                                {t(`landing.footer.${section}`)}
                            </h4>
                            <ul className="space-y-3">
                                {footerLinks[section].map((link) => (
                                    <li key={link.key}>
                                        <Link
                                            href={link.href}
                                            className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
                                        >
                                            {t(`landing.footer.links.${link.key}`)}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom bar */}
                <div className="mt-12 pt-8 border-t border-border">
                    <p className="text-xs text-muted-foreground text-center">
                        {t("landing.footer.copyright")}
                    </p>
                </div>
            </div>
        </footer>
    );
}
