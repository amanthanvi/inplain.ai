import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Inplain.ai",
  description: "Track, diff, and understand privacy policy changes with citation-backed summaries.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

