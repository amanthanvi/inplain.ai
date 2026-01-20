import { InplainApiError, inplainFetchJson } from "../../../../../lib/inplain-api";
import type { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ changeEventId: string }> },
) {
  const { changeEventId } = await context.params;

  try {
    const data = await inplainFetchJson<unknown>(`/v1/change-events/${changeEventId}/export`);
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename=\"change-event-${changeEventId}.json\"`,
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
