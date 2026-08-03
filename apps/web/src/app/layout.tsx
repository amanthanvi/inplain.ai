import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AppStatus } from "@/components/AppStatus";
import { Providers } from "./providers";
import { DemoModeBanner } from "@/components/demo-mode-banner";
import { Navigation } from "@/components/Navigation";
import { MobileNavigation } from "@/components/mobile/MobileNavigation";
import { MobileOptimizations } from "@/components/mobile/MobileOptimizations";
import { ClerkProvider } from "./clerk-provider";
import { Analytics } from "@vercel/analytics/next";
import { PWAProvider } from "@/components/providers/PWAProvider";
import { SkipLinks } from "@/components/accessibility/SkipLinks";
import { AccessibilityAudit } from "@/components/accessibility/AccessibilityAudit";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";

const inter = Inter({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-inter",
	preload: true,
	fallback: [
		"system-ui",
		"-apple-system",
		"BlinkMacSystemFont",
		"Segoe UI",
		"Roboto",
		"Helvetica Neue",
		"Arial",
		"sans-serif",
	],
});

export const metadata: Metadata = {
	title: "Inplain.ai - Privacy Policies Made Simple | AI-Powered Monitoring",
	description:
		"Stop missing critical privacy policy updates. Inplain.ai monitors changes across 500+ companies, translates legal jargon into plain English, and alerts you instantly when your data rights change. Start free trial.",
	keywords: [
		"privacy policy",
		"terms of service",
		"policy tracking",
		"gdpr",
		"data privacy",
		"policy monitoring",
		"AI analysis",
		"privacy alerts",
		"compliance tracking",
		"privacy rights",
	],
	authors: [{ name: "Inplain.ai" }],
	icons: {
		icon: [
			{ url: "/favicon.ico" },
			{ url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
			{ url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
		],
		apple: [
			{
				url: "/apple-touch-icon.png",
				sizes: "180x180",
				type: "image/png",
			},
		],
		other: [
			{ rel: "mask-icon", url: "/favicon.ico", color: "#6366f1" },
			{ rel: "msapplication-config", url: "/browserconfig.xml" },
		],
	},
	manifest: "/manifest.json",
	openGraph: {
		title: "Inplain.ai - Privacy Policies Made Simple | AI-Powered Monitoring",
		description:
			"Stop missing critical privacy policy updates. Monitor 500+ companies with AI-powered analysis and instant alerts.",
		url: "https://inplain.ai",
		siteName: "Inplain.ai",
		type: "website",
		images: [
			{
				url: "/og-image.png",
				width: 1200,
				height: 630,
				alt: "Inplain.ai - Privacy Policy Monitoring Platform",
			},
		],
	},
	twitter: {
		card: "summary_large_image",
		title: "Inplain.ai - Privacy Policies Made Simple",
		description:
			"AI-powered privacy policy monitoring with instant alerts. Track 500+ companies for free.",
		images: ["/og-image.png"],
	},
	robots: {
		index: true,
		follow: true,
	},
};

export const viewport: Viewport = {
	themeColor: "#6366f1",
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ClerkProvider>
			<html lang="en" suppressHydrationWarning className={inter.variable}>
				<body className={`${inter.className} font-sans`}>
					<Providers>
						<PWAProvider>
							<SkipLinks />
							<MobileOptimizations />
							<div className="relative min-h-screen bg-background">
								{/* Desktop Navigation */}
								<div className="hidden md:block">
									<Navigation />
								</div>
								<main
									id="main-content"
									className="flex-1"
									tabIndex={-1}
								>
									{children}
								</main>
								{/* Mobile Navigation */}
								<MobileNavigation />
								{/* Footer is included within individual pages for custom layouts */}
							</div>
							<Toaster />
							<AppStatus />
							<DemoModeBanner />
							<AccessibilityAudit />
							{/* <FeedbackWidget /> */}
							<Analytics />
						</PWAProvider>
					</Providers>
				</body>
			</html>
		</ClerkProvider>
	);
}
