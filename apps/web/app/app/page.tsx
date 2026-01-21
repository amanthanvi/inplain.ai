import Link from "next/link";

import { inplainFetchJsonOrRedirect } from "./inplain-api";

type MeResponse = {
  id: string;
  email: string;
  plan: "free" | "pro" | "business";
  limits: Record<string, unknown>;
};

export default async function DashboardPage() {
  const me = await inplainFetchJsonOrRedirect<MeResponse>("/v1/me");

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Dashboard</h1>
      <div style={{ opacity: 0.8 }}>
        Signed in as <span style={{ opacity: 1 }}>{me.email}</span> · Plan{" "}
        <span style={{ opacity: 1 }}>{me.plan}</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link href="/app/entities">Manage entities →</Link>
      </div>
    </div>
  );
}
