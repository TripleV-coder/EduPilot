"use client";

import type { LucideIcon } from "lucide-react";
import { MetricCard } from "@/components/edu/metric-card";

type MetricCardProProps = {
  label: string;
  value: string | number;
  hint?: string;
  /** Conservé pour compatibilité : le style validé n'affiche plus d'icône. */
  icon?: LucideIcon;
  tone?: "primary" | "success" | "warning";
};

const TONE_TO_VARIANT = { primary: "brand", success: "success", warning: "warning" } as const;

/** Même rendu que MetricCard (style « vue d'ensemble » de l'accueil validé). */
export function MetricCardPro({ label, value, hint, tone = "primary" }: MetricCardProProps) {
  return <MetricCard label={label} value={value} trendLabel={hint} variant={TONE_TO_VARIANT[tone]} />;
}
