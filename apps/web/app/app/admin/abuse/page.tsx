import Link from "next/link";

import { InplainApiError, inplainFetchJsonOrRedirect } from "../../inplain-api";

type AbuseOut = {
  windowHours: number;
  topUsers: Array<{ userId: string; email: string; checks: number }>;
  topFailingHosts: Array<{ host: string; failures: number }>;
};

export default async function AdminAbusePage() {
  let data: AbuseOut;
  try {
    data = await inplainFetchJsonOrRedirect<AbuseOut>("/v1/admin/abuse");
  } catch (err) {
    if (err instanceof InplainApiError && err.status === 403) {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Admin · Abuse</h1>
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
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Abuse</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>Last {data.windowHours}h</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 650 }}>Top users by checks</div>
        {data.topUsers.length ? (
          data.topUsers.map((u) => (
            <div
              key={u.userId}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ opacity: 0.9 }}>{u.email}</div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>{u.checks} fetch jobs</div>
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.75, fontSize: 13 }}>No data.</div>
        )}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 650 }}>Top failing hosts</div>
        {data.topFailingHosts.length ? (
          data.topFailingHosts.map((h) => (
            <div
              key={h.host}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ opacity: 0.9 }}>{h.host}</div>
              <div style={{ opacity: 0.75, fontSize: 12 }}>{h.failures} failures</div>
            </div>
          ))
        ) : (
          <div style={{ opacity: 0.75, fontSize: 13 }}>No data.</div>
        )}
      </div>
    </div>
  );
}
