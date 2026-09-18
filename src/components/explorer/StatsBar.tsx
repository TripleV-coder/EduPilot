"use client";

import type React from "react";

import { useEffect, useState } from "react";

type Overview = {
  schools: number;
  students: number;
  classes: number;
  teachers: number;
};

type StatsBarProps = {
  overview: Overview | null;
  loading: boolean;
};

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const start = Date.now();
    const startVal = display;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startVal + (value - startVal) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return (
    <span>
      {display.toLocaleString("fr-FR")}
      {suffix}
    </span>
  );
}

export function StatsBar({ overview, loading }: StatsBarProps) {
  const stats = [
    {
      label: "Écoles",
      value: overview?.schools ?? 0,
      key: "schools",
    },
    {
      label: "Élèves",
      value: overview?.students ?? 0,
      key: "students",
    },
    {
      label: "Classes",
      value: overview?.classes ?? 0,
      key: "classes",
    },
    {
      label: "Enseignants",
      value: overview?.teachers ?? 0,
      key: "teachers",
    },
  ];

  return (
    <div
      className="edu-enter-up fixed bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-2xl border border-explorer-border bg-explorer-bg-elevated/90 px-8 py-4 backdrop-blur-xl"
      style={{ "--edu-enter-dy": "20px", "--edu-enter-d": "500ms" } as React.CSSProperties}
    >
      <div className="flex items-center gap-10">
        {stats.map((stat, i) => (
          <div
            key={stat.key}
            className="edu-enter-up flex flex-col items-center gap-0.5"
            style={{ "--edu-enter-dy": "10px", "--edu-enter-d": "400ms", "--edu-enter-delay": `${i * 100}ms` } as React.CSSProperties}
          >
            <span className="text-2xl font-semibold tabular-nums text-explorer-foreground">
              {loading ? (
                <span className="text-explorer-muted">—</span>
              ) : (
                <AnimatedNumber value={stat.value} />
              )}
            </span>
            <span className="text-xs uppercase tracking-wider text-explorer-muted">
              {stat.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
