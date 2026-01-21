import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { PricingTable } from "@clerk/nextjs";

import { inplainFetchJsonOrRedirect } from "../inplain-api";

type MeResponse = {
  id: string;
  email: string;
  plan: "free" | "pro" | "business";
  limits: Record<string, unknown>;
};

type EmailMode = "immediate" | "daily_digest";

type GlobalNotificationPreferencesResponse = {
  effective: { emailEnabled: boolean; emailMode: EmailMode };
  saved: { emailEnabled: boolean; emailMode: EmailMode } | null;
};

async function saveNotificationPreferences(formData: FormData) {
  "use server";

  const emailEnabled = String(formData.get("emailEnabled") || "") === "on";
  const emailMode = String(formData.get("emailMode") || "immediate") as EmailMode;

  await inplainFetchJsonOrRedirect("/v1/notification-preferences", {
    method: "PUT",
    body: JSON.stringify({ emailEnabled, emailMode }),
  });

  revalidatePath("/app/settings");
  redirect("/app/settings?saved=1");
}

export default async function SettingsPage() {
  const [me, notificationPrefs] = await Promise.all([
    inplainFetchJsonOrRedirect<MeResponse>("/v1/me"),
    inplainFetchJsonOrRedirect<GlobalNotificationPreferencesResponse>("/v1/notification-preferences"),
  ]);

  const digestAllowed = me.plan !== "free";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Settings</h1>

      <form
        action={saveNotificationPreferences}
        style={{
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontWeight: 650 }}>Notifications</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Email delivery is currently disabled while we keep costs low.
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
          <input
            type="checkbox"
            name="emailEnabled"
            defaultChecked={notificationPrefs.effective.emailEnabled}
          />
          <span>Email updates</span>
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Email mode</div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
            <input
              type="radio"
              name="emailMode"
              value="immediate"
              defaultChecked={notificationPrefs.effective.emailMode === "immediate"}
            />
            <span>Immediate</span>
          </label>
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              fontSize: 14,
              opacity: digestAllowed ? 1 : 0.5,
            }}
          >
            <input
              type="radio"
              name="emailMode"
              value="daily_digest"
              defaultChecked={notificationPrefs.effective.emailMode === "daily_digest"}
              disabled={!digestAllowed}
            />
            <span>Daily digest (9:00 UTC)</span>
          </label>
          {!digestAllowed ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Daily digest is available on Pro and Business.
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          style={{
            justifySelf: "start",
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(255,255,255,0.08)",
            color: "inherit",
          }}
        >
          Save notifications
        </button>
      </form>

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
        <div style={{ fontWeight: 650 }}>Billing</div>
        <div style={{ opacity: 0.8 }}>
          {me.email} · <span style={{ opacity: 1 }}>{me.plan}</span>
        </div>
        <PricingTable />
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
