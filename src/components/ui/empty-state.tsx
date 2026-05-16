"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { FileQuestion, Lock, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trackUxEvent } from "@/lib/ux/telemetry";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

/** Semantic variant that determines default icon and icon colour. */
export type EmptyStateVariant = "empty" | "no-permission" | "error";

/** A single action button rendered inside the empty state. */
export interface EmptyStateActionItem {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
}

/**
 * Props for the consolidated `<EmptyState>` component.
 *
 * Supports three rendering modes:
 * - **Inline** (default) -- centered text with optional icon, used for
 *   lightweight "no data" messages.
 * - **Card** (`card={true}`) -- wrapped in a dashed `<Card>`, suited for
 *   dashboard tiles.
 * - **Variant** (`variant`) -- semantic colouring with default icons for
 *   empty / no-permission / error states.
 *
 * Optional telemetry tracking fires a `empty_state_view` event on mount and
 * a `empty_state_action_click` event when an action button is pressed.
 */
export interface EmptyStateProps {
  /** Lucide icon component. When omitted the variant default is used. */
  icon?: LucideIcon;
  /** Heading text (always required). */
  title: string;
  /** Supporting body text. */
  description?: string;

  /* --- Actions (choose one) ---------------------------------------- */

  /**
   * Array of action buttons. Preferred API when you need multiple
   * buttons or explicit variant control per button.
   */
  actions?: EmptyStateActionItem[];
  /**
   * Shorthand: a single ReactNode placed below the description.
   * Use when you just need a custom element (e.g. a standalone Button).
   */
  action?: React.ReactNode;
  /** Shorthand: label for a single action button. */
  actionLabel?: string;
  /** Shorthand: href for the single action button (creates a Link). */
  actionHref?: string;
  /** Shorthand: click handler for the single action button. */
  onAction?: () => void;

  /* --- Presentation ------------------------------------------------ */

  /** Semantic variant with default icon / colour (`"empty"` | `"no-permission"` | `"error"`). */
  variant?: EmptyStateVariant;
  /** Render inside a `<Card>` with dashed border. */
  card?: boolean;
  /** Enable entrance animation via framer-motion. Default `true`. */
  animate?: boolean;

  /* --- Telemetry --------------------------------------------------- */

  /**
   * When set, fires `empty_state_view` on mount and
   * `empty_state_action_click` on action press.
   */
  telemetryKey?: string;
}

/* ------------------------------------------------------------------ */
/*  Variant look-up table                                              */
/* ------------------------------------------------------------------ */

const variantDefaults: Record<
  EmptyStateVariant,
  { icon: LucideIcon; iconColor: string }
> = {
  empty: { icon: FileQuestion, iconColor: "text-muted-foreground" },
  "no-permission": { icon: Lock, iconColor: "text-warning" },
  error: { icon: AlertTriangle, iconColor: "text-destructive" },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

/**
 * Unified empty-state component used across the application.
 *
 * @example
 * // Simple inline
 * <EmptyState icon={Inbox} title="Aucun message" />
 *
 * @example
 * // Card mode with telemetry
 * <EmptyState
 *   card
 *   icon={BookOpen}
 *   title="Aucun cours"
 *   description="Commencez par cr\u00e9er un premier cours."
 *   actionLabel="Cr\u00e9er un cours"
 *   actionHref="/dashboard/courses/new"
 *   telemetryKey="courses_empty"
 * />
 *
 * @example
 * // Variant with multiple actions
 * <EmptyState
 *   variant="error"
 *   title="Erreur de chargement"
 *   description="Impossible de charger les donn\u00e9es."
 *   actions={[
 *     { label: "R\u00e9essayer", onClick: refetch },
 *     { label: "Retour", href: "/dashboard", variant: "outline" },
 *   ]}
 * />
 */
export function EmptyState({
  icon,
  title,
  description,
  actions,
  action,
  actionLabel,
  actionHref,
  onAction,
  variant = "empty",
  card = false,
  animate = true,
  telemetryKey,
}: EmptyStateProps) {
  const defaults = variantDefaults[variant];
  const Icon = icon ?? defaults.icon;
  const iconColor = defaults.iconColor;

  /* ---- Telemetry: view ------------------------------------------- */
  useEffect(() => {
    if (!telemetryKey) return;
    trackUxEvent("empty_state_view", { key: telemetryKey, title });
  }, [telemetryKey, title]);

  /* ---- Telemetry: click ------------------------------------------ */
  const handleActionClick = (cb?: () => void) => {
    if (telemetryKey) {
      trackUxEvent("empty_state_action_click", {
        key: telemetryKey,
        title,
      });
    }
    cb?.();
  };

  /* ---- Normalise actions ----------------------------------------- */
  const resolvedActions: EmptyStateActionItem[] =
    actions ??
    (actionLabel
      ? [{ label: actionLabel, href: actionHref, onClick: onAction }]
      : []);

  /* ---- Inner content --------------------------------------------- */
  const content = (
    <div className="max-w-sm text-center space-y-4">
      {/* Icon */}
      <div
        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/50 mx-auto"
      >
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>

      {/* Text */}
      <div className="space-y-1.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {/* Action buttons */}
      {resolvedActions.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          {resolvedActions.map((a, i) =>
            a.href ? (
              <Button
                key={i}
                variant={a.variant ?? (i === 0 ? "default" : "outline")}
                size="sm"
                asChild
                onClick={() => handleActionClick(a.onClick)}
              >
                <Link href={a.href}>{a.label}</Link>
              </Button>
            ) : (
              <Button
                key={i}
                variant={a.variant ?? (i === 0 ? "default" : "outline")}
                size="sm"
                onClick={() => handleActionClick(a.onClick)}
              >
                {a.label}
              </Button>
            ),
          )}
        </div>
      )}

      {/* Free-form action node */}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );

  /* ---- Wrapper --------------------------------------------------- */
  const Wrapper = animate ? motion.div : "div";
  const wrapperProps = animate
    ? {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
      }
    : {};

  if (card) {
    return (
      <Card className="border-dashed border-border bg-muted/10">
        <CardContent className="py-14">
          {/* @ts-expect-error -- motion.div vs div prop mismatch */}
          <Wrapper
            className="flex items-center justify-center"
            {...wrapperProps}
          >
            {content}
          </Wrapper>
        </CardContent>
      </Card>
    );
  }

  return (
    // @ts-expect-error -- motion.div vs div prop mismatch
    <Wrapper
      className="flex min-h-[40vh] items-center justify-center px-4"
      {...wrapperProps}
    >
      {content}
    </Wrapper>
  );
}

/* ------------------------------------------------------------------ */
/*  Legacy named export for backward compatibility                     */
/* ------------------------------------------------------------------ */

/**
 * @deprecated Use `<EmptyState card telemetryKey="..." ... />` instead.
 */
export function EmptyStateAction(
  props: Omit<EmptyStateProps, "card" | "animate"> & { card?: boolean },
) {
  return <EmptyState card animate {...props} />;
}
