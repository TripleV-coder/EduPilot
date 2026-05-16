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
  Loader2
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

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
  warning: <AlertTriangle className="h-4 w-4 text-warning" />,
  info: <Info className="h-4 w-4 text-info" />,
  loading: <Loader2 className="h-4 w-4 text-text-secondary animate-spin" />,
};

const toastStyles: Record<ToastType, string> = {
  success: "border-l-success",
  error: "border-l-destructive",
  warning: "border-l-warning",
  info: "border-l-info",
  loading: "border-l-text-secondary",
};

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
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 20, scale: 0.95 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={cn(
        "relative w-full max-w-sm bg-[hsl(var(--surface-base))] border border-border border-l-4 rounded-sm shadow-lg overflow-hidden",
        toastStyles[toast.type]
      )}
    >
      {/* Progress bar */}
      {toast.type !== "loading" && (
        <div
          className="absolute bottom-0 left-0 h-[2px] bg-border transition-all duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      )}

      <div className="flex items-start gap-3 p-3">
        <div className="mt-0.5 flex-shrink-0">{toastIcons[toast.type]}</div>
        
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-text-primary leading-snug">{toast.message}</p>
          
          {toast.action && (
            <button
              onClick={() => {
                toast.action?.onClick();
                onDismiss(toast.id);
              }}
              className="mt-2 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {toast.action.label}
            </button>
          )}
        </div>

        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 p-1 rounded-sm opacity-60 hover:opacity-100 hover:bg-muted transition-colors"
        >
          <X className="h-3.5 w-3.5 text-text-secondary" />
        </button>
      </div>
    </motion.div>
  );
}

export function SwissToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((props: Omit<Toast, "id">) => {
    const id = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    const newToast = { ...props, id };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const success = useCallback(
    (message: string, duration = 4000) => toast({ message, type: "success", duration }),
    [toast]
  );

  const error = useCallback(
    (message: string, duration = 5000) => toast({ message, type: "error", duration }),
    [toast]
  );

  const warning = useCallback(
    (message: string, duration = 4000) => toast({ message, type: "warning", duration }),
    [toast]
  );

  const info = useCallback(
    (message: string, duration = 4000) => toast({ message, type: "info", duration }),
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
          t.id === id ? { ...t, type, message, duration: type === "success" ? 4000 : 5000 } : t
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
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm pointer-events-none">
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

export function useSwissToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useSwissToast must be used within a SwissToastProvider");
  }
  return context;
}

export default SwissToastProvider;
