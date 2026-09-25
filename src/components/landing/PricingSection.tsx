"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Check, Sparkles, CreditCard, RefreshCw } from "lucide-react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { fetcher } from "@/lib/fetcher";
import { SectionHeader } from "./SectionHeader";

/** Plan tel que publié par /api/public/plans (prix null = sur devis). */
export interface PublicPlan {
    id: string;
    code: string;
    name: string;
    description: string | null;
    maxStudents: number;
    maxTeachers: number;
    maxStorageGB: number;
    features: string[];
    priceMonthly: number | null;
    priceYearly: number | null;
    isFeatured: boolean;
    priceOnRequest: boolean;
}

const fcfa = (value: number) => Math.round(value).toLocaleString("fr-FR");

/** Remise réelle de l'annuel vs 12 mensualités, en % entier (0 si aucune). */
export function annualSavingPercent(plan: Pick<PublicPlan, "priceMonthly" | "priceYearly">): number {
    if (!plan.priceMonthly || plan.priceYearly == null) return 0;
    const full = plan.priceMonthly * 12;
    return full > 0 ? Math.max(0, Math.round((1 - plan.priceYearly / full) * 100)) : 0;
}

function quotaLines(plan: PublicPlan): string[] {
    return [
        `Jusqu'à ${plan.maxStudents.toLocaleString("fr-FR")} élèves`,
        `${plan.maxTeachers.toLocaleString("fr-FR")} enseignants`,
        `${plan.maxStorageGB} Go de stockage`,
    ];
}

function PlanSkeleton() {
    return (
        <div className="rounded-2xl border border-border bg-card p-8 space-y-5">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-10 w-40" />
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
            <Skeleton className="h-12 w-full" />
        </div>
    );
}

export function PricingSection() {
    const [isAnnual, setIsAnnual] = useState(true);
    const { data, error, isLoading, mutate } = useSWR<{ data: PublicPlan[] }>("/api/public/plans", fetcher, {
        revalidateOnFocus: false,
    });
    const plans = useMemo(() => data?.data ?? [], [data]);

    // Badge de la bascule : la meilleure remise réellement configurée.
    const bestSaving = useMemo(() => Math.max(0, ...plans.map(annualSavingPercent)), [plans]);

    return (
        <section id="pricing" className="py-20 md:py-32 bg-background relative overflow-hidden">
            <div className="container mx-auto px-6 relative z-10">
                <SectionHeader
                    badgeIcon={CreditCard}
                    badgeText={t("landing.pricing.badge")}
                    title={t("landing.pricing.title")}
                    subtitle={t("landing.pricing.subtitle")}
                />

                {/* Bascule mensuel / annuel */}
                <div className="flex items-center justify-center gap-3 mb-12">
                    <span className={cn("text-sm font-medium transition-colors", !isAnnual ? "text-foreground" : "text-muted-foreground")}>
                        {t("landing.pricing.monthly")}
                    </span>
                    <button
                        onClick={() => setIsAnnual(!isAnnual)}
                        type="button"
                        className={cn(
                            "relative w-12 h-6 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            isAnnual ? "bg-primary" : "bg-muted"
                        )}
                        aria-label="Facturation annuelle"
                        aria-checked={isAnnual}
                        role="switch"
                    >
                        <span className={cn(
                            "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow-sm motion-reduce:transition-none",
                            isAnnual && "translate-x-6"
                        )} />
                    </button>
                    <span className={cn("text-sm font-medium transition-colors", isAnnual ? "text-foreground" : "text-muted-foreground")}>
                        {t("landing.pricing.annual")}
                    </span>
                    {isAnnual && bestSaving > 0 ? (
                        <span className="text-xs font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                            Jusqu&apos;à −{bestSaving} %
                        </span>
                    ) : null}
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto" aria-busy="true" aria-label="Chargement des tarifs">
                        <PlanSkeleton />
                        <PlanSkeleton />
                        <PlanSkeleton />
                    </div>
                ) : error ? (
                    <div className="max-w-md mx-auto text-center space-y-4" role="alert">
                        <p className="text-muted-foreground">Les tarifs n&apos;ont pas pu être chargés.</p>
                        <Button variant="outline" onClick={() => void mutate()} className="gap-2">
                            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Réessayer
                        </Button>
                    </div>
                ) : plans.length === 0 ? (
                    <div className="max-w-md mx-auto text-center space-y-4">
                        <p className="text-muted-foreground">Nos tarifs sont communiqués sur demande, selon la taille de votre établissement.</p>
                        <Button asChild>
                            <Link href="/setup">Nous contacter</Link>
                        </Button>
                    </div>
                ) : (
                    <div
                        className={cn(
                            "grid grid-cols-1 gap-6 mx-auto",
                            plans.length === 1 ? "max-w-md" : plans.length === 2 ? "md:grid-cols-2 max-w-3xl" : "md:grid-cols-3 max-w-5xl"
                        )}
                    >
                        {plans.map((plan, idx) => {
                            const saving = annualSavingPercent(plan);
                            const monthlyEquivalent =
                                plan.priceMonthly == null
                                    ? null
                                    : isAnnual && plan.priceYearly != null
                                        ? plan.priceYearly / 12
                                        : plan.priceMonthly;
                            const isFree = monthlyEquivalent === 0;
                            const features = [...quotaLines(plan), ...plan.features];

                            return (
                                <motion.article
                                    key={plan.id}
                                    aria-labelledby={`plan-${plan.id}`}
                                    className={cn(
                                        "relative rounded-2xl border p-8 flex flex-col transition-shadow duration-300",
                                        plan.isFeatured
                                            ? "border-primary bg-card shadow-xl shadow-primary/10"
                                            : "border-border bg-card hover:border-primary/30 hover:shadow-lg"
                                    )}
                                    initial={{ opacity: 0, y: 16 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.4, delay: idx * 0.08 }}
                                >
                                    {plan.isFeatured && (
                                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md">
                                                <Sparkles className="h-3 w-3" aria-hidden="true" />
                                                {t("landing.pricing.popular")}
                                            </span>
                                        </div>
                                    )}

                                    <header className="mb-6">
                                        <h3 id={`plan-${plan.id}`} className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                                        {plan.description ? <p className="text-sm text-muted-foreground">{plan.description}</p> : null}
                                    </header>

                                    <div className="mb-6 min-h-[64px]">
                                        {plan.priceOnRequest || monthlyEquivalent == null ? (
                                            <span className="text-3xl font-bold text-foreground">Sur devis</span>
                                        ) : isFree ? (
                                            <span className="text-4xl font-bold text-foreground">Gratuit</span>
                                        ) : (
                                            <>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-4xl font-bold tabular-nums text-foreground">{fcfa(monthlyEquivalent)}</span>
                                                    <span className="text-sm text-muted-foreground">FCFA{t("landing.pricing.perMonth")}</span>
                                                </div>
                                                {isAnnual && plan.priceYearly != null ? (
                                                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                                                        {fcfa(plan.priceYearly)} FCFA facturés par an{saving > 0 ? ` · −${saving} %` : ""}
                                                    </p>
                                                ) : null}
                                            </>
                                        )}
                                    </div>

                                    <ul className="space-y-3 mb-8 flex-1">
                                        {features.map((feature) => (
                                            <li key={feature} className="flex items-start gap-3 text-sm">
                                                <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                                                <span className="text-foreground">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Button
                                        className="w-full h-12 font-semibold"
                                        variant={plan.isFeatured ? "default" : "outline"}
                                        asChild
                                    >
                                        <Link href={`/setup?plan=${encodeURIComponent(plan.code)}`}>
                                            {plan.priceOnRequest
                                                ? t("landing.pricing.ctaEnterprise")
                                                : plan.isFeatured
                                                    ? t("landing.pricing.ctaPopular")
                                                    : t("landing.pricing.cta")}
                                        </Link>
                                    </Button>
                                </motion.article>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
}
