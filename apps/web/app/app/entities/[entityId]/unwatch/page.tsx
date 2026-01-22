import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { inplainFetchJsonOrRedirect, inplainFetchJsonSafe } from "../../../inplain-api";
import { AppErrorState } from "../../../app-error-state";

type EntityOut = {
  id: string;
  name: string;
  websiteUrl: string | null;
  createdAt: string;
};

type DocumentListItem = {
  id: string;
};

type DocumentListResponse = {
  items: DocumentListItem[];
  nextCursor: string | null;
};

async function stopTracking(entityId: string) {
  "use server";

  await inplainFetchJsonOrRedirect(`/v1/entities/${entityId}`, { method: "DELETE" });
  revalidatePath("/app/entities");
  redirect("/app/entities?unwatched=1");
}

export default async function UnwatchEntityPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;

  const [entityResult, docsResult] = await Promise.all([
    inplainFetchJsonSafe<EntityOut>(`/v1/entities/${entityId}`),
    inplainFetchJsonSafe<DocumentListResponse>(`/v1/entities/${entityId}/documents?limit=100`),
  ]);

  if (!entityResult.ok) {
    return (
      <AppErrorState
        title="Stop tracking"
        message={entityResult.error.message}
        status={entityResult.error.status}
        code={entityResult.error.code}
        retryHref={`/app/entities/${entityId}/unwatch`}
      />
    );
  }

  if (!docsResult.ok) {
    return (
      <AppErrorState
        title="Stop tracking"
        message={docsResult.error.message}
        status={docsResult.error.status}
        code={docsResult.error.code}
        retryHref={`/app/entities/${entityId}/unwatch`}
      />
    );
  }

  const entity = entityResult.data;
  const docs = docsResult.data;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href={`/app/entities/${entityId}`} style={{ opacity: 0.7 }}>
          ← Back
        </Link>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Stop tracking {entity.name}?</h1>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          This will remove <strong>{docs.items.length}</strong> policies from your dashboard. Data
          deletion may take a little time to complete.
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
        <form action={stopTracking.bind(null, entityId)}>
          <button
            type="submit"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,96,96,0.18)",
              color: "inherit",
            }}
          >
            Stop tracking
          </button>
        </form>

        <Link href={`/app/entities/${entityId}`} style={{ opacity: 0.85 }}>
          Cancel →
        </Link>
      </div>
    </div>
  );
}

