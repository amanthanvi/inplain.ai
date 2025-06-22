'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'lucide-react'
import { PremiumSearch } from './PremiumSearch'
import { Button } from './ui/button'
import type { SearchResult } from '@/lib/search-service'

export function GlobalSearchBar() {
	const router = useRouter()
	const [showSearch, setShowSearch] = useState(false)

	// Keyboard shortcut (Cmd/Ctrl + K)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
				e.preventDefault()
				setShowSearch(true)
			}
			if (e.key === 'Escape') {
				setShowSearch(false)
			}
		}

		document.addEventListener('keydown', handleKeyDown)
		return () => document.removeEventListener('keydown', handleKeyDown)
	}, [])

	const handleResultClick = (result: SearchResult) => {
		setShowSearch(false)
		
		// Navigate based on result type
		switch (result.type) {
			case 'company':
				router.push(`/${result.id}`)
				break
			case 'diff':
				// Navigate to company page with diff highlighted
				router.push(`/${result.metadata.company}?diff=${result.id}`)
				break
			case 'insight':
				// Navigate to analytics page
				router.push(`/${result.metadata.company}/analytics`)
				break
		}
	}

	return (
		<>
			{/* Search Trigger Button */}
			<Button
				variant="outline"
				className="relative w-full max-w-sm mx-auto justify-start text-sm text-muted-foreground"
				onClick={() => setShowSearch(true)}
			>
				<span className="flex items-center gap-2">
					Search policies...
					<kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
						<Command className="h-3 w-3" />K
					</kbd>
				</span>
			</Button>

			{/* Search Modal */}
			{showSearch && (
				<div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
					<div className="fixed left-[50%] top-[20%] z-50 w-full max-w-2xl translate-x-[-50%] p-4 animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[20%]">
						<PremiumSearch
							onResultClick={handleResultClick}
							autoFocus
							showFilters
							className="w-full"
						/>
						<p className="text-xs text-muted-foreground text-center mt-4">
							Press <kbd className="px-1 py-0.5 text-xs bg-muted rounded">ESC</kbd> to close
						</p>
					</div>
					<div
						className="absolute inset-0"
						onClick={() => setShowSearch(false)}
					/>
				</div>
			)}
		</>
	)
}