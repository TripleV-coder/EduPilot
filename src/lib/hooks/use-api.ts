"use client";

import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "@/lib/api/client";

type UseApiOptions = {
  immediate?: boolean;
  /** Timeout ms (default 30s) */
  timeout?: number;
  /** Retries on 5xx or network (default 2) */
  retries?: number;
};

export function useApi<T>(url: string | null, options: UseApiOptions = {}) {
  const { immediate = true, timeout, retries } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(immediate && !!url);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const fetchData = useCallback(
    async (overrideUrl?: string) => {
      const target = overrideUrl ?? url;
      if (!target) return;
      setLoading(true);
      setError(null);
      try {
        const { data: json, requestId: rid } = await apiFetch<T>(target, {
          credentials: "include",
          timeout,
          retries,
        });
        setData(json);
        setRequestId(rid);
        return json;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Erreur réseau";
        setError(message);
        setData(null);
        const err = e as Error & { requestId?: string };
        if (err.requestId) setRequestId(err.requestId);
      } finally {
        setLoading(false);
      }
    },
    [url, timeout, retries]
  );

  useEffect(() => {
    if (immediate && url) {
      fetchData();
    }
  }, [url, immediate]);

  return { data, loading, error, refetch: fetchData, setData, requestId };
}
