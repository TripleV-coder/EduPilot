import * as React from "react"
import { cn } from "@/lib/utils"

// ============================================
// CARD COMPONENT (Professional SaaS Style)
// ============================================

const Card = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement> & {
        variant?: "default" | "glass" | "bordered" | "elevated"
        hover?: boolean
    }
>(({ className, variant = "default", hover = false, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "relative overflow-hidden rounded-xl border text-card-foreground",
            variant === "default" &&
            "border-white/10 bg-apogee-abyss/70 text-white shadow-[0_20px_50px_rgba(4,8,18,0.55)] backdrop-blur-xl",
            variant === "glass" &&
            "border-white/15 bg-white/5 text-white shadow-[0_18px_40px_rgba(4,8,18,0.45)] backdrop-blur-2xl",
            variant === "bordered" &&
            "border-white/15 bg-apogee-abyss/50 text-white shadow-none",
            variant === "elevated" &&
            "border-white/10 bg-apogee-slate/80 text-white shadow-[0_18px_40px_rgba(4,8,18,0.6)]",
            hover && "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_60px_rgba(4,8,18,0.65)]",
            className
        )}
        {...props}
    />
))
Card.displayName = "Card"

// ============================================
// CARD HEADER
// ============================================

const CardHeader = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex flex-col space-y-1 p-4 lg:p-5", className)}
        {...props}
    />
))
CardHeader.displayName = "CardHeader"

// ============================================
// CARD TITLE
// ============================================

const CardTitle = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
    <h3
        ref={ref}
        className={cn(
            "text-base font-semibold leading-none tracking-tight",
            className
        )}
        {...props}
    />
))
CardTitle.displayName = "CardTitle"

// ============================================
// CARD DESCRIPTION
// ============================================

const CardDescription = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
    <p
        ref={ref}
        className={cn("text-sm text-muted-foreground", className)}
        {...props}
    />
))
CardDescription.displayName = "CardDescription"

// ============================================
// CARD CONTENT
// ============================================

const CardContent = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 lg:p-5 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

// ============================================
// CARD FOOTER
// ============================================

const CardFooter = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn("flex items-center p-4 lg:p-5 pt-0", className)}
        {...props}
    />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
