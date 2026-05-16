"use client";

import Link from "next/link";

export function DashboardFooter() {
  const year = new Date().getFullYear();
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || "v2026";

  return (
    <footer className="border-t border-border/80 bg-[hsl(var(--surface-base))] px-4 py-3 md:px-8">
      <div className="rounded-lg border border-border/70 bg-[hsl(var(--surface-base))] px-3 py-2">
        <div className="flex flex-col gap-2 text-[11px] text-text-secondary md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-success" aria-hidden />
            <p className="text-text-secondary">
              EduPilot © {year} - Plateforme de pilotage scolaire.
            </p>
            <span className="hidden md:inline text-text-tertiary">|</span>
            <span className="font-medium text-text-primary">{appVersion}</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-text-primary transition-colors">
                          Confidentialité
            </Link>
            <span className="text-text-tertiary">|</span>
            <Link href="/terms" className="hover:text-text-primary transition-colors">
              Conditions
            </Link>
            <span className="text-text-tertiary">|</span>
            <Link href="/dashboard/messages" className="hover:text-text-primary transition-colors">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
