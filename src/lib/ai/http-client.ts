// NOTE: Ce module est utilisé côté serveur (API routes) et côté client si besoin.
// Il n'embarque aucune dépendance Node-only.

export type HttpJsonResult<T> = { ok: true; data: T; status: number } | { ok: false; status: number; error: string };

export type HttpJsonOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  retryOn?: (status: number, errorText: string) => boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function defaultRetryOn(status: number, _errorText: string) {
  // 408/429/5xx → retry
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

export async function fetchJsonWithPolicy<T>(
  url: string,
  options: HttpJsonOptions = {}
): Promise<HttpJsonResult<T>> {
  const {
    method = "GET",
    headers = {},
    body,
    timeoutMs = 15_000,
    retries = 1,
    retryDelayMs = 400,
    retryOn = defaultRetryOn,
  } = options;

  let attempt = 0;
  while (attempt <= retries) {
    attempt += 1;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          Accept: "application/json",
          ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const errText = text || res.statusText || "Erreur HTTP";
        if (attempt <= retries && retryOn(res.status, errText)) {
          await sleep(retryDelayMs * attempt);
          continue;
        }
        return { ok: false, status: res.status, error: errText };
      }

      const data = (await res.json()) as T;
      return { ok: true, data, status: res.status };
    } catch (e) {
      clearTimeout(timeout);
      const msg = e instanceof Error ? e.message : String(e);
      // AbortError ou réseau → retry si possible
      if (attempt <= retries) {
        await sleep(retryDelayMs * attempt);
        continue;
      }
      return { ok: false, status: 0, error: msg };
    }
  }

  return { ok: false, status: 0, error: "Erreur réseau" };
}

