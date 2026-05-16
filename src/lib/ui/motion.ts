import type { Variants } from "framer-motion";

/* ─── Durations (seconds) ──── */
export const UI_MOTION = {
  micro: 0.16,
  standard: 0.22,
  emphasize: 0.28,
  slow: 0.4,
  easeStandard: [0.16, 1, 0.3, 1] as const,
  easeOut: [0.0, 0.0, 0.2, 1] as const,
};

/* ─── CSS transition shorthands ──── */
export const UI_TRANSITIONS = {
  micro: `all ${UI_MOTION.micro}s cubic-bezier(0.16,1,0.3,1)`,
  standard: `all ${UI_MOTION.standard}s cubic-bezier(0.16,1,0.3,1)`,
  emphasize: `all ${UI_MOTION.emphasize}s cubic-bezier(0.16,1,0.3,1)`,
};

/* ─── Framer Motion variants ──── */

/** Fade-up entrance for individual items */
export const fadeUpVariant: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: UI_MOTION.standard, ease: UI_MOTION.easeStandard },
  },
};

/** Stagger container — wraps children that use fadeUpVariant */
export const staggerContainerVariant: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

/** Scale-up entrance for cards/modals */
export const scaleUpVariant: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: UI_MOTION.emphasize, ease: UI_MOTION.easeStandard },
  },
};

/** Slide-in from left for sidebar/drawer */
export const slideInLeftVariant: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: UI_MOTION.standard, ease: UI_MOTION.easeStandard },
  },
};
