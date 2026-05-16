"use client";

import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { motion, useReducedMotion } from "framer-motion";
import {
  Controller,
  FormProvider,
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";

const Form = FormProvider;

type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  if (!itemContext) {
    throw new Error("useFormField should be used within <FormItem>");
  }

  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue | null>(null);

// Glassmorphism Form Item with animation
const FormItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const id = React.useId();
  const prefersReducedMotion = useReducedMotion();
  // Strip handlers that conflict with framer-motion's drag types.
  const { onDrag, onDragStart, onDragEnd, onAnimationStart, ...rest } = props;
  void onDrag;
  void onDragStart;
  void onDragEnd;
  void onAnimationStart;

  return (
    <FormItemContext.Provider value={{ id }}>
      <motion.div
        ref={ref}
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={cn("space-y-2", className)}
        {...rest}
      >
        {children}
      </motion.div>
    </FormItemContext.Provider>
  );
});
FormItem.displayName = "FormItem";

// Animated Label with focus states
const FormLabel = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return (
    <Label
      ref={ref}
      className={cn(
        "flex items-center gap-2 text-sm font-medium",
        "text-white/80",
        error && "text-red-400",
        className
      )}
      htmlFor={formItemId}
      {...props}
    />
  );
});
FormLabel.displayName = "FormLabel";

// Glassmorphism Form Control wrapper
const FormControl = React.forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>(({ ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  return (
    <Slot
      ref={ref}
      id={formItemId}
      aria-describedby={
        !error
          ? `${formDescriptionId}`
          : `${formDescriptionId} ${formMessageId}`
      }
      aria-invalid={!!error}
      {...props}
    />
  );
});
FormControl.displayName = "FormControl";

// Animated Description
const FormDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { formDescriptionId } = useFormField();
  const { onDrag, onDragStart, onDragEnd, onAnimationStart, ...rest } = props;
  void onDrag;
  void onDragStart;
  void onDragEnd;
  void onAnimationStart;

  return (
    <motion.p
      ref={ref}
      id={formDescriptionId}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn("text-[0.8rem] text-white/50", className)}
      {...rest}
    >
      {children}
    </motion.p>
  );
});
FormDescription.displayName = "FormDescription";

// Animated Error Message with icon
const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const prefersReducedMotion = useReducedMotion();
  const body = error ? String(error?.message ?? "") : children;
  const { onDrag, onDragStart, onDragEnd, onAnimationStart, ...rest } = props;
  void onDrag;
  void onDragStart;
  void onDragEnd;
  void onAnimationStart;

  if (!body) {
    return null;
  }

  return (
    <motion.p
      ref={ref}
      id={formMessageId}
      initial={prefersReducedMotion ? {} : { opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-center gap-1.5 text-[0.8rem] font-medium text-red-400",
        className
      )}
      {...rest}
    >
      <AlertCircle className="h-3.5 w-3.5" />
      {body}
    </motion.p>
  );
});
FormMessage.displayName = "FormMessage";

// Glassmorphism Input Component
const GlassInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  const { error } = useFormField();
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className="relative">
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl px-4 py-2 text-sm",
          "bg-white/5 backdrop-blur-sm",
          "border border-white/10",
          "text-white placeholder:text-white/40",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/50 focus:border-[#2D7A5F]/50",
          "hover:bg-white/10 hover:border-white/20",
          error && "border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50",
          className
        )}
        ref={ref}
        onFocus={(e) => {
          setIsFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setIsFocused(false);
          props.onBlur?.(e);
        }}
        {...props}
      />
      {error && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <AlertCircle className="h-5 w-5 text-red-400" />
        </div>
      )}
    </div>
  );
});
GlassInput.displayName = "GlassInput";

// Glassmorphism Textarea Component
const GlassTextarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  const { error } = useFormField();

  return (
    <textarea
      className={cn(
        "flex min-h-[100px] w-full rounded-xl px-4 py-3 text-sm",
        "bg-white/5 backdrop-blur-sm",
        "border border-white/10",
        "text-white placeholder:text-white/40",
        "transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/50 focus:border-[#2D7A5F]/50",
        "hover:bg-white/10 hover:border-white/20",
        "resize-y",
        error && "border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
GlassTextarea.displayName = "GlassTextarea";

// Glassmorphism Select Component
const GlassSelect = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  const { error } = useFormField();

  return (
    <div className="relative">
      <select
        className={cn(
          "flex h-11 w-full rounded-xl px-4 py-2 text-sm appearance-none",
          "bg-white/5 backdrop-blur-sm",
          "border border-white/10",
          "text-white",
          "transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/50 focus:border-[#2D7A5F]/50",
          "hover:bg-white/10 hover:border-white/20",
          error && "border-red-500/50 focus:ring-red-500/30 focus:border-red-500/50",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
      {/* Custom arrow */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg
          className="h-4 w-4 text-white/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
});
GlassSelect.displayName = "GlassSelect";

// Form Section with glassmorphism card
interface FormSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
  ({ title, description, children, className }, ref) => {
    const prefersReducedMotion = useReducedMotion();

    return (
      <motion.div
        ref={ref}
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className={cn(
          "rounded-2xl p-6",
          "bg-gradient-to-br from-white/10 to-white/5",
          "backdrop-blur-xl",
          "border border-white/20",
          "shadow-xl shadow-black/10",
          className
        )}
      >
        {(title || description) && (
          <div className="mb-6 space-y-1">
            {title && (
              <h3 className="text-lg font-semibold text-white">{title}</h3>
            )}
            {description && (
              <p className="text-sm text-white/60">{description}</p>
            )}
          </div>
        )}
        <div className="space-y-4">{children}</div>
      </motion.div>
    );
  }
);
FormSection.displayName = "FormSection";

// Submit button with glassmorphism
interface FormSubmitButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
}

const FormSubmitButton = React.forwardRef<
  HTMLButtonElement,
  FormSubmitButtonProps
>(
  (
    { className, children, isLoading, loadingText = "Chargement...", type = "submit", ...props },
    ref
  ) => {
    const { onDrag, onDragStart, onDragEnd, onAnimationStart, ...rest } = props;
    void onDrag;
    void onDragStart;
    void onDragEnd;
    void onAnimationStart;
    return (
      <motion.button
        ref={ref}
        type={type}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        disabled={isLoading || rest.disabled}
        className={cn(
          "relative inline-flex items-center justify-center",
          "h-11 px-6 rounded-xl",
          "bg-gradient-to-r from-[#2D7A5F] to-[#1E5340]",
          "text-white font-medium text-sm",
          "shadow-lg shadow-[#2D7A5F]/25",
          "transition-all duration-200",
          "hover:shadow-xl hover:shadow-[#2D7A5F]/30",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "focus:outline-none focus:ring-2 focus:ring-[#2D7A5F]/50",
          className
        )}
        {...rest}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {loadingText}
          </>
        ) : (
          children
        )}
      </motion.button>
    );
  }
);
FormSubmitButton.displayName = "FormSubmitButton";

export {
  useFormField,
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
  FormField,
  GlassInput,
  GlassTextarea,
  GlassSelect,
  FormSection,
  FormSubmitButton,
};
