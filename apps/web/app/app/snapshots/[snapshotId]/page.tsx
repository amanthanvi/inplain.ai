import Link from "next/link";

import { inplainFetchJsonSafe } from "../../inplain-api";
import { AppErrorState } from "../../app-error-state";
import { formatDateTime } from "../../format";

type SnapshotOut = {
  id: string;
  documentId: string;
  fetchedAt: string;
  fetchMethod: string;
  httpStatus: number;
  finalUrl: string;
  contentType: string | null;
  language: string | null;
  byteSizeRaw: number | null;
  byteSizeExtracted: number;
  extractVersion: number;
  extractedText: string;
};

export default async function SnapshotPage({
  params,
}: {
  params: Promise<{ snapshotId: string }>;
}) {
  const { snapshotId } = await params;
  const snapshotResult = await inplainFetchJsonSafe<SnapshotOut>(`/v1/snapshots/${snapshotId}`);
  if (!snapshotResult.ok) {
    return (
      <AppErrorState
        title="Snapshot"
        message={snapshotResult.error.message}
        status={snapshotResult.error.status}
        code={snapshotResult.error.code}
        retryHref={`/app/snapshots/${snapshotId}`}
      />
    );
  }

  const snapshot = snapshotResult.data;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <Link href={`/app/documents/${snapshot.documentId}`} style={{ opacity: 0.7 }}>
          ← Document
        </Link>
        <h1 style={{ fontSize: 18, letterSpacing: "-0.02em" }}>Snapshot</h1>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          {formatDateTime(snapshot.fetchedAt)} · {snapshot.fetchMethod} · {snapshot.httpStatus}
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
        <div style={{ fontWeight: 650 }}>Metadata</div>
        <div style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.8 }}>
          <div>Final URL: {snapshot.finalUrl}</div>
          <div>Content-Type: {snapshot.contentType ?? "—"}</div>
          <div>Language: {snapshot.language ?? "—"}</div>
          <div>
            Extracted size: {(snapshot.byteSizeExtracted / 1024).toFixed(1)} KB · extractor v
            {snapshot.extractVersion}
          </div>
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
        <div style={{ fontWeight: 650 }}>Extracted text</div>
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(0,0,0,0.18)",
            overflow: "auto",
            maxHeight: 640,
            fontSize: 12,
            lineHeight: 1.6,
            fontFamily: "var(--sans)",
            whiteSpace: "pre-wrap",
          }}
        >
          {snapshot.extractedText}
        </pre>
      </div>
    </div>
  );
}
