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
        <div className="min-h-screen bg-white font-sans text-zinc-900 selection:bg-blue-100">
            {/* Header Overlay */}
            <header className="fixed top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-xl">
                <div className="container flex h-16 items-center justify-between px-4">
                    <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-zinc-900">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                                EP
                            </div>
                            EduPilot
                        </Link>
                    </div>
                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-600">
                        <Link href="/#features" className="hover:text-blue-600 transition-colors">Fonctionnalités</Link>
                        <Link href="/#pricing" className="hover:text-blue-600 transition-colors">Tarifs</Link>
                        <Link href="/contact" className="text-blue-600 font-semibold transition-colors">Contact</Link>
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

            <main className="pt-32 pb-20">
                <div className="container px-4 md:px-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center mb-16"
                    >
                        <Link href="/" className="inline-flex items-center text-zinc-500 hover:text-blue-600 mb-6 transition-colors">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Retour à l'accueil
                        </Link>
                        <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                            Contactez-nous
                        </h1>
                        <p className="text-xl text-zinc-500 max-w-2xl mx-auto">
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
                            <Card className="p-8 border-zinc-200 bg-blue-50/50 backdrop-blur-sm">
                                <h2 className="text-2xl font-bold mb-6 text-zinc-900">Nos Coordonnées</h2>
                                <div className="space-y-6">
                                    <div className="flex items-start">
                                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 mr-4">
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-zinc-900">Email</h3>
                                            <p className="text-zinc-500 mb-1">Notre équipe répond sous 24h.</p>
                                            <a href="mailto:contact@edupilot.bj" className="text-blue-600 hover:underline font-medium">contact@edupilot.bj</a>
                                        </div>
                                    </div>

                                    <div className="flex items-start">
                                        <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0 mr-4">
                                            <Phone className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-zinc-900">Téléphone</h3>
                                            <p className="text-zinc-500 mb-1">Du Lundi au Vendredi, 8h-18h.</p>
                                            <a href="tel:+22901234567" className="text-blue-600 hover:underline font-medium">+229 01 23 45 67</a>
                                        </div>
                                    </div>

                                    <div className="flex items-start">
                                        <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0 mr-4">
                                            <MapPin className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-zinc-900">Siège Social</h3>
                                            <p className="text-zinc-500">
                                                Cotonou, Bénin<br />
                                                Quartier Haie Vive, Rue 345
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            <Card className="p-8 border-zinc-200 bg-zinc-50 text-center">
                                <h3 className="text-lg font-semibold mb-2">Support Technique</h3>
                                <p className="text-zinc-500 mb-4">
                                    Vous êtes déjà client et rencontrez un problème ?
                                </p>
                                <Button variant="outline" className="w-full bg-white">
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
                            <Card className="p-8 border-zinc-200 shadow-xl shadow-blue-500/5 bg-white">
                                <h2 className="text-2xl font-bold mb-2">Envoyez-nous un message</h2>
                                <p className="text-zinc-500 mb-8">Remplissez ce formulaire et nous vous recontacterons rapidement.</p>

                                <form className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-700">Nom</label>
                                            <Input placeholder="Votre nom" className="bg-zinc-50 border-zinc-200 focus:ring-blue-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-zinc-700">Prénom</label>
                                            <Input placeholder="Votre prénom" className="bg-zinc-50 border-zinc-200 focus:ring-blue-500" />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700">Email professionnel</label>
                                        <Input type="email" placeholder="nom@ecole.com" className="bg-zinc-50 border-zinc-200 focus:ring-blue-500" />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700">Sujet</label>
                                        <select className="flex h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                            <option>Demande de démo</option>
                                            <option>Question sur les tarifs</option>
                                            <option>Partenariat</option>
                                            <option>Autre</option>
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700">Message</label>
                                        <Textarea placeholder="Comment pouvons-nous vous aider ?" className="min-h-[120px] bg-zinc-50 border-zinc-200 focus:ring-blue-500" />
                                    </div>

                                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-lg">
                                        Envoyer le message
                                        <Send className="ml-2 h-4 w-4" />
                                    </Button>
                                </form>
                            </Card>
                        </motion.div>
                    </div>
                </div>
            </main>

            <footer className="border-t border-zinc-200 bg-zinc-50 py-12 text-center text-zinc-500">
                <div className="container">
                    <p>&copy; 2026 EduPilot. Fait avec passion pour l'éducation en Afrique.</p>
                </div>
            </footer>
        </div>
    );
}
