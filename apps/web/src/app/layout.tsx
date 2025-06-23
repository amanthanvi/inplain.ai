import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { AppStatus } from '@/components/AppStatus'
import { Providers } from './providers'
import { DevAuthWarning } from '@/components/dev-auth-warning'
import { DemoModeBanner } from '@/components/demo-mode-banner'
import { Navigation } from '@/components/Navigation'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']
})

export const metadata: Metadata = {
  title: 'PolicyDiff - Track Privacy Policy Changes',
  description: 'Monitor and understand changes to privacy policies and terms of service with AI-powered summaries',
  keywords: ['privacy policy', 'terms of service', 'policy tracking', 'gdpr', 'data privacy'],
  authors: [{ name: 'PolicyDiff' }],
  openGraph: {
    title: 'PolicyDiff - Track Privacy Policy Changes',
    description: 'Monitor and understand changes to privacy policies and terms of service',
    url: 'https://policydiff.com',
    siteName: 'PolicyDiff',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PolicyDiff - Track Privacy Policy Changes',
    description: 'Monitor and understand changes to privacy policies and terms of service',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={`${inter.className} font-sans`}>
        <Providers>
          <div className="relative min-h-screen bg-background">
          <Navigation />
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6 md:py-0">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
              <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                Built to help you understand privacy policy changes. 
                {' '}
                <a
                  href="https://github.com/policydiff/policydiff"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  Open Source
                </a>
                .
              </p>
            </div>
          </footer>
        </div>
        <Toaster />
        <AppStatus />
        <DevAuthWarning />
        <DemoModeBanner />
        </Providers>
      </body>
    </html>
  )
}