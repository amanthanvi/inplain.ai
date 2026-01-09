import { auth } from "@clerk/nextjs/server";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export class InplainApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "InplainApiError";
    this.status = status;
    this.body = body;
  }
}

function apiBaseUrl(): string {
  const baseUrl = process.env.INPLAIN_API_BASE_URL?.trim();
  return baseUrl ? baseUrl.replace(/\/+$/, "") : DEFAULT_API_BASE_URL;
}

export async function inplainFetchJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { userId, getToken } = await auth();
  if (!userId) {
    throw new InplainApiError("Not signed in.", 401, null);
  }

  const token = await getToken();
  const devEmail = process.env.INPLAIN_DEV_EMAIL?.trim();

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (devEmail) {
    headers.set("X-Dev-Email", devEmail);
    headers.set("X-Dev-Clerk-User-Id", devEmail);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = res.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

  if (!res.ok) {
    const message =
      typeof body === "object" && body && "error" in body
        ? "API request failed."
        : `API request failed with status ${res.status}.`;
    throw new InplainApiError(message, res.status, body);
  }

  return body as T;
}

