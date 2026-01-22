"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Sparkles, GraduationCap, BarChart3, ShieldCheck } from "lucide-react";

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const features = [
        {
            icon: <Sparkles className="h-6 w-6 text-yellow-300" />,
            title: "IA Éducative Avancée",
            desc: "Analysez les performances et prédisez les résultats avec notre moteur d'IA de pointe."
        },
        {
            icon: <GraduationCap className="h-6 w-6 text-blue-300" />,
            title: "Standards Béninois",
            desc: "Système de notes et coefficients 100% adapté au système éducatif du Bénin."
        },
        {
            icon: <BarChart3 className="h-6 w-6 text-green-300" />,
            title: "Analytique Temps Réel",
            desc: "Suivez les absences, les retards et la progression académique en un coup d'œil."
        },
        {
            icon: <ShieldCheck className="h-6 w-6 text-purple-300" />,
            title: "Sécurité Maximale",
            desc: "Vos données sont chiffrées et protégées avec les meilleurs standards de l'industrie."
        }
    ];

    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % features.length);
        }, 5000);
        return () => clearInterval(timer);
    }, [features.length]);

    return (
        <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0 overflow-hidden">
            <div className="relative hidden h-full flex-col bg-zinc-900 p-10 text-white lg:flex dark:border-r overflow-hidden">
                {/* Animated Background Mesh */}
                <div className="absolute inset-0 bg-zinc-900">
                    <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-blue-600/20 blur-[100px] animate-pulse" />
                    <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-purple-600/20 blur-[100px] animate-pulse delay-1000" />
                    <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
                </div>

                {/* Glassmorphic Overlay for depth */}
                <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />

                <div className="relative z-20 flex items-center gap-3 text-lg font-medium">
                    <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center font-bold shadow-lg ring-1 ring-white/20">
                        EP
                    </div>
                    <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">
                        EduPilot
                    </span>
                </div>

                <div className="relative z-20 m-auto w-full max-w-lg">
                    <div className="relative h-[350px] w-full">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -30, scale: 0.95 }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className="absolute inset-0 flex flex-col items-center text-center p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl w-full"
                            >
                                <div className="p-4 bg-white/10 rounded-2xl mb-6 shadow-inner ring-1 ring-white/5">
                                    {features[currentIndex].icon}
                                </div>
                                <h3 className="text-2xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/90">
                                    {features[currentIndex].title}
                                </h3>
                                <p className="text-zinc-300 leading-relaxed text-base max-w-[90%] mx-auto">
                                    {features[currentIndex].desc}
                                </p>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Progress Indicators */}
                    <div className="flex justify-center gap-2 mt-8">
                        {features.map((_, idx) => (
                            <div
                                key={idx}
                                className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? "w-8 bg-blue-500" : "w-1.5 bg-white/20"
                                    }`}
                            />
                        ))}
                    </div>
                </div>

                <div className="relative z-20 mt-auto flex justify-between items-center text-sm text-zinc-400">
                    <p>&copy; 2026 EduPilot Inc.</p>
                    <div className="flex gap-4">
                        <a href="#" className="hover:text-white transition-colors">Confidentialité</a>
                        <a href="#" className="hover:text-white transition-colors">Termes</a>
                    </div>
                </div>
            </div>

            <div className="lg:p-8 bg-background relative">
                {/* Subtle right side decoration */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px] relative z-10">
                    {children}
                </div>
            </div>
        </div>
    )
}
