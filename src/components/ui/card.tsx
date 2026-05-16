"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { motion, type HTMLMotionProps } from "framer-motion";

/* ─────────────────────────────────────────────────────────────
   Card variant system
   - "default"  : classic shadcn card (unchanged)
   - "glass"    : glassmorphism with translucent bg + blur
   - "elevated" : deeper shadow + subtle border glow
   ───────────────────────────────────────────────────────────── */

type CardVariant = "default" | "glass" | "elevated";

const variantStyles: Record<CardVariant, string> = {
  default: "border bg-card text-card-foreground shadow",
  glass: [
    "border border-border/30 dark:border-white/[0.08]",
    "bg-card/70 dark:bg-card/50",
    "backdrop-blur-[var(--glass-blur)]",
    "text-card-foreground shadow-sm",
  ].join(" "),
  elevated: [
    "border border-border/40 dark:border-white/[0.06]",
    "bg-card text-card-foreground",
    "shadow-md hover:shadow-xl",
    "dark:shadow-black/20 dark:hover:shadow-black/30",
  ].join(" "),
};

/* ─── Base Card (fully backward-compatible) ──── */

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-xl", variantStyles[variant], className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

/* ─── GlassCard — motion-enhanced glassmorphism card ──── */

interface GlassCardProps extends HTMLMotionProps<"div"> {
  /** Lift on hover (default: true) */
  hover?: boolean;
  /** Card variant override */
  variant?: CardVariant;
}

const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = true, variant = "glass", children, ...props }, ref) => (
    <motion.div
      ref={ref}
      className={cn(
        "rounded-xl transition-colors duration-300",
        variantStyles[variant],
        className
      )}
      whileHover={
        hover
          ? {
              y: -3,
              boxShadow:
                "0 12px 28px -4px rgba(61, 122, 95, 0.10), 0 4px 12px -2px rgba(0,0,0,0.06)",
              transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
            }
          : undefined
      }
      whileTap={hover ? { scale: 0.995 } : undefined}
      {...props}
    >
      {children}
    </motion.div>
  )
);
GlassCard.displayName = "GlassCard";

/* ─── Sub-components (unchanged API) ──── */

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  GlassCard,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
export type { CardVariant, CardProps, GlassCardProps };
