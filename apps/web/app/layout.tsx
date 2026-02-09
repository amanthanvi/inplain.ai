import type { ReactNode } from "react";

import { Fraunces, Space_Grotesk } from "next/font/google";

import "./globals.css";

import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Inplain.ai",
  description: "Track, diff, and understand privacy policy changes with citation-backed summaries.",
};

const displayFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
});

export default async function RootLayout({ children }: { children: ReactNode }) {
  const clerkEnabled = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );

  const shell = (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable}`}>
      <body>
        <div className="appShell">
          <SiteHeader clerkEnabled={clerkEnabled} />
          <div className="appMain">{children}</div>
          <SiteFooter />
        </div>
      </body>
    </html>
  );

  if (!clerkEnabled) {
    return shell;
  }

  const { ClerkProvider } = await import("@clerk/nextjs");

  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      {shell}
    </ClerkProvider>
  );
}
