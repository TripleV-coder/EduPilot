"use client";

type UxEventPayload = Record<string, string | number | boolean | null | undefined>;

const STORAGE_KEY = "edupilot_ux_events";
const MAX_BUFFER = 200;

function getBuffer(): Array<Record<string, unknown>> {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveBuffer(events: Array<Record<string, unknown>>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-MAX_BUFFER)));
}

export function trackUxEvent(event: string, payload: UxEventPayload = {}) {
  if (typeof window === "undefined") return;

  const entry = {
    event,
    payload,
    pathname: window.location.pathname,
    timestamp: new Date().toISOString(),
  };

  const next = [...getBuffer(), entry];
  saveBuffer(next);

  // Best-effort remote forwarding, non-blocking.
  try {
    const body = JSON.stringify(entry);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/ux/events", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/ux/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {
    // Ignore telemetry failures by design.
  }
}
