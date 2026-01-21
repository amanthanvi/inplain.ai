import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { InplainApiError, inplainFetchJsonOrRedirect } from "../../inplain-api";

type JobListItem = {
  id: string;
  userId: string | null;
  documentId: string | null;
  jobType: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  celeryTaskId: string | null;
  error: string | null;
  createdAt: string;
};

type JobListOut = {
  items: JobListItem[];
  nextCursor: string | null;
};

async function retryJob(jobId: string) {
  "use server";
  await inplainFetchJsonOrRedirect(`/v1/admin/jobs/${jobId}/retry`, { method: "POST" });
  revalidatePath("/app/admin/jobs");
  redirect("/app/admin/jobs?retried=1");
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; jobType?: string; cursor?: string; retried?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set("limit", "50");
  if (sp.status) qs.set("status", sp.status);
  if (sp.jobType) qs.set("jobType", sp.jobType);
  if (sp.cursor) qs.set("cursor", sp.cursor);

  let data: JobListOut;
  try {
    data = await inplainFetchJsonOrRedirect<JobListOut>(`/v1/admin/jobs?${qs.toString()}`);
  } catch (err) {
    if (err instanceof InplainApiError && err.status === 403) {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Admin · Jobs</h1>
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
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Jobs</h1>
        {sp.retried === "1" ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>Job re-queued.</div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13, opacity: 0.85 }}>
        <Link href="/app/admin/jobs">All</Link>
        <Link href="/app/admin/jobs?status=failed">Failed</Link>
        <Link href="/app/admin/jobs?status=dead">Dead</Link>
        <Link href="/app/admin/jobs?jobType=fetch">Fetch</Link>
        <Link href="/app/admin/jobs?jobType=summarize">Summarize</Link>
        <Link href="/app/admin/jobs?jobType=render">Render</Link>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {data.items.map((j) => (
          <div
            key={j.id}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              display: "grid",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 650 }}>
                {j.jobType} · {j.status}
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {new Date(j.createdAt).toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              <span style={{ opacity: 0.7 }}>job</span> {j.id}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.8 }}>
              {j.userId ? (
                <span>
                  <span style={{ opacity: 0.7 }}>user</span> {j.userId}
                </span>
              ) : null}
              {j.documentId ? (
                <span>
                  <span style={{ opacity: 0.7 }}>doc</span> {j.documentId}
                </span>
              ) : null}
              <span>
                <span style={{ opacity: 0.7 }}>attempt</span> {j.attempt}/{j.maxAttempts}
              </span>
            </div>
            {j.error ? (
              <pre
                style={{
                  margin: 0,
                  padding: 10,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.20)",
                  overflowX: "auto",
                  fontSize: 12,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {j.error}
              </pre>
            ) : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <form action={retryJob.bind(null, j.id)}>
                <button
                  type="submit"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit",
                    fontSize: 12,
                  }}
                >
                  Retry
                </button>
              </form>
            </div>
          </div>
        ))}

        {data.nextCursor ? (
          <Link
            href={`/app/admin/jobs?${new URLSearchParams({
              ...(sp.status ? { status: sp.status } : {}),
              ...(sp.jobType ? { jobType: sp.jobType } : {}),
              cursor: data.nextCursor,
            }).toString()}`}
            style={{ opacity: 0.85 }}
          >
            Next page →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
