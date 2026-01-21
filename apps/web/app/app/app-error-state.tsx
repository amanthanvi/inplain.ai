import Link from "next/link";

export function AppErrorState({
  title,
  message,
  status,
  code,
  retryHref,
}: {
  title: string;
  message: string;
  status: number | null;
  code: string | null;
  retryHref: string;
}) {
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em", margin: 0 }}>{title}</h1>
        <div style={{ opacity: 0.8, fontSize: 13 }}>
          Something went wrong while loading this page.
        </div>
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.9 }}>{message}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.75 }}>
          {status ? <span>Status: {status}</span> : null}
          {code ? <span>Code: {code}</span> : null}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href={retryHref}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.08)",
              color: "inherit",
            }}
          >
            Retry →
          </Link>
          <Link href="/companies" style={{ padding: "10px 0", opacity: 0.85 }}>
            Browse companies →
          </Link>
        </div>
      </div>
    </div>
  );
}

