import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { AppStatus } from '@/components/AppStatus'

const inter = Inter({ subsets: ['latin'] })

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
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <div className="relative min-h-screen bg-background">
          <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center">
              <div className="mr-4 flex">
                <a className="mr-6 flex items-center space-x-2" href="/">
                  <span className="font-bold text-xl">PolicyDiff</span>
                </a>
                <nav className="flex items-center space-x-6 text-sm font-medium">
                  <a
                    className="transition-colors hover:text-foreground/80 text-foreground/60"
                    href="/"
                  >
                    Dashboard
                  </a>
                  <a
                    className="transition-colors hover:text-foreground/80 text-foreground/60"
                    href="/about"
                  >
                    About
                  </a>
                </nav>
              </div>
            </div>
          </header>
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
      </body>
    </html>
  )
}