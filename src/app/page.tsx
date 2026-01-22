"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, LayoutDashboard, Shield, Users, Sparkles, Check, School, BrainCircuit, BarChart3, GraduationCap, Wallet, BookOpen, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Components ---

function HeroSection() {
    return (
        <section className="relative overflow-hidden min-h-[90vh] flex items-center justify-center bg-white text-zinc-900">
            {/* Animated Background Mesh - Adjusted for Light Mode */}
            <div className="absolute inset-0 bg-white">
                <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-blue-100/50 blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-purple-100/50 blur-[120px] animate-pulse delay-1000" />
                <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-[0.05]" />
            </div>

            <div className="container relative z-10 px-4 md:px-6 flex flex-col items-center text-center">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-medium text-blue-600 mb-8 backdrop-blur-md"
                >
                    <Sparkles className="mr-2 h-4 w-4 text-yellow-500" />
                    La Révolution Scolaire v2.0 est arrivée
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-zinc-900 via-zinc-800 to-zinc-500 max-w-5xl mx-auto"
                >
                    Gérez votre école avec <span className="text-blue-600 inline-block">Excellence</span>
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="text-lg md:text-2xl text-zinc-600 max-w-3xl mx-auto mb-10 leading-relaxed"
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
                        <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105">
                            Commencer Gratuitement
                            <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </Link>
                    <Link href="/login">
                        <Button variant="outline" size="lg" className="h-14 px-8 text-lg rounded-full border-zinc-200 bg-white/50 text-zinc-900 hover:bg-zinc-50 backdrop-blur-sm transition-all hover:scale-105">
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
                    <div className="relative rounded-xl border border-zinc-200 bg-white/50 backdrop-blur-xl aspect-[16/9] shadow-2xl overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-100/30 to-purple-100/30 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Abstract UI Elements */}
                        <div className="absolute inset-0 p-8 flex gap-8">
                            <div className="w-1/5 h-full rounded-lg bg-zinc-100 border border-zinc-200 animate-pulse" />
                            <div className="flex-1 h-full flex flex-col gap-6">
                                <div className="h-32 w-full rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-zinc-200" />
                                <div className="flex-1 grid grid-cols-3 gap-6">
                                    <div className="rounded-lg bg-zinc-100 border border-zinc-200" />
                                    <div className="rounded-lg bg-zinc-100 border border-zinc-200" />
                                    <div className="rounded-lg bg-zinc-100 border border-zinc-200" />
                                </div>
                            </div>
                        </div>

                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span className="bg-white/80 backdrop-blur-md px-6 py-3 rounded-full text-sm font-medium border border-zinc-200 text-zinc-900 shadow-sm">
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
        <section className="py-32 bg-white text-zinc-900 relative">
            <div className="container px-4 md:px-6">
                <div className="text-center mb-20">
                    <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-6">
                        Tout ce dont vous avez besoin
                    </h2>
                    <p className="text-zinc-500 text-xl max-w-2xl mx-auto">
                        EduPilot remplace 10 outils différents par une seule plateforme unifiée et performante.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto">
                    {/* Large Card Left */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="md:col-span-2 row-span-2 rounded-3xl p-8 bg-zinc-50/50 border border-zinc-200 backdrop-blur-sm relative overflow-hidden group hover:shadow-lg transition-all"
                    >
                        <div className="absolute top-0 right-0 p-10 opacity-[0.05] group-hover:opacity-10 transition-opacity">
                            <BrainCircuit size={300} className="text-zinc-900" />
                        </div>
                        <div className="relative z-10">
                            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center mb-6">
                                <Sparkles className="text-blue-600" />
                            </div>
                            <h3 className="text-3xl font-bold mb-4">Intelligence Artificielle</h3>
                            <p className="text-zinc-600 text-lg mb-8 max-w-md">
                                Analysez les performances scolaires, détectez les élèves en difficulté et générez des rapports automatiques grâce à notre moteur IA exclusif.
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-center text-zinc-700">
                                    <Check className="mr-3 h-5 w-5 text-blue-600" /> Prédictions de réussite aux examens
                                </li>
                                <li className="flex items-center text-zinc-700">
                                    <Check className="mr-3 h-5 w-5 text-blue-600" /> Suggestions pédagogiques personnalisées
                                </li>
                                <li className="flex items-center text-zinc-700">
                                    <Check className="mr-3 h-5 w-5 text-blue-600" /> Chatbot assistant pour les enseignants
                                </li>
                            </ul>
                        </div>
                    </motion.div>

                    {/* Small Card Top Right - Vie Scolaire */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-zinc-50/50 border border-zinc-200 backdrop-blur-sm hover:shadow-lg transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center mb-6">
                            <School className="text-purple-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Vie Scolaire</h3>
                        <p className="text-zinc-600">
                            Gestion des absences, retards et sanctions en temps réel avec notifications aux parents.
                        </p>
                    </motion.div>

                    {/* Small Card Bottom Right - Notes */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-zinc-50/50 border border-zinc-200 backdrop-blur-sm hover:shadow-lg transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center mb-6">
                            <GraduationCap className="text-green-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Notes & Bulletins</h3>
                        <p className="text-zinc-600">
                            Calcul automatique des moyennes et génération des bulletins aux standards Béninois.
                        </p>
                    </motion.div>

                    {/* Row 2 - Card 1 - Finance */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-zinc-50/50 border border-zinc-200 backdrop-blur-sm hover:shadow-lg transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-yellow-100 flex items-center justify-center mb-6">
                            <Wallet className="text-yellow-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Finance & Paiements</h3>
                        <p className="text-zinc-600">
                            Suivi des scolarités et intégration des paiements mobiles (MTN/Moov).
                        </p>
                    </motion.div>

                    {/* Row 2 - Card 2 - Bibliothèque */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-zinc-50/50 border border-zinc-200 backdrop-blur-sm hover:shadow-lg transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-red-100 flex items-center justify-center mb-6">
                            <BookOpen className="text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Bibliothèque</h3>
                        <p className="text-zinc-600">
                            Gestion des emprunts et catalogue numérique des ouvrages scolaires.
                        </p>
                    </motion.div>

                    {/* Row 2 - Card 3 - Communication */}
                    <motion.div
                        whileHover={{ y: -5 }}
                        className="rounded-3xl p-8 bg-zinc-50/50 border border-zinc-200 backdrop-blur-sm hover:shadow-lg transition-all"
                    >
                        <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center mb-6">
                            <MessageCircle className="text-orange-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">Communication</h3>
                        <p className="text-zinc-600">
                            Messagerie instantanée et alertes SMS/WhatsApp pour les parents.
                        </p>
                    </motion.div>
                </div>
            </div>
        </section>
    )
}

function PricingCard({ title, price, features, recommended = false }: any) {
    return (
        <Card className={cn(
            "relative p-8 rounded-3xl border transition-all duration-300 hover:scale-105",
            recommended
                ? "bg-blue-600 border-blue-500 shadow-2xl shadow-blue-500/20 scale-105 z-10"
                : "bg-white border-zinc-200 text-zinc-900 hover:border-blue-200 hover:shadow-lg"
        )}>
            {recommended && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg">
                    RECOMMANDÉ
                </div>
            )}
            <div className="mb-6">
                <h3 className={`text-xl font-bold ${recommended ? 'text-white' : 'text-zinc-900'}`}>{title}</h3>
                <div className="mt-4 flex items-baseline">
                    <span className={`text-4xl font-black ${recommended ? 'text-white' : 'text-zinc-900'}`}>{price}</span>
                    <span className={`ml-2 text-sm ${recommended ? 'text-blue-100' : 'text-zinc-500'}`}>/ mois</span>
                </div>
            </div>
            <ul className="space-y-4 mb-8">
                {features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start">
                        <Check className={`mr-3 h-5 w-5 shrink-0 ${recommended ? 'text-white' : 'text-blue-600'}`} />
                        <span className={recommended ? 'text-blue-50' : 'text-zinc-600'}>{feature}</span>
                    </li>
                ))}
            </ul>
            <Button className={cn(
                "w-full h-12 rounded-xl text-base font-semibold",
                recommended
                    ? "bg-white text-blue-600 hover:bg-blue-50"
                    : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
            )}>
                Choisir {title}
            </Button>
        </Card>
    )
}

// --- Main Page Component ---

export default function Home() {
    return (
        <div className="min-h-screen bg-white font-sans selection:bg-blue-100 text-zinc-900">
            {/* Header Overlay */}
            <header className="fixed top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-xl">
                <div className="container flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-zinc-900">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                            EP
                        </div>
                        EduPilot
                    </div>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-600">
                        <Link href="#features" className="hover:text-blue-600 transition-colors">Fonctionnalités</Link>
                        <Link href="#pricing" className="hover:text-blue-600 transition-colors">Tarifs</Link>
                        <Link href="/contact" className="hover:text-blue-600 transition-colors">Contact</Link>
                    </nav>
                    <div className="flex items-center gap-4">
                        <Link href="/login">
                            <Button variant="ghost" className="text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100">Connexion</Button>
                        </Link>
                        <Link href="/register">
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6">Commencer</Button>
                        </Link>
                    </div>
                </div>
            </header>

            <main>
                <HeroSection />
                <FeatureBentoGrid />

                {/* Pricing Section */}
                <section id="pricing" className="py-32 bg-zinc-50 border-t border-zinc-200">
                    <div className="container px-4 md:px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl md:text-5xl font-bold text-zinc-900 mb-4">Investissez dans l'excellence</h2>
                            <p className="text-zinc-500 text-lg">Des tarifs adaptés pour chaque établissement.</p>
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
                <section className="py-32 bg-white relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-50/50" />
                    <div className="container relative z-10 text-center">
                        <h2 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-8">Prêt à transformer votre école ?</h2>
                        <div className="flex justify-center gap-4">
                            <Link href="/register">
                                <Button size="lg" className="h-16 px-10 text-xl rounded-full bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-500/20">
                                    Créer un compte maintenant
                                </Button>
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-zinc-200 bg-white py-12 text-center text-zinc-500">
                <div className="container">
                    <p>&copy; 2026 EduPilot. Fait avec passion pour l'éducation en Afrique.</p>
                </div>
            </footer>
        </div>
    );
}
