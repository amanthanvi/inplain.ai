import { redirect } from "next/navigation";

import { InplainApiError, inplainFetchJson } from "../../lib/inplain-api";

export { InplainApiError };

type SafeError = {
  status: number | null;
  code: string | null;
  message: string;
};

type SafeResult<T> = { ok: true; data: T } | { ok: false; error: SafeError };

function extractErrorCode(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;

  const direct = record.error;
  if (direct && typeof direct === "object") {
    const code = (direct as Record<string, unknown>).code;
    if (typeof code === "string") return code;
  }

  const detail = record.detail;
  if (detail && typeof detail === "object") {
    const error = (detail as Record<string, unknown>).error;
    if (error && typeof error === "object") {
      const code = (error as Record<string, unknown>).code;
      if (typeof code === "string") return code;
    }
  }

  return null;
}

export async function inplainFetchJsonSafe<T>(
  path: string,
  init: RequestInit = {},
): Promise<SafeResult<T>> {
  try {
    const data = await inplainFetchJson<T>(path, init);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof InplainApiError && err.status === 401) {
      redirect("/sign-in");
    }

    const status = err instanceof InplainApiError ? err.status : null;
    const code = err instanceof InplainApiError ? extractErrorCode(err.body) : null;
    const message = err instanceof Error ? err.message : "Unknown error.";

    console.error("Inplain API request failed.", {
      path,
      status,
      code: code ?? undefined,
      message,
    });

    return { ok: false, error: { status, code, message } };
  }
}

export async function inplainFetchJsonOrRedirect<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  try {
    return await inplainFetchJson<T>(path, init);
  } catch (err) {
    if (err instanceof InplainApiError && err.status === 401) {
      redirect("/sign-in");
    }
    throw err;
  }
}
