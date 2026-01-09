import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { inplainFetchJson } from "../../../lib/inplain-api";

type Entity = {
  id: string;
  name: string;
  websiteUrl: string | null;
  createdAt: string;
};

type EntityListResponse = {
  items: Entity[];
  nextCursor: string | null;
};

async function createEntity(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const websiteUrlRaw = String(formData.get("websiteUrl") || "").trim();
  const websiteUrl = websiteUrlRaw.length ? websiteUrlRaw : null;

  if (!name) {
    return;
  }

  const entity = await inplainFetchJson<Entity>("/v1/entities", {
    method: "POST",
    body: JSON.stringify({ name, websiteUrl }),
  });

  revalidatePath("/app/entities");
  redirect(`/app/entities/${entity.id}`);
}

export default async function EntitiesPage() {
  const entities = await inplainFetchJson<EntityListResponse>("/v1/entities?limit=100");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ fontSize: 22, letterSpacing: "-0.02em" }}>Entities</h1>
        <div style={{ opacity: 0.7 }}>{entities.items.length} total</div>
      </div>

      <form action={createEntity} style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, opacity: 0.75 }} htmlFor="name">
            Name
          </label>
          <input
            id="name"
            name="name"
            placeholder="Acme Corp"
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
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, opacity: 0.75 }} htmlFor="websiteUrl">
            Website (optional)
          </label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            placeholder="https://acme.com"
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
          Create entity
        </button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {entities.items.map((e) => (
          <Link
            key={e.id}
            href={`/app/entities/${e.id}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            <div style={{ display: "grid", gap: 2 }}>
              <div style={{ fontWeight: 650 }}>{e.name}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                {e.websiteUrl ? e.websiteUrl : "—"}
              </div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Open →</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

