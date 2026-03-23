"use client";

import { SWRConfig } from "swr";
import { fetcher } from "@/lib/fetcher";

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        // Perf: évite les rafales de requêtes identiques lors des rerenders/navigations.
        dedupingInterval: 10_000,
        // UX/perf: pas de refetch automatique au focus (déjà géré ponctuellement par pages).
        revalidateOnFocus: false,
        revalidateOnReconnect: true,
        // Evite de taper le réseau “pour rien” quand la page est en arrière-plan.
        refreshWhenHidden: false,
        refreshWhenOffline: false,
        // Robustesse: retries limités et backoff.
        errorRetryCount: 2,
        errorRetryInterval: 1500,
        shouldRetryOnError: (err) => {
          const message = (err as Error | undefined)?.message ?? "";
          // Ne pas retry si c'est clairement un refus d'accès/erreur logique.
          return !/Accès refusé|Non authentifié|MFA_REQUIRED/i.test(message);
        },
        // On garde une UI réactive en évitant des revalidations agressives.
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}

