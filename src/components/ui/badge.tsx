import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.24em] transition-colors focus:outline-none focus:ring-2 focus:ring-apogee-cobalt/60 focus:ring-offset-2 focus:ring-offset-apogee-abyss",
    {
        variants: {
            variant: {
                default:
                    "border-white/10 bg-white/5 text-white hover:bg-white/10",
                secondary:
                    "border-white/10 bg-apogee-slate/80 text-white hover:bg-apogee-graphite/80",
                destructive:
                    "border-apogee-crimson/40 bg-apogee-crimson/15 text-apogee-crimson",
                outline: "border-white/20 text-apogee-metal",
                success:
                    "border-apogee-emerald/40 bg-apogee-emerald/15 text-apogee-emerald",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
