'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { EnvProvider } from '@/providers/env-provider'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
	return (
		<EnvProvider>
			<AuthProvider>
				{children}
			</AuthProvider>
		</EnvProvider>
	)
}