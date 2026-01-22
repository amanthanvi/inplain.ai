import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

function shouldRedirectToCanonicalHost(host: string | null): boolean {
  if (!host) return false;
  if (host === "inplain.ai" || host === "www.inplain.ai") return false;
  return host.endsWith(".up.railway.app");
}

export default clerkMiddleware((_auth, request) => {
  const host = request.headers.get("host");
  if (process.env.NODE_ENV === "production" && shouldRedirectToCanonicalHost(host)) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.hostname = "inplain.ai";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
