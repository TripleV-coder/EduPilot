"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Check, Sparkles, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { SectionHeader } from "./SectionHeader";

interface PricingTier {
    key: string;
    popular?: boolean;
}

const tiers: PricingTier[] = [
    { key: "essential" },
    { key: "professional", popular: true },
    { key: "enterprise" },
];

export function PricingSection() {
    const [isAnnual, setIsAnnual] = useState(true);

    return (
        <section id="pricing" className="py-20 md:py-32 bg-background relative overflow-hidden">
            {/* Background accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-[radial-gradient(ellipse,hsl(var(--primary)/0.06),transparent_70%)] pointer-events-none" />

            <div className="container mx-auto px-6 relative z-10">
                <SectionHeader
                    badgeIcon={CreditCard}
                    badgeText={t("landing.pricing.badge")}
                    title={t("landing.pricing.title")}
                    subtitle={t("landing.pricing.subtitle")}
                />

                {/* Billing toggle */}
                <motion.div
                    className="flex items-center justify-center gap-3 mb-12"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                >
                    <span className={cn("text-sm font-medium transition-colors", !isAnnual ? "text-foreground" : "text-muted-foreground")}>
                        {t("landing.pricing.monthly")}
                    </span>
                    <button
                        onClick={() => setIsAnnual(!isAnnual)}
                        type="button"
                        className={cn(
                            "relative w-12 h-6 rounded-full transition-colors duration-200",
                            isAnnual ? "bg-primary" : "bg-muted"
                        )}
                        aria-label="Basculer la période de facturation"
                        aria-pressed={isAnnual}
                        aria-checked={isAnnual}
                        role="switch"
                    >
                        <span className={cn(
                            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm",
                            isAnnual && "translate-x-6"
                        )} />
                    </button>
                    <span className={cn("text-sm font-medium transition-colors", isAnnual ? "text-foreground" : "text-muted-foreground")}>
                        {t("landing.pricing.annual")}
                    </span>
                    {isAnnual && (
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                            {t("landing.pricing.annualSave")}
                        </span>
                    )}
                </motion.div>

                {/* Pricing cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                    {tiers.map((tier, idx) => {
                        const price = t(`landing.pricing.${tier.key}.price`);
                        const isEnterprise = tier.key === "enterprise";
                        const displayPrice = isEnterprise
                            ? price
                            : isAnnual
                                ? `${Math.round(Number(price.replace(/\s/g, "")) * 0.8).toLocaleString("fr-FR")}`
                                : price;
                        const features: string[] = (() => {
                            const raw = t(`landing.pricing.${tier.key}.features`);
                            if (Array.isArray(raw)) return raw;
                            if (typeof raw === "string") return raw.split(",");
                            return [];
                        })();

                        return (
                            <motion.div
                                key={tier.key}
                                className={cn(
                                    "relative rounded-2xl border p-8 flex flex-col transition-all duration-300",
                                    tier.popular
                                        ? "border-primary bg-card shadow-xl shadow-primary/10 scale-[1.02] md:scale-105"
                                        : "border-border bg-card/70 hover:border-primary/30 hover:shadow-lg"
                                )}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.45, delay: idx * 0.1 }}
                            >
                                {/* Popular badge */}
                                {tier.popular && (
                                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wide shadow-md">
                                            <Sparkles className="h-3 w-3" />
                                            {t("landing.pricing.popular")}
                                        </span>
                                    </div>
                                )}

                                <div className="mb-6">
                                    <h3 className="text-xl font-bold text-foreground mb-1">
                                        {t(`landing.pricing.${tier.key}.name`)}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        {t(`landing.pricing.${tier.key}.description`)}
                                    </p>
                                </div>

                                <div className="mb-6">
                                    {isEnterprise ? (
                                        <span className="metric-serif text-3xl font-bold text-foreground">{displayPrice}</span>
                                    ) : (
                                        <div className="flex items-baseline gap-1">
                                            <span className="metric-serif text-4xl font-bold text-foreground">
                                                {displayPrice === "0" ? "Gratuit" : `${displayPrice}`}
                                            </span>
                                            {displayPrice !== "0" && (
                                                <span className="text-sm text-muted-foreground">
                                                    FCFA{t("landing.pricing.perMonth")}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <ul className="space-y-3 mb-8 flex-1">
                                    {features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-3 text-sm">
                                            <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                            <span className="text-foreground">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Button
                                    className={cn(
                                        "w-full h-12 font-semibold transition-all duration-200",
                                        tier.popular
                                            ? "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 shadow-md"
                                            : ""
                                    )}
                                    variant={tier.popular ? "default" : "outline"}
                                    asChild
                                >
                                    <Link href={isEnterprise ? "/setup?plan=enterprise" : "/setup"}>
                                        {isEnterprise
                                            ? t("landing.pricing.ctaEnterprise")
                                            : tier.popular
                                                ? t("landing.pricing.ctaPopular")
                                                : t("landing.pricing.cta")}
                                    </Link>
                                </Button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
