import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { InplainApiError, inplainFetchJson } from "../../../../lib/inplain-api";

type UserListItem = {
  id: string;
  clerkUserId: string;
  email: string;
  role: "user" | "admin";
  status: "active" | "banned";
  plan: "free" | "pro" | "business";
  limits: Record<string, unknown>;
  createdAt: string;
};

type UserListOut = {
  items: UserListItem[];
  nextCursor: string | null;
};

async function setBanned(userId: string, banned: boolean) {
  "use server";
  await inplainFetchJson(`/v1/admin/users/${userId}/ban`, {
    method: "POST",
    body: JSON.stringify({ banned }),
  });
  revalidatePath("/app/admin/users");
  redirect("/app/admin/users?saved=1");
}

async function setPlan(userId: string, formData: FormData) {
  "use server";
  const plan = String(formData.get("plan") || "free");
  await inplainFetchJson(`/v1/admin/users/${userId}/plan`, {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
  revalidatePath("/app/admin/users");
  redirect("/app/admin/users?saved=1");
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; cursor?: string; saved?: string }>;
}) {
  const sp = await searchParams;

  const qs = new URLSearchParams();
  qs.set("limit", "50");
  if (sp.query) qs.set("query", sp.query);
  if (sp.cursor) qs.set("cursor", sp.cursor);

  let data: UserListOut;
  try {
    data = await inplainFetchJson<UserListOut>(`/v1/admin/users?${qs.toString()}`);
  } catch (err) {
    if (err instanceof InplainApiError && err.status === 403) {
      return (
        <div style={{ display: "grid", gap: 10 }}>
          <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Admin · Users</h1>
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
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Users</h1>
        {sp.saved === "1" ? <div style={{ fontSize: 12, opacity: 0.75 }}>Saved.</div> : null}
      </div>

      <form method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input
          name="query"
          defaultValue={sp.query || ""}
          placeholder="Search email / clerk id / uuid…"
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.04)",
            color: "inherit",
            outline: "none",
            minWidth: 260,
          }}
        />
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
          Search
        </button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {data.items.map((u) => (
          <div
            key={u.id}
            style={{
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
              display: "grid",
              gap: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div style={{ display: "grid", gap: 2 }}>
                <div style={{ fontWeight: 650 }}>{u.email}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>
                  {u.plan} · {u.status} · {u.role}
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {new Date(u.createdAt).toLocaleDateString()}
              </div>
            </div>

            <div style={{ fontSize: 12, opacity: 0.8, wordBreak: "break-word" }}>
              <div>
                <span style={{ opacity: 0.7 }}>user</span> {u.id}
              </div>
              <div>
                <span style={{ opacity: 0.7 }}>clerk</span> {u.clerkUserId}
              </div>
            </div>

            <details>
              <summary style={{ cursor: "pointer", fontSize: 12, opacity: 0.8 }}>Limits</summary>
              <pre
                style={{
                  margin: "10px 0 0",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.20)",
                  overflowX: "auto",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                {JSON.stringify(u.limits, null, 2)}
              </pre>
            </details>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <form action={setBanned.bind(null, u.id, u.status !== "banned")}>
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
                  {u.status === "banned" ? "Unban" : "Ban"}
                </button>
              </form>

              <form action={setPlan.bind(null, u.id)} style={{ display: "flex", gap: 8 }}>
                <select
                  name="plan"
                  defaultValue={u.plan}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                    fontSize: 12,
                  }}
                >
                  <option value="free">free</option>
                  <option value="pro">pro</option>
                  <option value="business">business</option>
                </select>
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
                  Set plan
                </button>
              </form>
            </div>
          </div>
        ))}

        {data.nextCursor ? (
          <Link
            href={`/app/admin/users?${new URLSearchParams({
              ...(sp.query ? { query: sp.query } : {}),
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

