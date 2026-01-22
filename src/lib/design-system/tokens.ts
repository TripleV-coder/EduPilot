// ============================================
// DESIGN SYSTEM - Tokens & Configuration
// ============================================

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Couleurs principales
export const COLORS = {
  primary: {
    50: "hsl(220 100% 95%)",
    100: "hsl(220 100% 90%)",
    200: "hsl(220 100% 80%)",
    300: "hsl(220 100% 70%)",
    400: "hsl(220 100% 60%)",
    500: "hsl(220 100% 50%)",
    600: "hsl(220 100% 45%)",
    700: "hsl(220 100% 35%)",
    800: "hsl(220 100% 25%)",
    900: "hsl(220 100% 15%)",
  },
  secondary: {
    50: "hsl(240 5% 96%)",
    100: "hsl(240 5% 92%)",
    200: "hsl(240 5% 84%)",
    300: "hsl(240 5% 76%)",
    400: "hsl(240 5% 68%)",
    500: "hsl(240 5% 60%)",
    600: "hsl(240 5% 52%)",
    700: "hsl(240 5% 44%)",
    800: "hsl(240 5% 36%)",
    900: "hsl(240 5% 20%)",
  },
  success: {
    DEFAULT: "hsl(142 76% 36%)",
    light: "hsl(142 76% 46%)",
    dark: "hsl(142 76% 26%)",
  },
  warning: {
    DEFAULT: "hsl(38 92% 50%)",
    light: "hsl(38 92% 60%)",
    dark: "hsl(38 92% 40%)",
  },
  danger: {
    DEFAULT: "hsl(0 84% 60%)",
    light: "hsl(0 84% 70%)",
    dark: "hsl(0 84% 50%)",
  },
  info: {
    DEFAULT: "hsl(199 89% 48%)",
    light: "hsl(199 89% 58%)",
    dark: "hsl(199 89% 38%)",
  },
};

// Gradients
export const GRADIENTS = {
  primary: "from-blue-600 to-cyan-600",
  secondary: "from-slate-600 to-slate-700",
  success: "from-green-500 to-emerald-500",
  warning: "from-yellow-500 to-orange-500",
  danger: "from-red-500 to-pink-500",
  purple: "from-purple-500 to-pink-500",
  sunset: "from-orange-500 via-red-500 to-pink-500",
  ocean: "from-blue-500 via-cyan-500 to-teal-500",
  dark: "from-gray-900 via-gray-800 to-gray-700",
};

// Ombres
export const SHADOWS = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)",
  glow: "0 0 20px rgba(59, 130, 246, 0.5)",
  "glow-sm": "0 0 10px rgba(59, 130, 246, 0.3)",
};

// Rayons
export const RADII = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  full: "9999px",
};

// Transitions
export const TRANSITIONS = {
  fast: "150ms ease",
  normal: "200ms ease",
  slow: "300ms ease",
};

// Breakpoints
export const BREAKPOINTS = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
};

// Utilitaire de classes
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// CONSTANTES MÉTIER
// ============================================

export const USER_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SCHOOL_ADMIN: "SCHOOL_ADMIN",
  DIRECTOR: "DIRECTOR",
  TEACHER: "TEACHER",
  ACCOUNTANT: "ACCOUNTANT",
  PARENT: "PARENT",
  STUDENT: "STUDENT",
} as const;

export const ATTENDANCE_STATUS = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  LATE: "LATE",
  EXCUSED: "EXCUSED",
} as const;

export const PAYMENT_STATUS = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  RECONCILED: "RECONCILED",
  CANCELLED: "CANCELLED",
} as const;

export const RISK_LEVEL = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export const PERFORMANCE_LEVEL = {
  EXCELLENT: "EXCELLENT",
  VERY_GOOD: "VERY_GOOD",
  GOOD: "GOOD",
  FAIR: "FAIR",
  WEAK: "WEAK",
} as const;

// ============================================
// ÉCHELLE DE NOTES
// ============================================

export const GRADE_SCALE = [
  { min: 16, max: 20, label: "Excellent", color: "text-green-600", bg: "bg-green-100" },
  { min: 14, max: 15.99, label: "Très Bien", color: "text-blue-600", bg: "bg-blue-100" },
  { min: 12, max: 13.99, label: "Bien", color: "text-cyan-600", bg: "bg-cyan-100" },
  { min: 10, max: 11.99, label: "Assez Bien", color: "text-yellow-600", bg: "bg-yellow-100" },
  { min: 8, max: 9.99, label: "Insuffisant", color: "text-orange-600", bg: "bg-orange-100" },
  { min: 0, max: 7.99, label: "Très Insuffisant", color: "text-red-600", bg: "bg-red-100" },
];

export function getGradeInfo(grade: number) {
  return GRADE_SCALE.find((g) => grade >= g.min && grade <= g.max) || GRADE_SCALE[GRADE_SCALE.length - 1];
}

export function getGradeColor(grade: number): string {
  if (grade >= 16) return "text-green-600";
  if (grade >= 14) return "text-blue-600";
  if (grade >= 12) return "text-cyan-600";
  if (grade >= 10) return "text-yellow-600";
  if (grade >= 8) return "text-orange-600";
  return "text-red-600";
}

export function getRiskColor(level: string): string {
  switch (level) {
    case "LOW": return "bg-green-100 text-green-700 border-green-200";
    case "MEDIUM": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "HIGH": return "bg-orange-100 text-orange-700 border-orange-200";
    case "CRITICAL": return "bg-red-100 text-red-700 border-red-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function getPerformanceColor(level: string): string {
  switch (level) {
    case "EXCELLENT": return "from-green-500 to-emerald-500";
    case "VERY_GOOD": return "from-blue-500 to-cyan-500";
    case "GOOD": return "from-cyan-500 to-teal-500";
    case "FAIR": return "from-yellow-500 to-orange-500";
    case "WEAK": return "from-orange-500 to-red-500";
    default: return "from-gray-500 to-gray-600";
  }
}

// ============================================
// CONFIGURATION APP
// ============================================

export const APP_CONFIG = {
  name: "EduPilot",
  version: "2.0.0",
  country: "Bénin",
  currency: "XOF",
  timezone: "Africa/Porto-Novo",
  grading: {
    min: 0,
    max: 20,
    passing: 10,
    excellent: 16,
  },
  pagination: {
    defaultPageSize: 50,
    maxPageSize: 200,
  },
};

// ============================================
// UTILITAIRES
// ============================================

export function formatCurrency(
  amount: number,
  currency: string = "XOF",
  locale: string = "fr-FR"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  });
}

export function formatShortDate(date: Date | string): string {
  return formatDate(date, { month: "short", day: "numeric" });
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "À l'instant";
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return formatDate(d);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[àáâãäå]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/ñ/g, "n")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), wait);
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) await sleep(delay * Math.pow(2, i));
    }
  }
  throw lastError;
}
