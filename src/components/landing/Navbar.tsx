"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";

export function Navbar() {
    const { status } = useSession();
    const isAuthenticated = status === "authenticated";

    return (
        <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
            <div className="container mx-auto px-6 h-20 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300">
                        <GraduationCap className="text-primary-foreground w-6 h-6" />
                    </div>
                    <span className="font-display font-bold text-xl tracking-tight">EduPilot</span>
                </Link>
                <div className="hidden md:flex items-center gap-8">
                    <Link href="/explorer" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Explorer 3D</Link>
                </div>
                <div className="flex items-center gap-4">
                    {status === "loading" ? (
                        <div className="h-9 w-[180px] rounded-md bg-muted/40 animate-pulse" />
                    ) : isAuthenticated ? (
                        <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity" asChild>
                            <Link href="/dashboard">Acceder au dashboard</Link>
                        </Button>
                    ) : (
                        <>
                            <Button variant="ghost" asChild>
                                <Link href="/login">Connexion</Link>
                            </Button>
                            <Button className="bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 transition-opacity" asChild>
                                <Link href="/setup">Configuration initiale</Link>
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </nav>
    );
}
