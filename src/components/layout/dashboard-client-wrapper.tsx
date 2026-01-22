"use client";

import { ErrorBoundary } from "@/components/error-boundary";
import { ReactNode } from "react";

interface ClientWrapperProps {
    children: ReactNode;
}

/**
 * Client wrapper component that provides Error Boundary protection
 * for the dashboard content.
 */
export function DashboardClientWrapper({ children }: ClientWrapperProps) {
    return (
        <ErrorBoundary>
            {children}
        </ErrorBoundary>
    );
}
