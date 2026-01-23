"use client";

import { forwardRef, type HTMLAttributes, type ReactNode, useState } from "react";
import Image from "next/image";
import { cn, GRADIENTS } from "./tokens";

// ============================================
// CARD
// ============================================

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "gradient";
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", hover = false, children, ...props }, ref) => {
    const variants = {
      default: "bg-apogee-abyss/70 border border-white/10 text-white shadow-[0_20px_50px_rgba(4,8,18,0.55)]",
      glass: "bg-white/5 border-white/15 text-white backdrop-blur-2xl shadow-[0_18px_40px_rgba(4,8,18,0.45)]",
      gradient: "bg-gradient-to-br from-apogee-slate/80 to-apogee-abyss/80 border border-white/10 text-white",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl transition-all duration-300",
          variants[variant],
          hover && "hover:shadow-[0_24px_60px_rgba(4,8,18,0.6)] hover:border-white/20 cursor-pointer",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

// ============================================
// BUTTON
// ============================================

interface ButtonProps extends HTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg";
  gradient?: string;
  loading?: boolean;
  isDisabled?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", gradient, loading = false, isDisabled, children, ...props }, ref) => {
    const variants = {
      primary: gradient
        ? `bg-gradient-to-r ${gradient} text-white hover:shadow-[0_16px_40px_rgba(30,60,140,0.5)]`
        : "bg-gradient-to-r from-apogee-cobalt/90 to-apogee-emerald/90 text-white shadow-[0_12px_30px_rgba(30,60,140,0.35)] hover:shadow-[0_18px_40px_rgba(30,60,140,0.5)]",
      secondary: "bg-apogee-slate/80 text-white border border-white/10 hover:bg-apogee-graphite/80",
      outline: "border border-white/15 bg-white/5 text-white hover:bg-white/10",
      ghost: "text-apogee-metal hover:bg-white/10 hover:text-white",
      danger: "bg-apogee-crimson text-white hover:shadow-[0_16px_40px_rgba(180,40,80,0.5)]",
      success: "bg-apogee-emerald text-white hover:shadow-[0_16px_40px_rgba(60,160,120,0.5)]",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs",
      md: "h-10 px-4 py-2",
      lg: "h-12 px-8 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apogee-cobalt/60 focus-visible:ring-offset-2 focus-visible:ring-offset-apogee-abyss disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        disabled={isDisabled || loading}
        {...props}
      >
        {loading && (
          <svg className="mr-2 h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";

// ============================================
// BADGE
// ============================================

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline";
  size?: "sm" | "md";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const variants = {
      default: "bg-white/5 text-white border-white/10",
      success: "bg-apogee-emerald/15 text-apogee-emerald border-apogee-emerald/30",
      warning: "bg-apogee-gold/15 text-apogee-gold border-apogee-gold/30",
      danger: "bg-apogee-crimson/15 text-apogee-crimson border-apogee-crimson/30",
      info: "bg-apogee-cobalt/15 text-apogee-cobalt border-apogee-cobalt/30",
      outline: "border border-white/15 text-apogee-metal bg-transparent",
    };

    const sizes = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-2.5 py-0.5 text-sm",
    };

    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.22em] transition-colors",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

// ============================================
// AVATAR
// ============================================

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Avatar({ src, alt, fallback, size = "md", className, ...props }: AvatarProps) {
  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-12 w-12 text-base",
    xl: "h-16 w-16 text-lg",
  };

  return (
    <div className={cn("relative rounded-full overflow-hidden bg-white/10", sizes[size], className)} {...props}>
      {src ? (
        <Image src={src} alt={alt || "Avatar"} fill className="object-cover" sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw" />
      ) : (
        <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-apogee-cobalt to-apogee-emerald text-white font-medium">
          {fallback || alt?.charAt(0) || "?"}
        </div>
      )}
    </div>
  );
}

// ============================================
// PROGRESS
// ============================================

interface ProgressProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  gradient?: string;
  showLabel?: boolean;
}

export function Progress({ value, max = 100, gradient = GRADIENTS.primary, showLabel = false, className, ...props }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn("relative", className)} {...props}>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div className={cn("h-full bg-gradient-to-r transition-all duration-500", gradient)} style={{ width: `${percentage}%` }} />
      </div>
      {showLabel && <span className="absolute right-0 -top-5 text-xs font-medium text-apogee-metal/70">{value.toFixed(1)}%</span>}
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: { value: number; isPositive: boolean };
  gradient?: string;
  delay?: number;
}

export function StatCard({ title, value, subtitle, icon, trend, gradient = GRADIENTS.primary, delay = 0 }: StatCardProps) {
  return (
    <div className="animate-fade-in" style={{ animationDelay: `${delay}ms` }}>
      <Card className="p-6 h-full" hover>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-apogee-metal/70">{title}</p>
            <p className="text-3xl font-bold mt-2 text-white">{value}</p>
            {subtitle && <p className="text-sm text-apogee-metal/70 mt-1">{subtitle}</p>}
            {trend && (
              <div className={cn("flex items-center mt-2 text-sm", trend.isPositive ? "text-apogee-emerald" : "text-apogee-crimson")}>
                <span>{trend.isPositive ? "↑" : "↓"}</span>
                <span className="ml-1">{Math.abs(trend.value)}%</span>
              </div>
            )}
          </div>
          {icon && <div className={cn("p-3 rounded-xl bg-gradient-to-r text-white shadow-[0_16px_35px_rgba(4,8,18,0.5)]", gradient)}>{icon}</div>}
        </div>
      </Card>
    </div>
  );
}

// ============================================
// SKELETON
// ============================================

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, variant = "text", width, height, style, ...props }, ref) => {
    const variants = { text: "rounded", circular: "rounded-full", rectangular: "rounded-lg" };

    return (
      <div
        ref={ref}
        className={cn("animate-pulse bg-white/10", variants[variant], className)}
        style={{ width, height, ...style }}
        {...props}
      />
    );
  }
);
Skeleton.displayName = "Skeleton";

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="p-4 rounded-full bg-white/10 mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && <p className="text-sm text-apogee-metal/70 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ============================================
// SPINNER
// ============================================

interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

export function Spinner({ size = "md", className, ...props }: SpinnerProps) {
  const sizes = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };

  return (
    <div className={cn("flex items-center justify-center", className)} {...props}>
      <svg className={cn("animate-spin text-apogee-cobalt", sizes[size])} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

// ============================================
// TABS
// ============================================

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
  return (
    <div className={cn("flex space-x-1 rounded-lg border border-white/10 bg-apogee-abyss/70 p-1", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
            activeTab === tab.id ? "bg-white/10 text-white shadow-[0_12px_30px_rgba(4,8,18,0.4)]" : "text-apogee-metal/70 hover:text-white"
          )}
        >
          {tab.icon && <span className="mr-2">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============================================
// INPUT
// ============================================

interface InputProps extends HTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  type?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && <label className="text-sm font-medium">{label}</label>}
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-lg border border-white/10 bg-apogee-abyss/70 px-3 py-2 text-sm text-white ring-offset-apogee-abyss file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-apogee-metal/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apogee-cobalt/60 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-apogee-crimson focus-visible:ring-apogee-crimson/60",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-sm text-apogee-crimson">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

// ============================================
// SELECT
// ============================================

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends HTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, options, placeholder, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && <label className="text-sm font-medium">{label}</label>}
        <select
          className={cn(
            "flex h-10 w-full rounded-lg border border-white/10 bg-apogee-abyss/70 px-3 py-2 text-sm text-white ring-offset-apogee-abyss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apogee-cobalt/60 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          ref={ref}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);
Select.displayName = "Select";

// ============================================
// TEXTAREA
// ============================================

interface TextareaProps extends HTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && <label className="text-sm font-medium">{label}</label>}
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border border-white/10 bg-apogee-abyss/70 px-3 py-2 text-sm text-white ring-offset-apogee-abyss placeholder:text-apogee-metal/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apogee-cobalt/60 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-apogee-crimson focus-visible:ring-apogee-crimson/60",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="text-sm text-apogee-crimson">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

// ============================================
// CHECKBOX
// ============================================

interface CheckboxProps extends HTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, ...props }, ref) => {
    return (
      <label className={cn("flex items-center space-x-2 cursor-pointer", className)}>
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/30 text-apogee-cobalt focus:ring-apogee-cobalt/60"
          ref={ref}
          {...props}
        />
        {label && <span className="text-sm">{label}</span>}
      </label>
    );
  }
);
Checkbox.displayName = "Checkbox";

// ============================================
// SWITCH
// ============================================

interface SwitchProps extends HTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
}

export function Switch({ checked = false, onCheckedChange, label, className, ...props }: SwitchProps) {
  return (
    <label className={cn("flex items-center space-x-2 cursor-pointer", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          checked ? "bg-apogee-cobalt" : "bg-white/15"
        )}
        {...props}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

// ============================================
// DROPDOWN MENU
// ============================================

interface DropdownItem {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <div onClick={() => setOpen(!open)}>{trigger}</div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              "absolute z-50 mt-2 w-56 rounded-lg border border-white/10 bg-apogee-abyss/95 shadow-[0_20px_45px_rgba(4,8,18,0.6)] animate-fade-in backdrop-blur-2xl",
              align === "right" ? "right-0" : "left-0"
            )}
          >
            <div className="p-1">
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    item.onClick?.();
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-md px-2 py-1.5 text-sm transition-colors text-apogee-metal",
                    item.danger ? "text-apogee-crimson hover:bg-apogee-crimson/10" : "hover:bg-white/10 hover:text-white"
                  )}
                >
                  {item.icon && <span className="mr-2">{item.icon}</span>}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================
// MODAL DIALOG
// ============================================

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ open, onClose, title, description, children, size = "md" }: ModalProps) {
  if (!open) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-apogee-abyss/80" onClick={onClose} />
      <div className={cn("relative z-50 w-full rounded-xl border border-white/10 bg-apogee-abyss/95 p-6 text-white shadow-[0_30px_80px_rgba(4,8,18,0.7)] animate-scale-in backdrop-blur-2xl", sizes[size])}>
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="text-sm text-apogee-metal/70 mt-1">{description}</p>}
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

// ============================================
// ALERT
// ============================================

interface AlertProps {
  title: string;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
  icon?: ReactNode;
  action?: ReactNode;
}

export function Alert({ title, description, variant = "default", icon, action }: AlertProps) {
  const variants = {
    default: "bg-apogee-cobalt/10 border-apogee-cobalt/30 text-apogee-cobalt",
    success: "bg-apogee-emerald/10 border-apogee-emerald/30 text-apogee-emerald",
    warning: "bg-apogee-gold/10 border-apogee-gold/30 text-apogee-gold",
    danger: "bg-apogee-crimson/10 border-apogee-crimson/30 text-apogee-crimson",
  };

  return (
    <div className={cn("rounded-lg border p-4", variants[variant])}>
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5">{icon}</div>}
        <div className="flex-1">
          <h4 className="font-medium">{title}</h4>
          {description && <p className="text-sm mt-1 opacity-80">{description}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </div>
  );
}

// ============================================
// TOOLTIP
// ============================================

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <div className="group relative inline-block">
      {children}
      <div
        className={cn(
          "absolute z-50 px-2 py-1 text-xs text-white bg-apogee-abyss/95 border border-white/10 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap",
          side === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-2",
          side === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-2",
          side === "left" && "right-full top-1/2 -translate-y-1/2 mr-2",
          side === "right" && "left-full top-1/2 -translate-y-1/2 ml-2"
        )}
      >
        {content}
      </div>
    </div>
  );
}
