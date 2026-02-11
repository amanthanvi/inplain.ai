export const runtime = "edge";

export function GET(): Response {
  // Avoid SSR/layout rendering for /favicon.ico so Clerk auth() is never invoked on this route.
  // Returning 204 keeps browsers from retrying aggressively while we avoid committing a binary
  // .ico asset to the repo.
  return new Response(null, {
    status: 204,
    headers: {
      "cache-control": "public, max-age=86400",
    },
  });
}

