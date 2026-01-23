import * as React from "react";
import { cn } from "@/lib/utils";
import { Signal, SignalDomain, SignalSeverity } from "@/domain/apogee/model";

interface ApogeeSignalPillProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly signal: Signal;
}

const severityStyles: Record<SignalSeverity, string> = {
  CRITICAL: "border-apogee-crimson/50 text-apogee-crimson bg-apogee-crimson/10",
  HIGH: "border-apogee-gold/50 text-apogee-gold bg-apogee-gold/10",
  ELEVATED: "border-apogee-cobalt/50 text-apogee-cobalt bg-apogee-cobalt/10",
  GUARDED: "border-apogee-emerald/50 text-apogee-emerald bg-apogee-emerald/10",
  CLEAR: "border-white/10 text-apogee-metal bg-white/5",
};

const domainLabel: Record<SignalDomain, string> = {
  ATTENDANCE: "Présence",
  FINANCE: "Finance",
  ACADEMICS: "Académique",
  ENGAGEMENT: "Engagement",
  LIBRARY: "Bibliothèque",
  SYSTEM: "Système",
};

const severityLabel: Record<SignalSeverity, string> = {
  CRITICAL: "Critique",
  HIGH: "Haute",
  ELEVATED: "Élevée",
  GUARDED: "Sous garde",
  CLEAR: "Stable",
};

export const ApogeeSignalPill = React.forwardRef<HTMLDivElement, ApogeeSignalPillProps>(
  ({ signal, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.65rem] uppercase tracking-[0.24em]",
        severityStyles[signal.severity],
        className
      )}
      {...props}
    >
      <span>{domainLabel[signal.domain]}</span>
      <span className="text-[0.6rem] opacity-80">•</span>
      <span>{severityLabel[signal.severity]}</span>
    </div>
  )
);

ApogeeSignalPill.displayName = "ApogeeSignalPill";
