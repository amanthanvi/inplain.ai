import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { inplainFetchJson } from "../../../../lib/inplain-api";

type DocumentDetail = {
  id: string;
  url: string;
  docType: "privacy" | "tos" | "cookie" | "other";
  status: "active" | "paused" | "blocked_robots" | "error";
  robotsStatus: "unknown" | "allowed" | "disallowed";
  nextDueAt: string;
  lastCheckedAt: string | null;
  lastChangeEventId: string | null;
  createdAt: string;
};

type ChangeEventListItem = {
  id: string;
  createdAt: string;
  title: string;
  summaryStatus: "pending" | "completed" | "failed" | "skipped_quota";
};

type ChangeEventListResponse = {
  items: ChangeEventListItem[];
  nextCursor: string | null;
};

type EmailMode = "immediate" | "daily_digest";

type DocumentNotificationPreferenceResponse = {
  effective: { emailEnabled: boolean; emailMode: EmailMode };
  override: { emailEnabled: boolean; emailMode: EmailMode } | null;
};

type MeResponse = {
  id: string;
  email: string;
  plan: "free" | "pro" | "business";
  limits: Record<string, unknown>;
};

async function checkNow(documentId: string) {
  "use server";

  await inplainFetchJson(`/v1/documents/${documentId}/check-now`, { method: "POST" });
  revalidatePath(`/app/documents/${documentId}`);
  redirect(`/app/documents/${documentId}?queued=1`);
}

async function saveNotificationPreference(documentId: string, formData: FormData) {
  "use server";

  const emailEnabled = String(formData.get("emailEnabled") || "") === "on";
  const emailMode = String(formData.get("emailMode") || "immediate") as EmailMode;

  await inplainFetchJson(`/v1/documents/${documentId}/notification-preference`, {
    method: "PUT",
    body: JSON.stringify({ emailEnabled, emailMode }),
  });

  revalidatePath(`/app/documents/${documentId}`);
  redirect(`/app/documents/${documentId}?prefs=1`);
}

async function clearNotificationPreference(documentId: string) {
  "use server";

  await inplainFetchJson(`/v1/documents/${documentId}/notification-preference`, {
    method: "DELETE",
  });

  revalidatePath(`/app/documents/${documentId}`);
  redirect(`/app/documents/${documentId}?prefs=1`);
}

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ queued?: string; prefs?: string }>;
}) {
  const { documentId } = await params;
  const sp = await searchParams;

  const [doc, events, prefs, me] = await Promise.all([
    inplainFetchJson<DocumentDetail>(`/v1/documents/${documentId}`),
    inplainFetchJson<ChangeEventListResponse>(`/v1/documents/${documentId}/change-events?limit=10`),
    inplainFetchJson<DocumentNotificationPreferenceResponse>(
      `/v1/documents/${documentId}/notification-preference`,
    ),
    inplainFetchJson<MeResponse>("/v1/me"),
  ]);

  const digestAllowed = me.plan !== "free";
  const prefValue = prefs.override ?? prefs.effective;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href="/app/entities" style={{ opacity: 0.7 }}>
          ← Entities
        </Link>
        <h1 style={{ fontSize: 18, letterSpacing: "-0.02em", wordBreak: "break-word" }}>
          {doc.url}
        </h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.75 }}>
          <span>{doc.docType}</span>
          <span>· {doc.status}</span>
          <span>· robots {doc.robotsStatus}</span>
          <span>· next {new Date(doc.nextDueAt).toLocaleString()}</span>
        </div>

        {sp.queued === "1" ? (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              fontSize: 13,
              opacity: 0.9,
            }}
          >
            Check queued. Refresh in a moment.
          </div>
        ) : null}
      </div>

      {sp.prefs === "1" ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            fontSize: 13,
            opacity: 0.9,
          }}
        >
          Notification preferences saved.
        </div>
      ) : null}

      <form action={checkNow.bind(null, documentId)}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
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
            Check now
          </button>
          <a href={`/api/export/documents/${documentId}`} style={{ fontSize: 12, opacity: 0.8 }}>
            Export history JSON →
          </a>
        </div>
      </form>

      <form
        action={saveNotificationPreference.bind(null, documentId)}
        style={{
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontWeight: 650 }}>Email notifications</div>
          {prefs.override ? (
            <button
              type="submit"
              formAction={clearNotificationPreference.bind(null, documentId)}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(255,255,255,0.06)",
                color: "inherit",
              }}
            >
              Use default
            </button>
          ) : (
            <div style={{ fontSize: 12, opacity: 0.7 }}>Using default</div>
          )}
        </div>

        <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
          <input type="checkbox" name="emailEnabled" defaultChecked={prefValue.emailEnabled} />
          <span>Email updates for this document</span>
        </label>

        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Mode</div>
          <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
            <input
              type="radio"
              name="emailMode"
              value="immediate"
              defaultChecked={prefValue.emailMode === "immediate"}
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
              defaultChecked={prefValue.emailMode === "daily_digest"}
              disabled={!digestAllowed}
            />
            <span>Daily digest</span>
          </label>
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
          Save
        </button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 15, opacity: 0.85 }}>Change history</h2>
        {events.items.length ? (
          events.items.map((e) => (
            <Link
              key={e.id}
              href={`/app/change-events/${e.id}`}
              style={{
                display: "grid",
                gap: 4,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ fontWeight: 650 }}>{e.title}</div>
              <div style={{ display: "flex", gap: 10, fontSize: 12, opacity: 0.7 }}>
                <span>{new Date(e.createdAt).toLocaleString()}</span>
                <span>· summary {e.summaryStatus}</span>
              </div>
            </Link>
          ))
        ) : (
          <div style={{ opacity: 0.7, fontSize: 13 }}>No change events yet.</div>
        )}
      </div>
    </div>
  );
}
