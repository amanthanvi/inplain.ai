import { redirect } from "next/navigation";

import { inplainFetchJson } from "../../../lib/inplain-api";

type MeResponse = {
  id: string;
  email: string;
  plan: "free" | "pro" | "business";
  limits: Record<string, unknown>;
};

async function startCheckout(plan: "pro" | "business") {
  "use server";

  const session = await inplainFetchJson<{ url: string }>("/v1/billing/checkout-session", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
  redirect(session.url);
}

async function openPortal() {
  "use server";

  const session = await inplainFetchJson<{ url: string }>("/v1/billing/portal-session", {
    method: "POST",
  });
  redirect(session.url);
}

export default async function SettingsPage() {
  const me = await inplainFetchJson<MeResponse>("/v1/me");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Settings</h1>

      <div
        style={{
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          display: "grid",
          gap: 8,
        }}
      >
        <div style={{ fontWeight: 650 }}>Plan</div>
        <div style={{ opacity: 0.8 }}>
          {me.email} · <span style={{ opacity: 1 }}>{me.plan}</span>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {me.plan !== "pro" ? (
            <form action={startCheckout.bind(null, "pro")}>
              <button
                type="submit"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "inherit",
                }}
              >
                Upgrade to Pro
              </button>
            </form>
          ) : null}
          {me.plan !== "business" ? (
            <form action={startCheckout.bind(null, "business")}>
              <button
                type="submit"
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "inherit",
                }}
              >
                Upgrade to Business
              </button>
            </form>
          ) : null}
          <form action={openPortal}>
            <button
              type="submit"
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "inherit",
              }}
            >
              Manage billing
            </button>
          </form>
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontWeight: 650 }}>Limits</div>
        <pre
          style={{
            margin: 0,
            padding: 14,
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.03)",
            overflowX: "auto",
            fontSize: 12,
            lineHeight: 1.5,
            fontFamily: "var(--mono)",
          }}
        >
          {JSON.stringify(me.limits, null, 2)}
        </pre>
      </div>
    </div>
  );
}
