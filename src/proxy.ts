import { type NextRequest, NextResponse } from "next/server";
import { configuredOrigin } from "@/lib/embeds";

const loopback = /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i;
const embedPath = /^\/embed\/[a-z0-9-]+$/i;

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export function proxy(request: NextRequest) {
  const host = request.headers.get("host")?.toLowerCase() ?? "";
  const path = request.nextUrl.pathname;
  const isEmbed = embedPath.test(path);
  const adminOrigin = configuredOrigin(process.env.WIDGET_ADMIN_ORIGIN);
  const widgetOrigin = configuredOrigin(process.env.WIDGET_EMBED_ORIGIN);

  if (path === "/api/health") return loopback.test(host) ? NextResponse.next() : notFound();
  if (!adminOrigin || !widgetOrigin || adminOrigin.hostname === widgetOrigin.hostname) return notFound();
  if (host === widgetOrigin.host) return isEmbed ? NextResponse.next() : notFound();
  if (host !== adminOrigin.host || isEmbed) return notFound();

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (!path.startsWith("/_next/")) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/:path*"] };
