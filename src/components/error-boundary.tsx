"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { logger } from "@/lib/utils/logger";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    /** Lien du bouton principal (ex: "/" pour marketing, "/dashboard" pour app) */
    homeHref?: string;
    /** Libellé du bouton principal */
    homeLabel?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        try {
            if (typeof window !== "undefined") {
                logger.error("ErrorBoundary caught an error", error, {
                    module: "ErrorBoundary",
                    componentStack: errorInfo.componentStack,
                });
            }
        } catch {
            // Logger must not break error boundary
        }
        this.setState({ errorInfo });
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    private handleGoHome = () => {
        window.location.href = this.props.homeHref ?? "/dashboard";
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-[400px] flex items-center justify-center p-6">
                    <Card className="max-w-lg w-full border-destructive/50 bg-destructive/5">
                        <CardHeader className="text-center">
                            <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10">
                                <AlertTriangle className="h-8 w-8 text-destructive" />
                            </div>
                            <CardTitle className="text-destructive">
                                Une erreur est survenue
                            </CardTitle>
                            <CardDescription>
                                Nous nous excusons pour la gêne occasionnée.
                                L&apos;erreur a été enregistrée.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {process.env.NODE_ENV === "development" && this.state.error && (
                                <div className="p-3 rounded-lg bg-muted text-xs font-mono overflow-auto max-h-32">
                                    <p className="font-bold text-destructive">
                                        {this.state.error.name}: {this.state.error.message}
                                    </p>
                                    {this.state.errorInfo && (
                                        <pre className="mt-2 text-muted-foreground whitespace-pre-wrap">
                                            {this.state.errorInfo.componentStack}
                                        </pre>
                                    )}
                                </div>
                            )}
                            <div className="flex gap-3 justify-center">
                                <Button
                                    variant="outline"
                                    onClick={this.handleReset}
                                    className="gap-2"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                    Réessayer
                                </Button>
                                <Button
                                    variant="default"
                                    onClick={this.handleGoHome}
                                    className="gap-2"
                                >
                                    <Home className="h-4 w-4" />
                                    {this.props.homeLabel ?? "Tableau de bord"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
