import { type NextRequest, NextResponse } from "next/server";
import { applicationOrigin } from "@/lib/embeds";
import { pwaIcons } from "@/lib/pwa-icons";

const loopback = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i;
const embedPath = /^\/embed\/[a-z0-9-]+$/i;
const versionedIcons = new Set(Object.values(pwaIcons));

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const path = request.nextUrl.pathname;
  if (path === "/api/health") return loopback.test(host) ? NextResponse.next() : notFound();
  if (host !== applicationOrigin()?.host) return notFound();
  if (embedPath.test(path)) return NextResponse.next();

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (versionedIcons.has(path)) {
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (!path.startsWith("/_next/") && path !== "/api/admin/live") {
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}

export const config = { matcher: ["/:path*"] };
