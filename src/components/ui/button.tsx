import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-apogee-abyss transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apogee-cobalt/70 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    {
        variants: {
            variant: {
                default:
                    "bg-gradient-to-r from-apogee-cobalt/90 via-apogee-cobalt to-apogee-emerald/90 text-white shadow-[0_12px_30px_rgba(30,60,140,0.35)] hover:shadow-[0_16px_40px_rgba(30,60,140,0.5)]",
                destructive:
                    "bg-gradient-to-r from-apogee-crimson/90 to-apogee-crimson text-white shadow-[0_10px_24px_rgba(180,40,80,0.4)] hover:shadow-[0_16px_32px_rgba(180,40,80,0.5)]",
                outline:
                    "border border-white/15 bg-white/5 text-white backdrop-blur hover:border-white/30 hover:bg-white/10",
                secondary:
                    "bg-apogee-slate/80 text-white border border-white/10 hover:bg-apogee-graphite/80",
                ghost: "text-apogee-metal hover:bg-white/10 hover:text-white",
                link: "text-apogee-cobalt underline-offset-4 hover:underline",
            },
            size: {
                default: "h-10 px-4 py-2",
                sm: "h-9 rounded-md px-3 text-xs",
                lg: "h-11 rounded-md px-8 text-base",
                icon: "h-10 w-10",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
