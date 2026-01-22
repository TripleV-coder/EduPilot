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
            // Base styles
            "rounded-lg border bg-card text-card-foreground",
            // Variant styles
            variant === "default" && "border-border shadow-card",
            variant === "glass" && "border-border/50 bg-card/95 backdrop-blur-sm shadow-card",
            variant === "bordered" && "border-border shadow-none",
            variant === "elevated" && "border-transparent shadow-md",
            // Hover effect
            hover && "transition-shadow duration-200 hover:shadow-card-hover",
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
