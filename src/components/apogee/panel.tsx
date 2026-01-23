import * as React from "react";
import { cn } from "@/lib/utils";
import { ApogeeTone } from "@/domain/apogee/model";

interface ApogeePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  readonly title?: string;
  readonly subtitle?: string;
  readonly tone?: ApogeeTone;
  readonly actions?: React.ReactNode;
}

const toneStyles: Record<ApogeeTone, string> = {
  gold: "text-apogee-gold",
  cobalt: "text-apogee-cobalt",
  emerald: "text-apogee-emerald",
  graphite: "text-apogee-metal",
  crimson: "text-apogee-crimson",
};

export const ApogeePanel = React.forwardRef<HTMLDivElement, ApogeePanelProps>(
  ({ className, title, subtitle, tone = "graphite", actions, children, ...props }, ref) => (
    <section
      ref={ref}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/10 bg-apogee-abyss/70 shadow-[0_20px_50px_rgba(4,8,16,0.55)]",
        "backdrop-blur-2xl transition-transform duration-300 ease-out hover:-translate-y-0.5",
        className
      )}
      {...props}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(90,140,255,0.16),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen apogee-sheen" />

      <div className="relative z-10 p-5 lg:p-6 space-y-4">
        {(title || subtitle || actions) && (
          <header className="flex items-start justify-between gap-3">
            <div>
              {title && (
                <h3 className={cn("text-sm uppercase tracking-[0.32em]", toneStyles[tone])}>
                  {title}
                </h3>
              )}
              {subtitle && <p className="mt-2 text-sm text-apogee-metal/80">{subtitle}</p>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>
        )}
        <div>{children}</div>
      </div>
    </section>
  )
);

ApogeePanel.displayName = "ApogeePanel";
