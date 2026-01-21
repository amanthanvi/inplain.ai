import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { InplainApiError, inplainFetchJsonOrRedirect } from "../../inplain-api";

type DocumentListItem = {
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

type DocumentListResponse = {
  items: DocumentListItem[];
  nextCursor: string | null;
};

async function createDocument(entityId: string, formData: FormData) {
  "use server";

  const url = String(formData.get("url") || "").trim();
  const docType = String(formData.get("docType") || "privacy");
  const scheduleTier = String(formData.get("scheduleTier") || "daily");
  const fetchMode = String(formData.get("fetchMode") || "auto");

  if (!url) {
    return;
  }

  let doc: { id: string };
  try {
    doc = await inplainFetchJsonOrRedirect<{ id: string }>(`/v1/entities/${entityId}/documents`, {
      method: "POST",
      body: JSON.stringify({ url, docType, scheduleTier, fetchMode }),
    });
  } catch (err) {
    if (err instanceof InplainApiError && err.status === 409) {
      const body = err.body as {
        detail?: { error?: { details?: { documentId?: unknown; entityId?: unknown } } };
      };
      const docId = body?.detail?.error?.details?.documentId;
      const existingEntityId = body?.detail?.error?.details?.entityId;

      if (typeof docId === "string" && docId.length) {
        revalidatePath(`/app/entities/${entityId}`);
        redirect(`/app/documents/${docId}`);
      }

      if (typeof existingEntityId === "string" && existingEntityId.length) {
        revalidatePath(`/app/entities/${entityId}`);
        redirect(`/app/entities/${existingEntityId}`);
      }
    }
    throw err;
  }

  revalidatePath(`/app/entities/${entityId}`);
  redirect(`/app/documents/${doc.id}`);
}

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  const docs = await inplainFetchJsonOrRedirect<DocumentListResponse>(
    `/v1/entities/${entityId}/documents?limit=100`,
  );

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href="/app/entities" style={{ opacity: 0.7 }}>
          ← Back to entities
        </Link>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Documents</h1>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Entity ID: {entityId}</div>
      </div>

      <form
        action={createDocument.bind(null, entityId)}
        style={{
          display: "grid",
          gap: 10,
          padding: 14,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, opacity: 0.75 }} htmlFor="url">
            Document URL
          </label>
          <input
            id="url"
            name="url"
            placeholder="https://acme.com/privacy"
            required
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "inherit",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.75 }}>Type</span>
            <select
              name="docType"
              defaultValue="privacy"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
              }}
            >
              <option value="privacy">Privacy</option>
              <option value="tos">Terms</option>
              <option value="cookie">Cookie</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.75 }}>Schedule</span>
            <select
              name="scheduleTier"
              defaultValue="daily"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
              }}
            >
              <option value="daily">Daily</option>
              <option value="6h">Every 6h</option>
              <option value="1h">Every 1h</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, opacity: 0.75 }}>Fetch mode</span>
            <select
              name="fetchMode"
              defaultValue="auto"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)",
                color: "inherit",
              }}
            >
              <option value="auto">Auto</option>
              <option value="http_only">HTTP only</option>
              <option value="force_render">Force render</option>
            </select>
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
          Add document
        </button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {docs.items.map((d) => (
          <Link
            key={d.id}
            href={`/app/documents/${d.id}`}
            style={{
              display: "grid",
              gap: 6,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>
                {d.url}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{d.status}</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.7 }}>
              <span>{d.docType}</span>
              <span>· robots {d.robotsStatus}</span>
              <span>· next {new Date(d.nextDueAt).toLocaleString()}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
