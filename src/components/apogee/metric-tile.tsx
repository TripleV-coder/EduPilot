import * as React from "react";
import { cn } from "@/lib/utils";
import { ApogeeMetric, ApogeeTone } from "@/domain/apogee/model";

interface ApogeeMetricTileProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly metric: ApogeeMetric;
  readonly icon?: React.ReactNode;
  readonly compact?: boolean;
}

const toneStyles: Record<ApogeeTone, string> = {
  gold: "border-apogee-gold/30 text-apogee-gold",
  cobalt: "border-apogee-cobalt/30 text-apogee-cobalt",
  emerald: "border-apogee-emerald/30 text-apogee-emerald",
  graphite: "border-white/10 text-apogee-metal",
  crimson: "border-apogee-crimson/35 text-apogee-crimson",
};

export const ApogeeMetricTile = React.forwardRef<HTMLDivElement, ApogeeMetricTileProps>(
  ({ metric, icon, compact = false, className, ...props }, ref) => (
    <article
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-apogee-abyss/60 p-4",
        "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(2,8,20,0.4)]",
        toneStyles[metric.tone],
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70 apogee-shader" />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.28em] text-apogee-metal/80">{metric.label}</p>
          <div className={cn("font-semibold", compact ? "text-xl" : "text-2xl")}>{metric.value}</div>
          <p className="text-xs text-apogee-metal/70">{metric.hint}</p>
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5">
            {icon}
          </div>
        )}
      </div>
      {metric.delta && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.65rem] uppercase tracking-[0.24em] text-apogee-metal/80">
          {metric.delta}
        </div>
      )}
    </article>
  )
);

ApogeeMetricTile.displayName = "ApogeeMetricTile";
