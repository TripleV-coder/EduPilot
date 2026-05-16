"use client";

/**
 * Premium skeleton loading components with shimmer effect and Framer Motion stagger.
 * Design: Executive Dashboard style — glassmorphism + institutional green.
 * Respects prefers-reduced-motion.
 */

import { cn } from "@/lib/utils";
import { motion, type Variants } from "framer-motion";

/* ─── Shimmer keyframes (Tailwind custom animation in globals.css) ──── */

const shimmerClass =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 dark:before:via-white/5 before:to-transparent";

/* ─── Framer Motion stagger variants ──── */

const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.04,
    },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] },
  },
};

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

/* ─── Stat Card Skeleton (KPI) ──── */

export function StatCardSkeleton() {
  return (
    <motion.div
      variants={staggerItem}
      className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2.5 flex-1">
          <Skeleton className="h-3.5 w-24 rounded-full" />
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Skeleton className="h-3 w-12 rounded-full" />
        <Skeleton className="h-3 w-20 rounded-full" />
      </div>
    </motion.div>
  );
}

/* ─── Table Skeleton ──── */

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-2"
    >
      {/* Header row */}
      <motion.div
        variants={staggerItem}
        className="flex gap-4 pb-3 border-b border-border/40"
      >
        <Skeleton className="h-4 w-[18%] rounded-full" />
        <Skeleton className="h-4 w-[25%] rounded-full" />
        <Skeleton className="h-4 w-[15%] rounded-full" />
        <Skeleton className="h-4 w-[12%] rounded-full" />
        <Skeleton className="h-4 w-[10%] rounded-full" />
      </motion.div>
      {/* Data rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <motion.div
          key={i}
          variants={staggerItem}
          className="flex gap-4 items-center py-2"
        >
          <Skeleton className="h-9 w-[18%] rounded-lg" />
          <Skeleton className="h-9 w-[25%] rounded-lg" />
          <Skeleton className="h-9 w-[15%] rounded-lg" />
          <Skeleton className="h-9 w-[12%] rounded-lg" />
          <Skeleton className="h-9 w-[10%] rounded-lg" />
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ─── Card Skeleton (generic) ──── */

export function CardSkeleton() {
  return (
    <motion.div
      variants={staggerItem}
      className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 space-y-3 shadow-sm"
    >
      <Skeleton className="h-4 w-1/3 rounded-full" />
      <Skeleton className="h-7 w-1/2 rounded-lg" />
      <Skeleton className="h-4 w-3/4 rounded-full" />
    </motion.div>
  );
}

/* ─── Chart Skeleton ──── */

export function ChartSkeleton({ type = "bar" }: { type?: "bar" | "line" | "pie" | "radar" }) {
  return (
    <motion.div
      variants={staggerItem}
      className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 shadow-sm"
    >
      {/* Chart header */}
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36 rounded-full" />
          <Skeleton className="h-3 w-24 rounded-full" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>

      {/* Chart area */}
      {type === "pie" || type === "radar" ? (
        <div className="flex items-center justify-center py-6">
          <Skeleton className="h-48 w-48 rounded-full" />
        </div>
      ) : (
        <div className="flex items-end gap-2 h-48 pt-4">
          {/* Y-axis labels */}
          <div className="flex flex-col justify-between h-full w-8 shrink-0">
            <Skeleton className="h-3 w-8 rounded-full" />
            <Skeleton className="h-3 w-6 rounded-full" />
            <Skeleton className="h-3 w-8 rounded-full" />
          </div>
          {/* Bars / Lines */}
          {type === "bar" ? (
            <div className="flex items-end gap-3 flex-1 h-full">
              {[65, 45, 80, 55, 70, 40, 90, 60].map((h, i) => (
                <Skeleton
                  key={i}
                  className="flex-1 rounded-t-md"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          ) : (
            <div className="flex-1 h-full relative">
              <Skeleton className="absolute inset-0 rounded-lg" />
              {/* Simulated line points */}
              <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 pb-1">
                {Array.from({ length: 7 }).map((_, i) => (
                  <Skeleton key={i} className="h-2 w-2 rounded-full" />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* X-axis labels */}
      <div className="flex justify-between mt-3 px-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-8 rounded-full" />
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Page Skeleton (full dashboard loading) ──── */

export function PageSkeleton() {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-6 p-6"
    >
      {/* Page header */}
      <motion.div variants={staggerItem} className="space-y-2">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded-full" />
      </motion.div>

      {/* KPI row */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </motion.div>

      {/* Charts row */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2"
      >
        <ChartSkeleton type="bar" />
        <ChartSkeleton type="line" />
      </motion.div>

      {/* Table */}
      <motion.div
        variants={staggerItem}
        className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-48 rounded-full" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
        <TableSkeleton rows={5} />
      </motion.div>
    </motion.div>
  );
}
