import { InplainApiError, inplainFetchJson } from "../../../../../lib/inplain-api";

export async function GET(_request: Request, context: { params: { documentId: string } }) {
  const documentId = context.params.documentId;

  try {
    const data = await inplainFetchJson<unknown>(`/v1/documents/${documentId}/export`);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"document-${documentId}-history.json\"`,
      },
    });
  } catch (err) {
    if (err instanceof InplainApiError) {
      const body =
        typeof err.body === "string" ? err.body : JSON.stringify(err.body ?? null, null, 2);
      return new Response(body, {
        status: err.status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return new Response("Internal Server Error", { status: 500 });
  }
}
