"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { t } from "@/lib/i18n";
import { enterStyle } from "./Reveal";
import { useExplorerOverview } from "./use-explorer-overview";

export function HeroSection() {
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";
    // Même requête que la section chiffres (SWR la partage) ; le bandeau
    // n'apparaît qu'avec un vrai nombre, jamais « 0 élève » par défaut.
    const { data: overview } = useExplorerOverview();
    const trainedStudents = Number(overview?.students ?? 0);

    return (
        <section className="relative min-h-screen pt-32 pb-20 overflow-hidden flex items-center bg-background">
            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-4xl mx-auto text-center">
                    <div
                        className="edu-enter-up inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 text-sm font-medium mb-8 shadow-sm backdrop-blur-sm"
                        style={enterStyle(0, 0, 500, 0.95)}
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                        </span>
                        {t("landing.hero.badge")}
                    </div>

                    {trainedStudents > 0 ? (
                        <div
                            className="edu-enter-up mb-6 ml-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary"
                            style={enterStyle(12, 0, 450)}
                        >
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            {t("landing.hero.trainedStudents", { count: trainedStudents.toLocaleString("fr-FR") })}
                        </div>
                    ) : null}

                    <h1
                        className="edu-enter-up text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 leading-tight"
                        style={enterStyle(20, 100)}
                    >
                        {t("landing.hero.title").split(" ").slice(0, -1).join(" ")} <br />
                        <span className="text-primary">
                            {t("landing.hero.title").split(" ").slice(-1)}
                        </span>
                    </h1>

                    <p
                        className="edu-enter-up text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
                        style={enterStyle(20, 200)}
                    >
                        {t("landing.hero.description")}
                    </p>

                    <div
                        className="edu-enter-up flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
                        style={enterStyle(20, 300)}
                    >
                        <Button
                            size="lg"
                            className="w-full sm:w-auto h-14 px-8 text-base text-white hover:brightness-110 transition-all duration-300 group"
                            style={{
                                background: "var(--gradient-cta)",
                                boxShadow: "var(--eduflow-shadow-cta)",
                            }}
                            asChild
                        >
                            <Link href={isAuthenticated ? "/dashboard" : "/login"}>
                                {isAuthenticated ? t("landing.hero.dashboardCta") : t("landing.cta.access")}
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                        <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-base bg-background/50 backdrop-blur-md group" asChild>
                            <Link href="/explorer">
                                <Play className="mr-2 w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
                                {t("landing.cta.explorer")}
                            </Link>
                        </Button>
                    </div>

                    {/* La rangée « Ils nous font confiance » affichait trois sigles
                        inventés (CESM, LNB, EPEB) : fausse preuve sociale. Les
                        écoles réelles sont présentées plus bas (TestimonialsSection,
                        alimentée par /api/explorer/schools). */}
                </div>
            </div>
        </section>
    );
}
