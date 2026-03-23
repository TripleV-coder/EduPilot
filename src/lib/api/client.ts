/**
 * Client API résilient : retry, timeout, X-Request-Id, AbortSignal.
 * Utiliser pour toutes les requêtes fetch vers l'API interne.
 */

const REQUEST_ID_HEADER = "X-Request-Id";
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export type ApiClientOptions = RequestInit & {
  timeout?: number;
  retries?: number;
  requestId?: string;
};

/**
 * Fetch avec timeout, retry et propagation du requestId.
 */
export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  options: ApiClientOptions = {}
): Promise<{ data: T; response: Response; requestId: string | null }> {
  const {
    timeout = DEFAULT_TIMEOUT_MS,
    retries = DEFAULT_RETRIES,
    requestId: providedRequestId,
    ...init
  } = options;

  const requestId = providedRequestId ?? generateRequestId();
  const _url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const headers = new Headers(init.headers);
  headers.set(REQUEST_ID_HEADER, requestId);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const userSignal = init.signal;
    const timeoutSignal = controller.signal;
    if (userSignal?.aborted) {
      clearTimeout(timeoutId);
      throw new DOMException("Aborted", "AbortError");
    }
    const onAbort = () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
    userSignal?.addEventListener?.("abort", onAbort, { once: true });
    const signal = timeoutSignal;

    try {
      const response = await fetch(input, {
        ...init,
        headers,
        signal,
        credentials: init.credentials ?? "include",
      });
      userSignal?.removeEventListener?.("abort", onAbort);

      clearTimeout(timeoutId);
      const responseRequestId = response.headers.get(REQUEST_ID_HEADER) ?? requestId;

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const err = new Error((errBody as { error?: string }).error ?? `HTTP ${response.status}`) as Error & {
          status?: number;
          requestId?: string;
          details?: unknown;
        };
        err.status = response.status;
        err.requestId = responseRequestId;
        err.details = errBody;
        throw err;
      }

      const data = (await response.json().catch(() => null)) as T;
      return { data, response, requestId: responseRequestId };
    } catch (e) {
      clearTimeout(timeoutId);
      userSignal?.removeEventListener?.("abort", onAbort);
      lastError = e instanceof Error ? e : new Error(String(e));
      if (!(lastError as Error & { requestId?: string }).requestId) {
        (lastError as Error & { requestId?: string }).requestId = requestId;
      }
      const errStatus = (lastError as Error & { status?: number }).status;
      if (attempt < retries && (lastError.name === "AbortError" || (errStatus !== undefined && errStatus >= 500))) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      throw lastError;
    }
  }

  const final = lastError ?? new Error("apiFetch failed");
  (final as Error & { requestId?: string }).requestId = requestId;
  throw final;
}
