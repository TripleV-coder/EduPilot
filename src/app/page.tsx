"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Sparkles, Check, School, BrainCircuit, GraduationCap, Wallet, BookOpen, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Components ---

function HeroSection() {
    return (
        <section className="relative overflow-hidden min-h-[90vh] flex items-center justify-center bg-apogee-abyss text-white">
            {/* Animated Background Mesh - Adjusted for Light Mode */}
            <div className="absolute inset-0 bg-apogee-abyss">
                <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-apogee-cobalt/25 blur-[140px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-apogee-emerald/20 blur-[140px] animate-pulse delay-1000" />
                <div className="absolute inset-0 apogee-grid opacity-[0.35]" />
            </div>

            <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-apogee-metal/80 mb-8 backdrop-blur-md"
                >
                    <Sparkles className="mr-2 h-4 w-4 text-apogee-gold" />
                    La Révolution Scolaire v2.0 est arrivée
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white via-apogee-metal/80 to-apogee-metal/40 max-w-5xl mx-auto"
                >
                    Gérez votre école avec <span className="text-apogee-gold inline-block">Excellence</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-lg md:text-2xl text-apogee-metal/70 max-w-3xl mx-auto mb-10 leading-relaxed"
                >
                    La plateforme tout-en-un qui unifie administration, pédagogie et communication.
                    Conçue spécifiquement pour le système éducatif béninois.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="flex flex-col sm:flex-row gap-4 w-full justify-center"
                >
                    <Link href="/register">
                        <Button size="lg" className="h-14 px-8 text-lg rounded-full shadow-[0_18px_45px_rgba(30,60,140,0.45)] transition-all hover:scale-105">
                            Commencer Gratuitement
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </Link>
                    <Link href="/login">
                        <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full border-white/20 text-white/90 hover:bg-white/10 backdrop-blur-sm transition-all hover:scale-105">
                            Se connecter
                        </Button>
                    </Link>
                </motion.div>

                {/* Hero Dashboard Preview (Abstract) */}
                <motion.div
                    initial={{ opacity: 0, y: 50, rotateX: 20 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ duration: 1, delay: 0.6 }}
                    className="mt-20 w-full max-w-6xl mx-auto perspective-1000"
                >
                    <div className="relative rounded-xl border border-white/10 bg-apogee-abyss/60 backdrop-blur-xl aspect-[16/9] shadow-[0_30px_80px_rgba(4,8,18,0.6)] overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-apogee-cobalt/20 to-apogee-emerald/20 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Abstract UI Elements */}
                        <div className="absolute inset-0 p-8 flex gap-8">
                            <div className="w-1/5 h-full rounded-lg bg-white/5 border border-white/10 animate-pulse" />
                            <div className="flex-1 h-full flex flex-col gap-6">
                                <div className="h-32 w-full rounded-lg bg-gradient-to-r from-apogee-cobalt/10 to-apogee-emerald/10 border border-white/10" />
                                <div className="flex-1 grid grid-cols-3 gap-6">
                                    <div className="rounded-lg bg-white/5 border border-white/10" />
                                    <div className="rounded-lg bg-white/5 border border-white/10" />
                                    <div className="rounded-lg bg-white/5 border border-white/10" />
                                </div>
                            </div>
                        </div>

                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="bg-apogee-abyss/80 backdrop-blur-md px-6 py-3 rounded-full text-sm font-medium border border-white/10 text-white shadow-sm">
                                Interface Dashboard Simplifiée
                            </span>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

function FeatureBentoGrid() {
    return (
        <section className="py-32 bg-apogee-abyss text-white relative" id="features">
            <div className="container px-4 md:px-6">
                <div className="text-center mb-20">
                    <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-apogee-gold to-apogee-cobalt mb-6">
                        Tout ce dont vous avez besoin
                    </h2>
                    <p className="text-apogee-metal/70 text-xl max-w-2xl mx-auto">
                        EduPilot remplace 10 outils différents par une seule plateforme unifiée et performante.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
                    {/* Large Card Left */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="md:col-span-2 row-span-2 rounded-3xl p-8 bg-apogee-abyss/70 border border-white/10 backdrop-blur-sm relative overflow-hidden group hover:shadow-[0_25px_60px_rgba(4,8,18,0.6)] transition-all"
                    >
                        <div className="absolute top-0 right-0 p-10 opacity-[0.08] group-hover:opacity-15 transition-opacity">
                            <BrainCircuit size={300} className="text-white" />
                        </div>
                        <div className="relative z-10">
                            <div className="h-12 w-12 rounded-xl bg-apogee-cobalt/20 flex items-center justify-center mb-6">
                                <Sparkles className="text-apogee-cobalt" />
                            </div>
                            <h3 className="text-3xl font-bold mb-4">Intelligence Artificielle</h3>
                            <p className="text-apogee-metal/70 text-lg mb-8 max-w-md">
                                Analysez les performances scolaires, détectez les élèves en difficulté et générez des rapports automatiques grâce à notre moteur IA exclusif.
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-center text-apogee-metal/80">
                                    <Check className="mr-3 h-5 w-5 text-apogee-gold" /> Prédictions de réussite aux examens
                                </li>
                                <li className="flex items-center text-apogee-metal/80">
                                    <Check className="mr-3 h-5 w-5 text-apogee-gold" /> Suggestions pédagogiques personnalisées
                                </li>
                                <li className="flex items-center text-apogee-metal/80">
                                    <Check className="mr-3 h-5 w-5 text-apogee-gold" /> Chatbot assistant pour les enseignants
                                </li>
                            </ul>
                        </div>
                    </motion.div>

                    {/* Small Card Top Right - Vie Scolaire */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-apogee-abyss/70 border border-white/10 backdrop-blur-sm hover:shadow-[0_20px_50px_rgba(4,8,18,0.6)] transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-apogee-emerald/20 flex items-center justify-center mb-6">
                            <School className="text-apogee-emerald" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Vie Scolaire</h3>
                        <p className="text-apogee-metal/70">
                            Gestion des absences, retards et sanctions en temps réel avec notifications aux parents.
                        </p>
                    </motion.div>

                    {/* Small Card Bottom Right - Notes */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-apogee-abyss/70 border border-white/10 backdrop-blur-sm hover:shadow-[0_20px_50px_rgba(4,8,18,0.6)] transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-apogee-gold/20 flex items-center justify-center mb-6">
                            <GraduationCap className="text-apogee-gold" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Notes & Bulletins</h3>
                        <p className="text-apogee-metal/70">
                            Calcul automatique des moyennes et génération des bulletins aux standards Béninois.
                        </p>
                    </motion.div>

                    {/* Row 2 - Card 1 - Finance */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-apogee-abyss/70 border border-white/10 backdrop-blur-sm hover:shadow-[0_20px_50px_rgba(4,8,18,0.6)] transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-apogee-gold/20 flex items-center justify-center mb-6">
                            <Wallet className="text-apogee-gold" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Finance & Paiements</h3>
                        <p className="text-apogee-metal/70">
                            Suivi des scolarités et intégration des paiements mobiles (MTN/Moov).
                        </p>
                    </motion.div>

                    {/* Row 2 - Card 2 - Bibliothèque */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-apogee-abyss/70 border border-white/10 backdrop-blur-sm hover:shadow-[0_20px_50px_rgba(4,8,18,0.6)] transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-apogee-crimson/20 flex items-center justify-center mb-6">
                            <BookOpen className="text-apogee-crimson" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Bibliothèque</h3>
                        <p className="text-apogee-metal/70">
                            Gestion des emprunts et catalogue numérique des ouvrages scolaires.
                        </p>
                    </motion.div>

                    {/* Row 2 - Card 3 - Communication */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-apogee-abyss/70 border border-white/10 backdrop-blur-sm hover:shadow-[0_20px_50px_rgba(4,8,18,0.6)] transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-apogee-cobalt/20 flex items-center justify-center mb-6">
                            <MessageCircle className="text-apogee-cobalt" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Communication</h3>
                        <p className="text-apogee-metal/70">
                            Messagerie instantanée et alertes SMS/WhatsApp pour les parents.
                        </p>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

interface PricingCardProps {
    title: string;
    price: string;
    features: string[];
    recommended?: boolean;
}

function PricingCard({ title, price, features, recommended = false }: PricingCardProps) {
    return (
        <Card className={cn(
            "relative p-8 rounded-3xl border transition-all duration-300 hover:scale-105",
            recommended
                ? "bg-gradient-to-br from-apogee-cobalt/90 to-apogee-emerald/90 border-apogee-gold/40 shadow-[0_30px_80px_rgba(30,60,140,0.5)] scale-105 z-10"
                : "bg-apogee-abyss/70 border-white/10 text-white hover:border-apogee-cobalt/40 hover:shadow-[0_20px_50px_rgba(4,8,18,0.6)]"
        )}>
            {recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-apogee-gold to-apogee-cobalt text-white px-4 py-1 rounded-full text-sm font-bold shadow-[0_12px_30px_rgba(247,199,107,0.45)]">
                    RECOMMANDÉ
                </div>
            )}
            <div className="mb-6">
                <h3 className={`text-xl font-bold ${recommended ? 'text-white' : 'text-white'}`}>{title}</h3>
                <div className="mt-4 flex items-baseline">
                    <span className={`text-4xl font-black ${recommended ? 'text-white' : 'text-white'}`}>{price}</span>
                    <span className={`ml-2 text-sm ${recommended ? 'text-white/70' : 'text-apogee-metal/70'}`}>/ mois</span>
                </div>
            </div>
            <ul className="space-y-4 mb-8">
                {features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start">
                        <Check className={`mr-3 h-5 w-5 shrink-0 ${recommended ? 'text-white' : 'text-apogee-gold'}`} />
                        <span className={recommended ? 'text-white/90' : 'text-apogee-metal/70'}>{feature}</span>
                    </li>
                ))}
            </ul>
            <Button
                variant={recommended ? "default" : "outline"}
                className="w-full h-12 rounded-xl text-base font-semibold"
            >
                Choisir {title}
            </Button>
        </Card>
    )
}

// --- Main Page Component ---

export default function Home() {
    return (
        <div className="min-h-screen bg-apogee-abyss font-sans selection:bg-apogee-cobalt/30 text-white">
            {/* Header Overlay */}
            <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-apogee-abyss/80 backdrop-blur-xl">
                <div className="container flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-apogee-cobalt to-apogee-emerald flex items-center justify-center text-white shadow-[0_10px_25px_rgba(30,60,140,0.45)]">
                            EP
                        </div>
                        EduPilot
                    </div>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-apogee-metal/70">
                        <Link href="#features" className="hover:text-white transition-colors">Fonctionnalités</Link>
                        <Link href="#pricing" className="hover:text-white transition-colors">Tarifs</Link>
                        <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link href="/login">
                            <Button variant="ghost" className="text-apogee-metal/70 hover:text-white hover:bg-white/10">Connexion</Button>
                        </Link>
                        <Link href="/register">
                            <Button className="rounded-full px-6">Commencer</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                <HeroSection />
                <FeatureBentoGrid />

                {/* Pricing Section */}
                <section id="pricing" className="py-32 bg-apogee-abyss/80 border-t border-white/10">
                    <div className="container px-4 md:px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Investissez dans l'excellence</h2>
                            <p className="text-apogee-metal/70 text-lg">Des tarifs adaptés pour chaque établissement.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto items-center">
                            <PricingCard
                                title="Starter"
                                price="0 FCFA"
                                features={[
                                    "Jusqu'à 50 élèves",
                                    "Gestion des notes de base",
                                    "Bulletins PDF simples",
                                    "Support par email"
                                ]}
                            />
                            <PricingCard
                                title="Pro"
                                price="50.000 FCFA"
                                recommended={true}
                                features={[
                                    "Jusqu'à 500 élèves",
                                    "Module IA (Analyse basique)",
                                    "Espace Parents & Élèves",
                                    "Gestion financière",
                                    "Support prioritaire 7j/7"
                                ]}
                            />
                            <PricingCard
                                title="Entreprise"
                                price="Sur Devis"
                                features={[
                                    "Élèves illimités",
                                    "Module IA Avancé & Prédictions",
                                    "API & Intégrations sur mesure",
                                    "Formation sur site incluse",
                                    "Manager de compte dédié"
                                ]}
                            />
                        </div>
                    </div>
                </section>

                {/* Final CTA */}
                <section className="py-32 bg-apogee-abyss relative overflow-hidden">
                    <div className="absolute inset-0 bg-apogee-cobalt/10" />
                    <div className="container relative z-10 text-center">
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">Prêt à transformer votre école ?</h2>
                        <div className="flex justify-center gap-4">
                            <Link href="/register">
                                <Button size="lg" className="h-16 px-10 text-xl rounded-full shadow-[0_20px_50px_rgba(30,60,140,0.5)]">
                                    Créer un compte maintenant
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/10 bg-apogee-abyss py-12 text-center text-apogee-metal/60">
                <div className="container">
                    <p>&copy; 2026 EduPilot. Fait avec passion pour l'éducation en Afrique.</p>
                </div>
            </footer>
        </div>
    );
}
