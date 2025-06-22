'use client'

import { AuthProvider } from '@/contexts/auth-context'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
	return <AuthProvider>{children}</AuthProvider>
}