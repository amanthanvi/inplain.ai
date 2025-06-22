import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const premiumBadgeVariants = cva(
	"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all duration-200",
	{
		variants: {
			variant: {
				default:
					"bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20",
				secondary:
					"bg-secondary/10 text-secondary border border-secondary/20 hover:bg-secondary/20",
				success:
					"bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))] border border-[hsl(var(--success)/0.2)] hover:bg-[hsl(var(--success)/0.2)]",
				warning:
					"bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))] border border-[hsl(var(--warning)/0.2)] hover:bg-[hsl(var(--warning)/0.2)]",
				destructive:
					"bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20",
				outline:
					"text-foreground border border-border hover:bg-accent hover:text-accent-foreground",
				premium:
					"gradient-primary text-white border-0 shadow-sm hover:shadow-md",
				glass:
					"glass text-foreground border border-border/50",
			},
			size: {
				default: "px-2.5 py-0.5 text-xs",
				sm: "px-2 py-0.5 text-[10px]",
				lg: "px-3 py-1 text-sm",
			},
			pulse: {
				true: "animate-pulse",
				false: "",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
			pulse: false,
		},
	}
)

export interface PremiumBadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof premiumBadgeVariants> {
	icon?: React.ReactNode
}

function PremiumBadge({
	className,
	variant,
	size,
	pulse,
	icon,
	children,
	...props
}: PremiumBadgeProps) {
	return (
		<div
			className={cn(premiumBadgeVariants({ variant, size, pulse }), className)}
			{...props}
		>
			{icon && <span className="mr-1">{icon}</span>}
			{children}
		</div>
	)
}

export { PremiumBadge, premiumBadgeVariants }