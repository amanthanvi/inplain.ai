import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
	"relative w-full rounded-lg border p-4 transition-all duration-300 animate-in fade-in-0 slide-in-from-top-1",
	{
		variants: {
			variant: {
				default: "bg-background text-foreground border-border",
				info: "bg-[hsl(var(--info)/0.05)] text-[hsl(var(--info))] border-[hsl(var(--info)/0.2)] [&>svg]:text-[hsl(var(--info))]",
				success: "bg-[hsl(var(--success)/0.05)] text-[hsl(var(--success))] border-[hsl(var(--success)/0.2)] [&>svg]:text-[hsl(var(--success))]",
				warning: "bg-[hsl(var(--warning)/0.05)] text-[hsl(var(--warning))] border-[hsl(var(--warning)/0.2)] [&>svg]:text-[hsl(var(--warning))]",
				destructive: "bg-destructive/5 text-destructive border-destructive/20 [&>svg]:text-destructive",
				premium: "gradient-subtle border-primary/20 shadow-lg",
			},
			size: {
				default: "p-4",
				sm: "p-3 text-sm",
				lg: "p-6 text-lg",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
)

const Alert = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, size, ...props }, ref) => (
	<div
		ref={ref}
		role="alert"
		className={cn(alertVariants({ variant, size }), className)}
		{...props}
	/>
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h5
		ref={ref}
		className={cn("mb-1 font-semibold leading-none tracking-tight", className)}
		{...props}
	/>
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("text-sm [&_p]:leading-relaxed opacity-90", className)}
		{...props}
	/>
))
AlertDescription.displayName = "AlertDescription"

const AlertIcon = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("absolute left-4 top-4 h-4 w-4", className)}
		{...props}
	/>
))
AlertIcon.displayName = "AlertIcon"

export { Alert, AlertTitle, AlertDescription, AlertIcon }