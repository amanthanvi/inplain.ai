export const runtime = "edge";

const SW_SCRIPT = `// inplain.ai service worker
// Spec: no PWA behavior in v0.2.0. This SW exists only to safely replace any previously
// registered SW and remove stale caches that can break Next.js chunk loading.

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {}

      try {
        await self.registration.unregister();
      } catch {}

      try {
        await self.clients.claim();
      } catch {}
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Do not intercept non-http(s) requests (e.g. chrome-extension:// injected assets).
  try {
    const url = new URL(event.request.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return;
    }
  } catch {
    return;
  }
});
`;

export function GET(): Response {
  return new Response(SW_SCRIPT, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      // Ensure browsers always revalidate for updates.
      "cache-control": "no-cache, no-store, max-age=0, must-revalidate",
    },
  });
}

