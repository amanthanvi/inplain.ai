'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { ToastProvider } from '@/contexts/toast-context'
import { EnvProvider } from '@/providers/env-provider'
import { GlobalErrorBoundary } from '@/components/error/GlobalErrorBoundary'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
	return (
		<GlobalErrorBoundary>
			<EnvProvider>
				<ToastProvider>
					<AuthProvider>
						{children}
					</AuthProvider>
				</ToastProvider>
			</EnvProvider>
		</GlobalErrorBoundary>
	)
}