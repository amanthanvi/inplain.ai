import * as React from "react"
import { cn } from "@/lib/utils"

interface PremiumTooltipProps {
	children: React.ReactNode
	content: React.ReactNode
	side?: "top" | "right" | "bottom" | "left"
	align?: "start" | "center" | "end"
	delayDuration?: number
}

function PremiumTooltip({
	children,
	content,
	side = "top",
	align = "center",
	delayDuration = 200,
}: PremiumTooltipProps) {
	const [isVisible, setIsVisible] = React.useState(false)
	const timeoutRef = React.useRef<NodeJS.Timeout>()

	const handleMouseEnter = () => {
		timeoutRef.current = setTimeout(() => {
			setIsVisible(true)
		}, delayDuration)
	}

	const handleMouseLeave = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current)
		}
		setIsVisible(false)
	}

	React.useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [])

	return (
		<div className="relative inline-block">
			<div
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				{children}
			</div>
			{isVisible && (
				<div
					className={cn(
						"absolute z-50 overflow-hidden rounded-lg bg-card/95 backdrop-blur-md px-3 py-1.5 text-sm text-card-foreground shadow-xl border border-border/50 animate-in fade-in-0 zoom-in-95",
						side === "top" && "bottom-full left-1/2 -translate-x-1/2 mb-2",
						side === "bottom" && "top-full left-1/2 -translate-x-1/2 mt-2",
						side === "left" && "right-full top-1/2 -translate-y-1/2 mr-2",
						side === "right" && "left-full top-1/2 -translate-y-1/2 ml-2",
						align === "start" && (side === "top" || side === "bottom") && "left-0 translate-x-0",
						align === "end" && (side === "top" || side === "bottom") && "left-auto right-0 translate-x-0",
						align === "start" && (side === "left" || side === "right") && "top-0 translate-y-0",
						align === "end" && (side === "left" || side === "right") && "top-auto bottom-0 translate-y-0"
					)}
				>
					{content}
				</div>
			)}
		</div>
	)
}

export { PremiumTooltip }