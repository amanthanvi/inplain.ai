"use client";

import Link from "next/link";
import { useEffect } from "react";

type MaybeError = {
  digest?: string;
  status?: number;
  body?: unknown;
  message?: string;
};

export default function AppError({
  error,
  reset,
}: {
  error: Error & MaybeError;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  const status = typeof error.status === "number" ? error.status : null;
  const digest = typeof error.digest === "string" ? error.digest : null;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Something went wrong</h1>
        <div style={{ opacity: 0.8, fontSize: 13 }}>
          The app hit an error while loading this page.
        </div>
      </div>

      {status === 401 ? (
        <div style={{ opacity: 0.85, fontSize: 13 }}>
          Your session may have expired. Try signing in again.
        </div>
      ) : null}

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
          }}
        >
          Try again
        </button>
        <Link href="/app" style={{ padding: "10px 0", opacity: 0.85 }}>
          Go to dashboard →
        </Link>
        <Link href="/sign-in" style={{ padding: "10px 0", opacity: 0.85 }}>
          Sign in →
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
              status: status ?? undefined,
              digest: digest ?? undefined,
            },
            null,
            2,
          )}
        </pre>
      </details>
    </div>
  );
}
