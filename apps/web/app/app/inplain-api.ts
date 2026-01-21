import { redirect } from "next/navigation";

import { InplainApiError, inplainFetchJson } from "../../lib/inplain-api";

export { InplainApiError };

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

