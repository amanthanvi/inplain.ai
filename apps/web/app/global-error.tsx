"use client";

import Link from "next/link";
import { useEffect } from "react";

type MaybeError = {
  digest?: string;
  status?: number;
  message?: string;
};

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & MaybeError;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  const digest = typeof error.digest === "string" ? error.digest : null;

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, -apple-system" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
            background: "#0b0c10",
            color: "#ececf1",
          }}
        >
          <div style={{ maxWidth: 560, display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-0.02em" }}>
                Something went wrong
              </h1>
              <div style={{ opacity: 0.75, fontSize: 13 }}>
                The site hit an unexpected error while loading this page.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => reset()}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <Link href="/" style={{ padding: "10px 0", opacity: 0.85 }}>
                Go home →
              </Link>
            </div>

            <details style={{ opacity: 0.85 }}>
              <summary style={{ cursor: "pointer" }}>Details</summary>
              <pre
                style={{
                  margin: "10px 0 0",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.20)",
                  overflowX: "auto",
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {JSON.stringify(
                  {
                    message: error.message,
                    digest: digest ?? undefined,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </div>
        </div>
      </body>
    </html>
  );
}
