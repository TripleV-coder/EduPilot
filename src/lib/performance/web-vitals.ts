"use client";

/**
 * Web Vitals tracking for performance monitoring
 * Mesure les Core Web Vitals et les envoie à /api/analytics/web-vitals
 */
interface WebVitalMetric {
  id: string;
  name: string;
  value: number;
  rating?: string;
}


/**
 * Les 5 mesures d'une page partent en UN envoi, quand la page est quittée ou
 * masquée (sendBeacon, qui survit à la fermeture) — au lieu d'une requête par
 * mesure, qui pesait sur le quota de requêtes de l'utilisateur.
 */
export function reportWebVitals() {
  if (typeof window === "undefined") return;

  const queue = new Map<string, WebVitalMetric>();

  function flush() {
    if (queue.size === 0) return;
    const body = JSON.stringify({ path: window.location.pathname.slice(0, 200), metrics: [...queue.values()] });
    queue.clear();
    const url = "/api/analytics/web-vitals";
    const sent = typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    if (!sent) {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {
        // mesures perdues : sans conséquence
      });
    }
  }

  function sendToAnalytics(metric: WebVitalMetric) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[Web Vitals] ${metric.name}:`, { value: metric.value, rating: metric.rating, id: metric.id });
    }
    // Dernière valeur de chaque mesure (CLS et INP évoluent pendant la visite)
    queue.set(metric.name, { id: metric.id, name: metric.name, value: metric.value, rating: metric.rating });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);

  // Import dynamique : rien au premier chargement (onFID retiré au profit d'onINP)
  import("web-vitals").then(({ onCLS, onFCP, onLCP, onTTFB, onINP }) => {
    onCLS(sendToAnalytics);
    onFCP(sendToAnalytics);
    onLCP(sendToAnalytics);
    onTTFB(sendToAnalytics);
    onINP(sendToAnalytics);
  }).catch(() => {
    // Web Vitals indisponible : pas de mesure
  });
}
