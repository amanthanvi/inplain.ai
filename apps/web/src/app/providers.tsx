'use client'

import { ToastProvider } from '@/contexts/toast-context'
import { EnvProvider } from '@/providers/env-provider'
import { GlobalErrorBoundary } from '@/components/error/GlobalErrorBoundary'
import { PerformanceProvider } from '@/components/performance/PerformanceProvider'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
	return (
		<GlobalErrorBoundary>
			<EnvProvider>
				<ToastProvider>
					<PerformanceProvider enableMonitoring={process.env.NODE_ENV === 'production'}>
						{children}
					</PerformanceProvider>
				</ToastProvider>
			</EnvProvider>
		</GlobalErrorBoundary>
	)
}