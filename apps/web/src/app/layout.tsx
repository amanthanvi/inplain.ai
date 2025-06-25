import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { AppStatus } from '@/components/AppStatus'
import { Providers } from './providers'
import { DevAuthWarning } from '@/components/dev-auth-warning'
import { DemoModeBanner } from '@/components/demo-mode-banner'
import { Navigation } from '@/components/Navigation'
import { MobileNavigation, MobileBottomNav } from '@/components/MobileNavigation'
import { ClerkProvider } from '@clerk/nextjs'
import { Analytics } from '@vercel/analytics/next'

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif']
})

export const metadata: Metadata = {
  title: 'Inplain.AI - Privacy policies made simple',
  description: 'AI-powered privacy policy monitoring and analysis. Understand privacy policies and terms of service with clear, intelligent summaries.',
  keywords: ['privacy policy', 'terms of service', 'policy tracking', 'gdpr', 'data privacy'],
  authors: [{ name: 'Inplain.AI' }],
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    other: [
      { rel: 'mask-icon', url: '/favicon.ico', color: '#6366f1' },
      { rel: 'msapplication-config', url: '/browserconfig.xml' },
    ],
  },
  manifest: '/site.webmanifest',
  themeColor: '#6366f1',
  openGraph: {
    title: 'Inplain.AI - Privacy policies made simple',
    description: 'AI-powered privacy policy monitoring and analysis',
    url: 'https://inplain.ai',
    siteName: 'Inplain.AI',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inplain.AI - Privacy policies made simple',
    description: 'AI-powered privacy policy monitoring and analysis',
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
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning className={inter.variable}>
        <body className={`${inter.className} font-sans`}>
          <Providers>
            <div className="relative min-h-screen bg-background">
            {/* Desktop Navigation */}
            <div className="hidden md:block">
              <Navigation />
            </div>
            {/* Mobile Navigation */}
            <div className="md:hidden">
              <MobileNavigation />
            </div>
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
            {/* Mobile Bottom Navigation */}
            <MobileBottomNav />
            <footer className="border-t py-6 md:py-0 hidden md:block">
              <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
                <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
                  Built to help you understand privacy policy changes. 
                  {' '}
                  <a
                    href="https://github.com/inplain-ai/inplain.ai"
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
          <Analytics />
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}