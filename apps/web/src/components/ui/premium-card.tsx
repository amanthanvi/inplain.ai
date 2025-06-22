import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const premiumCardVariants = cva(
	"rounded-xl transition-all duration-300",
	{
		variants: {
			variant: {
				default: "bg-card text-card-foreground shadow-premium border border-border/50",
				elevated: "bg-card text-card-foreground shadow-xl hover:shadow-2xl hover:-translate-y-1",
				glass: "glass shadow-lg hover:shadow-xl",
				gradient: "gradient-subtle border border-border/30 shadow-lg",
				outlined: "border-2 border-border bg-transparent hover:border-primary/50 hover:shadow-md",
			},
			padding: {
				none: "",
				sm: "p-4",
				default: "p-6",
				lg: "p-8",
				xl: "p-10",
			},
		},
		defaultVariants: {
			variant: "default",
			padding: "default",
		},
	}
)

export interface PremiumCardProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof premiumCardVariants> {
	hover?: boolean
	glow?: boolean
}

const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
	({ className, variant, padding, hover = false, glow = false, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(
					premiumCardVariants({ variant, padding }),
					hover && "hover-lift",
					glow && "hover-glow",
					className
				)}
				{...props}
			/>
		)
	}
)
PremiumCard.displayName = "PremiumCard"

const PremiumCardHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex flex-col space-y-1.5", className)}
		{...props}
	/>
))
PremiumCardHeader.displayName = "PremiumCardHeader"

const PremiumCardTitle = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
	<h3
		ref={ref}
		className={cn(
			"text-2xl font-semibold leading-none tracking-tight",
			className
		)}
		{...props}
	/>
))
PremiumCardTitle.displayName = "PremiumCardTitle"

const PremiumCardDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p
		ref={ref}
		className={cn("text-sm text-muted-foreground", className)}
		{...props}
	/>
))
PremiumCardDescription.displayName = "PremiumCardDescription"

const PremiumCardContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("pt-6", className)} {...props} />
))
PremiumCardContent.displayName = "PremiumCardContent"

const PremiumCardFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		className={cn("flex items-center pt-6", className)}
		{...props}
	/>
))
PremiumCardFooter.displayName = "PremiumCardFooter"

export {
	PremiumCard,
	PremiumCardHeader,
	PremiumCardFooter,
	PremiumCardTitle,
	PremiumCardDescription,
	PremiumCardContent,
	premiumCardVariants,
}