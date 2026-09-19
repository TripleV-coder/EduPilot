"use client";

/**
 * Squelette de base : un fond et un reflet, en CSS seul.
 *
 * Perf (2026-09-18) : ce composant vivait dans le même fichier que les
 * squelettes composés, animés par framer-motion. Toute page qui affichait un
 * simple rectangle de chargement téléchargeait donc la bibliothèque
 * d'animation (~110 Ko) — au moment précis où elle attend encore ses données.
 * Les squelettes animés sont désormais dans `skeleton-page.tsx`, chargé par la
 * seule page qui s'en sert. Le rendu est identique.
 *
 * Respecte `prefers-reduced-motion` (bloc global de globals.css).
 */

import { cn } from "@/lib/utils";

/* ─── Shimmer keyframes (Tailwind custom animation in globals.css) ──── */

const shimmerClass =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 dark:before:via-white/5 before:to-transparent";

/* ─── Base Skeleton ──── */

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Disable shimmer animation */
  noShimmer?: boolean;
}

export function Skeleton({ className, noShimmer, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "rounded-md bg-muted/70 dark:bg-muted/40",
        !noShimmer && shimmerClass,
        className
      )}
      {...props}
    />
  );
}

