import Link from "next/link";

import { InplainApiError, inplainFetchJson } from "../../../../lib/inplain-api";

type LlmUsageOut = {
  windowDays: number;
  daily: Array<{
    day: string;
    requests: number;
    tokensIn: number;
    tokensOut: number;
    costUsdMicros: number;
  }>;
  topUsers: Array<{
    userId: string;
    email: string;
    requests: number;
    tokensIn: number;
    tokensOut: number;
    costUsdMicros: number;
  }>;
};

function usd(costUsdMicros: number): string {
  return `$${(costUsdMicros / 1_000_000).toFixed(4)}`;
}

export default async function AdminLlmUsagePage() {
  let data: LlmUsageOut;
  try {
    data = await inplainFetchJson<LlmUsageOut>("/v1/admin/llm-usage");
  } catch (err) {
    if (err instanceof InplainApiError && err.status === 403) {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Admin · LLM usage</h1>
          <div style={{ opacity: 0.8, fontSize: 13 }}>You do not have admin access.</div>
        </div>
      );
    }
    throw err;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <Link href="/app/admin" style={{ opacity: 0.7 }}>
          ← Admin
        </Link>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>LLM usage</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Last {data.windowDays}d</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 650 }}>Daily</div>
        {data.daily.length ? (
          data.daily.map((d) => (
            <div
              key={d.day}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ opacity: 0.9 }}>{d.day}</div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>{usd(d.costUsdMicros)}</div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, opacity: 0.75 }}>
                <span>{d.requests} summaries</span>
                <span>· {d.tokensIn} in</span>
                <span>· {d.tokensOut} out</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.75, fontSize: 13 }}>No data.</div>
        )}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 650 }}>Top users</div>
        {data.topUsers.length ? (
          data.topUsers.map((u) => (
            <div
              key={u.userId}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                display: "grid",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ opacity: 0.9 }}>{u.email}</div>
                <div style={{ opacity: 0.85, fontSize: 12 }}>{usd(u.costUsdMicros)}</div>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12, opacity: 0.75 }}>
                <span>{u.requests} summaries</span>
                <span>· {u.tokensIn} in</span>
                <span>· {u.tokensOut} out</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.75, fontSize: 13 }}>No data.</div>
        )}
      </div>
    </div>
  );
}

