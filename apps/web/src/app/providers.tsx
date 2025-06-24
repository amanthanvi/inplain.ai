'use client'

import { ToastProvider } from '@/contexts/toast-context'
import { EnvProvider } from '@/providers/env-provider'
import { GlobalErrorBoundary } from '@/components/error/GlobalErrorBoundary'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
	return (
		<GlobalErrorBoundary>
			<EnvProvider>
				<ToastProvider>
					{children}
				</ToastProvider>
			</EnvProvider>
		</GlobalErrorBoundary>
	)
}