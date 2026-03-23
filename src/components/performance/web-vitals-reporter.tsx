"use client";

import { useEffect } from "react";
import { reportWebVitals } from "@/lib/performance/web-vitals";

/**
 * Client-only component that runs reportWebVitals after mount.
 * Prevents "reportWebVitals from server" error when used in root layout.
 * Errors are caught to avoid breaking the app.
 */
export function WebVitalsReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      reportWebVitals();
    } catch {
      // Ignore: web vitals must not break the app
    }
  }, []);
  return null;
}
