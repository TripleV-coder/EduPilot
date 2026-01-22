"use client";

import { QueryClient, QueryClientProvider as TanstackQueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { SessionProvider } from "next-auth/react";
import { LiteModeProvider } from "@/components/providers/lite-mode-provider";

export function QueryProvider({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,
                refetchOnWindowFocus: false,
            },
        },
    }));

    return (
        <SessionProvider>
            <TanstackQueryClientProvider client={queryClient}>
                <LiteModeProvider>
                    {children}
                </LiteModeProvider>
            </TanstackQueryClientProvider>
        </SessionProvider>
    );
}
