import * as React from "react"
import { cn } from "@/lib/utils"

interface PremiumProgressProps extends React.HTMLAttributes<HTMLDivElement> {
	value?: number
	max?: number
	variant?: "default" | "success" | "warning" | "danger" | "gradient"
	size?: "sm" | "default" | "lg"
	showLabel?: boolean
	animated?: boolean
}

const PremiumProgress = React.forwardRef<HTMLDivElement, PremiumProgressProps>(
	(
		{
			className,
			value = 0,
			max = 100,
			variant = "default",
			size = "default",
			showLabel = false,
			animated = true,
			...props
		},
		ref
	) => {
		const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

		const sizeClasses = {
			sm: "h-2",
			default: "h-3",
			lg: "h-4",
		}

		const variantClasses = {
			default: "bg-primary",
			success: "bg-[hsl(var(--success))]",
			warning: "bg-[hsl(var(--warning))]",
			danger: "bg-destructive",
			gradient: "gradient-primary",
		}

		return (
			<div className={cn("relative", className)} {...props}>
				<div
					ref={ref}
					className={cn(
						"w-full overflow-hidden rounded-full bg-muted",
						sizeClasses[size]
					)}
				>
					<div
						className={cn(
							"h-full transition-all duration-500 ease-out rounded-full",
							variantClasses[variant],
							animated && "animate-pulse"
						)}
						style={{ width: `${percentage}%` }}
					/>
				</div>
				{showLabel && (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="text-xs font-medium text-foreground">
							{Math.round(percentage)}%
						</span>
					</div>
				)}
			</div>
		)
	}
)
PremiumProgress.displayName = "PremiumProgress"

export { PremiumProgress }