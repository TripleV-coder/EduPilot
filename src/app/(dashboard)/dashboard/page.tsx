"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  GraduationCap,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import { ApogeePanel } from "@/components/apogee/panel";
import { ApogeeMetricTile } from "@/components/apogee/metric-tile";
import { ApogeeSignalPill } from "@/components/apogee/signal-pill";
import { useApogeeDashboard } from "@/hooks/use-apogee-dashboard";
import { ApogeeMetric, PerformanceBand, Signal, SignalMomentum } from "@/domain/apogee/model";
import { formatRelativeTime } from "@/lib/design-system/tokens";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const panelVariants = {
  hidden: { opacity: 0, y: 24, rotateX: -6 },
  show: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { type: "spring", damping: 18, stiffness: 140, mass: 0.7 },
  },
};

const metricIcons: Record<string, ReactNode> = {
  students: <Users className="h-5 w-5" />,
  teachers: <GraduationCap className="h-5 w-5" />,
  classes: <BookOpen className="h-5 w-5" />,
  attendance: <Activity className="h-5 w-5" />,
  payments: <Wallet className="h-5 w-5" />,
  streak: <Zap className="h-5 w-5" />,
};

const momentumIcon: Record<SignalMomentum, ReactNode> = {
  UP: <ArrowUpRight className="h-3.5 w-3.5" />,
  DOWN: <ArrowDownRight className="h-3.5 w-3.5" />,
  STABLE: <Sparkles className="h-3.5 w-3.5" />,
};

const fallbackMetrics: ApogeeMetric[] = [
  {
    id: "sync",
    label: "Synchronisation",
    value: "—",
    hint: "Flux d'analyse en amorce.",
    tone: "graphite",
  },
  {
    id: "cadence",
    label: "Cadence",
    value: "—",
    hint: "Calibration en cours.",
    tone: "graphite",
  },
];

const fallbackPerformance: PerformanceBand[] = [
  { grade: "A", count: 0, intensity: 0, tone: "emerald" },
  { grade: "B", count: 0, intensity: 0, tone: "cobalt" },
  { grade: "C", count: 0, intensity: 0, tone: "gold" },
  { grade: "D", count: 0, intensity: 0, tone: "graphite" },
  { grade: "F", count: 0, intensity: 0, tone: "crimson" },
];

export default function DashboardPage() {
  const { model, isLoading } = useApogeeDashboard();

  const metrics = model?.metrics ?? fallbackMetrics;
  const queue = model?.queue ?? { primary: [], backlog: [] };
  const performance = model?.performance ?? fallbackPerformance;
  const activity = model?.activity ?? { items: [], tempo: 0, freshness: 0 };
  const logbook = model?.logbook ?? [];
  const narrative = model?.narrative ?? {
    headline: "Synchronisation APOGÉE",
    subline: "Alignement des flux en cours.",
  };

  return (
    <div className="space-y-6">
      <motion.header
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 18 }}
        className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.6em] text-apogee-metal/70">
            APOGÉE · Ingénierie de luxe
          </p>
          <h1 className="text-3xl font-semibold text-white lg:text-4xl">Atelier de Commande</h1>
          <p className="max-w-xl text-sm text-apogee-metal/80">{narrative.subline}</p>
          <div className="flex flex-wrap items-center gap-3">
            {queue.primary.slice(0, 2).map((signal) => (
              <ApogeeSignalPill key={signal.id} signal={signal} />
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-apogee-abyss/70 px-4 py-3 shadow-[0_20px_40px_rgba(2,8,20,0.4)]">
            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-apogee-metal/70">Tempo</p>
            <p className="mt-2 text-2xl font-semibold text-white">{activity.tempo}%</p>
            <p className="text-xs text-apogee-metal/70">Cadence des opérations (60 min).</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-apogee-abyss/70 px-4 py-3 shadow-[0_20px_40px_rgba(2,8,20,0.4)]">
            <p className="text-[0.6rem] uppercase tracking-[0.3em] text-apogee-metal/70">Fraîcheur</p>
            <p className="mt-2 text-2xl font-semibold text-white">{activity.freshness}%</p>
            <p className="text-xs text-apogee-metal/70">Dernier événement consolidé.</p>
          </div>
        </div>
      </motion.header>

      <div className="grid grid-cols-12 gap-6">
        <section className="col-span-12 space-y-6 xl:col-span-8">
          <motion.div variants={panelVariants} initial="hidden" animate="show">
            <ApogeePanel
              title="Matrice opérationnelle"
              subtitle={narrative.headline}
              className="apogee-grid"
              actions={
                <span className="rounded-full border border-white/10 px-3 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-apogee-metal/80">
                  {isLoading ? "Calibrage" : "Actif"}
                </span>
              }
            >
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {metrics.map((metric) => (
                  <motion.div key={metric.id} variants={panelVariants}>
                    <ApogeeMetricTile metric={metric} icon={metricIcons[metric.id]} />
                  </motion.div>
                ))}
              </motion.div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-apogee-metal/70">
                    Priorité en file
                  </p>
                  <p className="mt-2 text-sm text-white">
                    {queue.primary[0]?.label ?? "Analyse en attente d'entrées réelles."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {queue.primary.map((signal) => (
                    <ApogeeSignalPill key={signal.id} signal={signal} />
                  ))}
                </div>
              </div>
            </ApogeePanel>
          </motion.div>

          <div className="grid grid-cols-12 gap-6">
            <motion.div className="col-span-12 lg:col-span-7" variants={panelVariants} initial="hidden" animate="show">
              <ApogeePanel
                title="Spectre académique"
                subtitle="Densité de performance consolidée"
                tone="gold"
              >
                <div className="relative mt-4 h-[220px] w-full overflow-hidden rounded-xl border border-white/10 bg-apogee-abyss/60 p-4">
                  <div className="pointer-events-none absolute inset-0 apogee-grid opacity-40" />
                  <div className="relative z-10 flex h-full items-end gap-4">
                    {performance.map((band) => (
                      <div key={band.grade} className="flex flex-1 flex-col items-center gap-2">
                        <motion.div
                          initial={{ height: 0, opacity: 0.4 }}
                          animate={{ height: `${Math.max(16, band.intensity * 1.6)}px`, opacity: 1 }}
                          transition={{ type: "spring", stiffness: 120, damping: 16 }}
                          className="w-full rounded-t-xl bg-gradient-to-b from-white/10 to-transparent"
                          style={{
                            background:
                              band.tone === "emerald"
                                ? "linear-gradient(180deg, rgba(72,255,190,0.7), transparent)"
                                : band.tone === "cobalt"
                                  ? "linear-gradient(180deg, rgba(90,140,255,0.7), transparent)"
                                  : band.tone === "gold"
                                    ? "linear-gradient(180deg, rgba(255,205,120,0.7), transparent)"
                                    : band.tone === "crimson"
                                      ? "linear-gradient(180deg, rgba(255,110,160,0.7), transparent)"
                                      : "linear-gradient(180deg, rgba(255,255,255,0.3), transparent)",
                          }}
                        />
                        <span className="text-xs text-apogee-metal/80">{band.grade}</span>
                        <span className="text-[0.65rem] text-apogee-metal/60">{band.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ApogeePanel>
            </motion.div>

            <motion.div className="col-span-12 lg:col-span-5" variants={panelVariants} initial="hidden" animate="show">
              <ApogeePanel title="Flux d'activité" subtitle="Chronologie opérationnelle" tone="cobalt">
                <div className="space-y-3">
                  {activity.items.map((item) => (
                    <div
                      key={`${item.user}-${item.time}`}
                      className="flex items-start justify-between gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm text-white">
                          <span className="font-medium">{item.user}</span> · {item.action}
                        </p>
                        <p className="text-xs text-apogee-metal/70">{item.entity}</p>
                      </div>
                      <span className="text-xs text-apogee-metal/60">{formatRelativeTime(item.time)}</span>
                    </div>
                  ))}
                  {activity.items.length === 0 && (
                    <p className="text-sm text-apogee-metal/70">Flux silencieux, en attente d'activité.</p>
                  )}
                </div>
              </ApogeePanel>
            </motion.div>
          </div>
        </section>

        <aside className="col-span-12 space-y-6 xl:col-span-4">
          <motion.div variants={panelVariants} initial="hidden" animate="show">
            <ApogeePanel title="File d'intervention" subtitle="Signaux hiérarchisés" tone="crimson">
              <div className="space-y-3">
                {queue.primary.map((signal) => (
                  <SignalRow key={signal.id} signal={signal} />
                ))}
                {queue.backlog.map((signal) => (
                  <SignalRow key={signal.id} signal={signal} compact />
                ))}
                {queue.primary.length === 0 && (
                  <p className="text-sm text-apogee-metal/70">Rien à signaler pour l'instant.</p>
                )}
              </div>
            </ApogeePanel>
          </motion.div>

          <motion.div variants={panelVariants} initial="hidden" animate="show">
            <ApogeePanel title="Journal tactique" subtitle="Décisions & micro-optimisations" tone="emerald">
              <div className="space-y-3">
                {logbook.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em] text-apogee-metal/60">
                      <span>{entry.scope}</span>
                      <span>{formatRelativeTime(entry.timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm text-white">{entry.message}</p>
                  </div>
                ))}
                {logbook.length === 0 && (
                  <p className="text-sm text-apogee-metal/70">Journal en cours d'alimentation.</p>
                )}
              </div>
            </ApogeePanel>
          </motion.div>
        </aside>
      </div>
    </div>
  );
}

function SignalRow({ signal, compact = false }: { signal: Signal; compact?: boolean }) {
  const gradient =
    signal.tone === "emerald"
      ? "from-apogee-emerald/70 via-apogee-emerald/30 to-transparent"
      : signal.tone === "gold"
        ? "from-apogee-gold/70 via-apogee-gold/30 to-transparent"
        : signal.tone === "cobalt"
          ? "from-apogee-cobalt/70 via-apogee-cobalt/30 to-transparent"
          : signal.tone === "crimson"
            ? "from-apogee-crimson/70 via-apogee-crimson/30 to-transparent"
            : "from-white/30 via-white/10 to-transparent";

  return (
    <div className="rounded-xl border border-white/10 bg-apogee-abyss/70 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-white">{signal.label}</p>
          <p className="text-xs text-apogee-metal/70">{signal.hint}</p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-apogee-metal/70">
          {momentumIcon[signal.momentum]}
          <span>{signal.score}</span>
        </div>
      </div>
      {!compact && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`h-full w-full bg-gradient-to-r ${gradient}`} style={{ width: `${signal.score}%` }} />
        </div>
      )}
    </div>
  );
}
