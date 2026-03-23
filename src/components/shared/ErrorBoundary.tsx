"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCcw } from "lucide-react";

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
    name?: string;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error(`Uncaught error in ${this.props.name || "ErrorBoundary"}:`, error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-card/50 backdrop-blur-sm rounded-3xl border border-destructive/20 shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-destructive/50" />
                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
                        <AlertCircle className="w-8 h-8 text-destructive" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-3">
                        Une erreur inattendue est survenue
                    </h2>
                    <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">
                        Nous sommes désolés, une erreur technique s&apos;est produite lors du chargement de cette section. Notre équipe a été notifiée.
                    </p>
                    <Button
                        onClick={this.handleRetry}
                        className="h-12 px-8 rounded-full bg-primary hover:shadow-lg transition-all gap-2"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Réessayer maintenant
                    </Button>

                    {process.env.NODE_ENV === "development" && (
                        <div className="mt-8 p-6 bg-muted/50 rounded-2xl text-left border border-border/50 max-w-full">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Détails techniques (Dev Only)</p>
                            <p className="text-sm font-medium text-destructive leading-relaxed font-sans">
                                {this.state.error?.message}
                            </p>
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
