"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin, Send, ArrowLeft } from "lucide-react";

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-apogee-abyss font-sans text-white selection:bg-apogee-cobalt/30">
            {/* Header Overlay */}
            <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-apogee-abyss/80 backdrop-blur-xl">
                <div className="container flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-apogee-cobalt to-apogee-emerald flex items-center justify-center text-white shadow-[0_10px_25px_rgba(30,60,140,0.45)]">
                                EP
                            </div>
                            EduPilot
                        </Link>
                    </div>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-apogee-metal/70">
                        <Link href="/#features" className="hover:text-white transition-colors">Fonctionnalités</Link>
                        <Link href="/#pricing" className="hover:text-white transition-colors">Tarifs</Link>
                        <Link href="/contact" className="text-apogee-gold font-semibold transition-colors">Contact</Link>
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

            <main className="pt-32 pb-20">
                <div className="container px-4 md:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <Link href="/" className="inline-flex items-center text-apogee-metal/70 hover:text-apogee-gold mb-6 transition-colors">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Retour à l'accueil
                        </Link>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-apogee-gold to-apogee-cobalt">
                            Contactez-nous
                        </h1>
                        <p className="text-xl text-apogee-metal/70 max-w-2xl mx-auto">
                            Une question sur EduPilot ? Besoin d'une démo personnalisée ?
                            Notre équipe est là pour vous accompagner.
                        </p>
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
                        {/* Contact Info */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className="space-y-8"
                        >
                            <Card className="p-8 border-white/10 bg-apogee-abyss/70 backdrop-blur-sm">
                                <h2 className="text-2xl font-bold mb-6 text-white">Nos Coordonnées</h2>
                                <div className="space-y-6">
                                    <div className="flex items-start">
                                        <div className="h-10 w-10 rounded-full bg-apogee-cobalt/20 flex items-center justify-center text-apogee-cobalt shrink-0 mr-4">
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">Email</h3>
                                            <p className="text-apogee-metal/70 mb-1">Notre équipe répond sous 24h.</p>
                                            <a href="mailto:contact@edupilot.bj" className="text-apogee-gold hover:underline font-medium">contact@edupilot.bj</a>
                                        </div>
                                    </div>

                                    <div className="flex items-start">
                                        <div className="h-10 w-10 rounded-full bg-apogee-emerald/20 flex items-center justify-center text-apogee-emerald shrink-0 mr-4">
                                            <Phone className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">Téléphone</h3>
                                            <p className="text-apogee-metal/70 mb-1">Du Lundi au Vendredi, 8h-18h.</p>
                                            <a href="tel:+22901234567" className="text-apogee-gold hover:underline font-medium">+229 01 23 45 67</a>
                                        </div>
                                    </div>

                                    <div className="flex items-start">
                                        <div className="h-10 w-10 rounded-full bg-apogee-gold/20 flex items-center justify-center text-apogee-gold shrink-0 mr-4">
                                            <MapPin className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">Siège Social</h3>
                                            <p className="text-apogee-metal/70">
                                                Cotonou, Bénin<br />
                                                Quartier Haie Vive, Rue 345
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-8 border-white/10 bg-apogee-abyss/70 text-center">
                                <h3 className="text-lg font-semibold mb-2">Support Technique</h3>
                                <p className="text-apogee-metal/70 mb-4">
                                    Vous êtes déjà client et rencontrez un problème ?
                                </p>
                                <Button variant="outline" className="w-full">
                                    Accéder au Centre d'Aide
                                </Button>
                            </Card>
                        </motion.div>

                        {/* Contact Form */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                        >
                            <Card className="p-8 border-white/10 shadow-[0_25px_60px_rgba(4,8,18,0.55)] bg-apogee-abyss/80">
                                <h2 className="text-2xl font-bold mb-2 text-white">Envoyez-nous un message</h2>
                                <p className="text-apogee-metal/70 mb-8">Remplissez ce formulaire et nous vous recontacterons rapidement.</p>

                                <form className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-apogee-metal/80">Nom</label>
                                            <Input placeholder="Votre nom" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-apogee-metal/80">Prénom</label>
                                            <Input placeholder="Votre prénom" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-apogee-metal/80">Email professionnel</label>
                                        <Input type="email" placeholder="nom@ecole.com" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-apogee-metal/80">Sujet</label>
                                        <select className="flex h-10 w-full rounded-md border border-white/10 bg-apogee-abyss/70 px-3 py-2 text-sm text-white ring-offset-apogee-abyss placeholder:text-apogee-metal/60 focus:outline-none focus:ring-2 focus:ring-apogee-cobalt/60 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                            <option>Demande de démo</option>
                                            <option>Question sur les tarifs</option>
                                            <option>Partenariat</option>
                                            <option>Autre</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-apogee-metal/80">Message</label>
                                        <Textarea placeholder="Comment pouvons-nous vous aider ?" className="min-h-[120px]" />
                                    </div>

                                    <Button className="w-full h-12 text-lg">
                                        Envoyer le message
                                        <Send className="ml-2 h-4 w-4" />
                                    </Button>
                                </form>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </main>

            <footer className="border-t border-white/10 bg-apogee-abyss py-12 text-center text-apogee-metal/60">
                <div className="container">
                    <p>&copy; 2026 EduPilot. Fait avec passion pour l'éducation en Afrique.</p>
                </div>
            </footer>
        </div>
    );
}
