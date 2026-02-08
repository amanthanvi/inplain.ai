import { CompaniesDirectory } from "@/app/companies/CompaniesDirectory";
import { internalFetch, type EntityOut } from "@/lib/internal-api";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  let entities: EntityOut[] = [];
  let error: string | null = null;

  try {
    entities = await internalFetch<EntityOut[]>("/internal/entities", { cache: "no-store" });
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load companies";
  }

  if (error) {
    return (
      <main>
        <h1>Companies</h1>
        <p className="muted">Unable to load the directory yet: {error}</p>
      </main>
    );
  }

  return <CompaniesDirectory entities={entities} />;
}

