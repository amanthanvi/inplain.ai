import Link from "next/link";

import { InplainApiError, inplainFetchJsonOrRedirect } from "../inplain-api";

export default async function AdminHomePage() {
  try {
    await inplainFetchJsonOrRedirect("/v1/admin/jobs?limit=1");
  } catch (err) {
    if (err instanceof InplainApiError && err.status === 403) {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Admin</h1>
          <div style={{ opacity: 0.8, fontSize: 13 }}>You do not have admin access.</div>
        </div>
      );
    }
    throw err;
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Admin</h1>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Internal tools</div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <Link href="/app/admin/jobs">Jobs →</Link>
        <Link href="/app/admin/users">Users →</Link>
        <Link href="/app/admin/abuse">Abuse →</Link>
        <Link href="/app/admin/llm-usage">LLM usage →</Link>
      </div>
    </div>
  );
}
