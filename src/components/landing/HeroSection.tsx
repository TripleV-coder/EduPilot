"use client";

import { motion } from "framer-motion";
import { Canvas } from "@react-three/fiber";
import { FloatingGeometry, DataOrbs } from "@/components/three";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { t } from "@/lib/i18n";

export function HeroSection() {
    const [isMounted, setIsMounted] = useState(false);
    const [trainedStudents, setTrainedStudents] = useState<number>(0);
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";

    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydration guard
    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/explorer/overview", { cache: "no-store" });
                if (!res.ok) return;
                const data = await res.json().catch(() => null);
                if (cancelled) return;
                setTrainedStudents(Number(data?.students || 0));
            } catch {
                // silent fail: home page remains usable
            }
        })();
        return () => { cancelled = true; };
    }, []);

    return (
        <section className="relative min-h-screen pt-32 pb-20 overflow-hidden flex items-center bg-background">
            {/* Background with ThreeJS */}
            {isMounted && (
                <div className="absolute inset-0 z-0 opacity-40">
                    <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
                        <ambientLight intensity={0.5} />
                        <directionalLight position={[10, 10, 5]} intensity={1} />
                        <DataOrbs count={30} />
                        <FloatingGeometry />
                    </Canvas>
                </div>
            )}

            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-4xl mx-auto text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border/50 text-sm font-medium mb-8 shadow-sm backdrop-blur-sm"
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
                        </span>
                        {t("landing.hero.badge")}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.45, delay: 0.05 }}
                        className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5 text-xs font-semibold text-primary"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                        {t("landing.hero.trainedStudents", { count: trainedStudents.toLocaleString("fr-FR") })}
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="text-5xl md:text-7xl font-display font-bold tracking-tight mb-6 leading-tight"
                    >
                        {t("landing.hero.title").split(" ").slice(0, -1).join(" ")} <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-secondary">
                            {t("landing.hero.title").split(" ").slice(-1)}
                        </span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
                    >
                        {t("landing.hero.description")}
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                        className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
                    >
                        <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-base bg-gradient-to-r from-primary to-accent hover:shadow-lg transition-all duration-300 group text-primary-foreground" asChild>
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
                    </motion.div>

                    {/* Trust Section */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1, delay: 0.6 }}
                        className="pt-10 border-t border-border/50"
                    >
                        <p className="text-sm font-medium text-muted-foreground mb-8">{t("landing.trust")}</p>
                        <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                            <div className="flex items-center gap-2 font-display font-bold text-xl"><Sparkles className="w-5 h-5 text-primary" /> CESM</div>
                            <div className="flex items-center gap-2 font-display font-bold text-xl"><Sparkles className="w-5 h-5 text-primary" /> LNB</div>
                            <div className="flex items-center gap-2 font-display font-bold text-xl"><Sparkles className="w-5 h-5 text-primary" /> EPEB</div>
                        </div>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
