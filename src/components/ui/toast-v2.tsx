"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Loader2,
} from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info" | "loading";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastContextType {
  toast: (props: Omit<Toast, "id">) => string;
  dismiss: (id: string) => void;
  success: (message: string, duration?: number) => string;
  error: (message: string, duration?: number) => string;
  warning: (message: string, duration?: number) => string;
  info: (message: string, duration?: number) => string;
  loading: (message: string) => string;
  updateLoading: (id: string, type: "success" | "error", message: string) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

// Toast configuration with glassmorphism styles
const toastConfig: Record<
  ToastType,
  {
    icon: React.ReactNode;
    borderColor: string;
    bgGradient: string;
    iconBg: string;
  }
> = {
  success: {
    icon: <CheckCircle2 className="h-5 w-5 text-[#4A9E7A]" />,
    borderColor: "border-l-[#2D7A5F]",
    bgGradient: "from-[#2D7A5F]/10 to-transparent",
    iconBg: "bg-[#2D7A5F]/20",
  },
  error: {
    icon: <AlertCircle className="h-5 w-5 text-red-400" />,
    borderColor: "border-l-red-500",
    bgGradient: "from-red-500/10 to-transparent",
    iconBg: "bg-red-500/20",
  },
  warning: {
    icon: <AlertTriangle className="h-5 w-5 text-amber-400" />,
    borderColor: "border-l-amber-500",
    bgGradient: "from-amber-500/10 to-transparent",
    iconBg: "bg-amber-500/20",
  },
  info: {
    icon: <Info className="h-5 w-5 text-blue-400" />,
    borderColor: "border-l-blue-500",
    bgGradient: "from-blue-500/10 to-transparent",
    iconBg: "bg-blue-500/20",
  },
  loading: {
    icon: <Loader2 className="h-5 w-5 text-white/60 animate-spin" />,
    borderColor: "border-l-white/40",
    bgGradient: "from-white/5 to-transparent",
    iconBg: "bg-white/10",
  },
};

// Animated icon wrapper
function AnimatedIcon({
  type,
  children,
}: {
  type: ToastType;
  children: React.ReactNode;
}) {
  const prefersReducedMotion = useReducedMotion();
  const config = toastConfig[type];

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 15,
        delay: prefersReducedMotion ? 0 : 0.1,
      }}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl shrink-0",
        "backdrop-blur-sm border border-white/10",
        config.iconBg
      )}
    >
      {children}
    </motion.div>
  );
}

// Individual Toast Item Component
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration || 4000;
  const prefersReducedMotion = useReducedMotion();
  const config = toastConfig[toast.type];

  useEffect(() => {
    if (toast.type === "loading" || isPaused) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        onDismiss(toast.id);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [toast.id, toast.type, duration, isPaused, onDismiss]);

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={
        prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 0, y: -20, scale: 0.9, x: 20 }
      }
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 100, scale: 0.9 }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }
      }
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        "relative w-full max-w-sm overflow-hidden rounded-xl",
        "bg-gradient-to-r from-white/10 to-white/5",
        "backdrop-blur-xl border border-white/20",
        "shadow-2xl shadow-black/20",
        "border-l-4",
        config.borderColor
      )}
    >
      {/* Background gradient effect */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-r opacity-50 pointer-events-none",
          config.bgGradient
        )}
      />

      {/* Progress bar */}
      {toast.type !== "loading" && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <motion.div
            className={cn(
              "h-full",
              toast.type === "success" && "bg-[#2D7A5F]",
              toast.type === "error" && "bg-red-500",
              toast.type === "warning" && "bg-amber-500",
              toast.type === "info" && "bg-blue-500"
            )}
            initial={{ width: "100%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0, ease: "linear" }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative flex items-start gap-4 p-4">
        <AnimatedIcon type={toast.type}>{config.icon}</AnimatedIcon>

        <div className="flex-1 min-w-0 pt-1">
          <p className="text-sm font-medium text-white leading-relaxed">
            {toast.message}
          </p>

          {toast.action && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
              className={cn(
                "mt-3 text-xs font-semibold uppercase tracking-wider",
                "px-3 py-1.5 rounded-lg",
                "bg-white/10 hover:bg-white/20",
                "text-white/80 hover:text-white",
                "transition-colors duration-200",
                "border border-white/10"
              )}
            >
              {toast.action.label}
            </motion.button>
          )}
        </div>

        {/* Close button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onDismiss(toast.id)}
          className={cn(
            "flex-shrink-0 p-2 rounded-lg",
            "bg-white/5 hover:bg-white/10",
            "text-white/50 hover:text-white",
            "transition-all duration-200",
            "border border-transparent hover:border-white/10"
          )}
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}

// Toast Provider Component
export function ToastV2Provider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((props: Omit<Toast, "id">) => {
    const id = (
      globalThis.crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    );
    const newToast = { ...props, id };
    setToasts((prev) => [...prev.slice(-4), newToast]); // Keep max 5 toasts
    return id;
  }, []);

  const success = useCallback(
    (message: string, duration = 4000) =>
      toast({ message, type: "success", duration }),
    [toast]
  );

  const error = useCallback(
    (message: string, duration = 5000) =>
      toast({ message, type: "error", duration }),
    [toast]
  );

  const warning = useCallback(
    (message: string, duration = 4000) =>
      toast({ message, type: "warning", duration }),
    [toast]
  );

  const info = useCallback(
    (message: string, duration = 4000) =>
      toast({ message, type: "info", duration }),
    [toast]
  );

  const loading = useCallback(
    (message: string) => toast({ message, type: "loading", duration: Infinity }),
    [toast]
  );

  const updateLoading = useCallback(
    (id: string, type: "success" | "error", message: string) => {
      setToasts((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, type, message, duration: type === "success" ? 4000 : 5000 }
            : t
        )
      );
    },
    []
  );

  return (
    <ToastContext.Provider
      value={{ toast, dismiss, success, error, warning, info, loading, updateLoading }}
    >
      {children}
      {/* Toast container - desktop top-right, mobile bottom-center */}
      <div
        className={cn(
          "fixed z-[100] flex flex-col gap-3 w-full max-w-sm pointer-events-none",
          "top-4 right-4",
          "sm:top-4 sm:right-4",
          "max-sm:top-auto max-sm:bottom-4 max-sm:right-1/2 max-sm:translate-x-1/2 max-sm:px-4"
        )}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

// Hook to use toast
export function useToastV2() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToastV2 must be used within a ToastV2Provider");
  }
  return context;
}

export default ToastV2Provider;
