import { embedSecurityHeaders } from "@/lib/embeds";
import { resolveEmbed } from "@/lib/widgets";
import { acceptBrowserReceipt, browserAnalyticsDocument } from "@/lib/browser-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable(message: string, status: number): Response {
  return new Response(message, { status, headers: embedSecurityHeaders([]) });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (
    request.headers.get("sec-fetch-dest") !== "iframe" ||
    request.headers.get("sec-fetch-mode") !== "navigate"
  ) {
    return unavailable("Open this widget on the site where it was embedded.", 403);
  }

  const { id } = await params;
  const receipt = new URL(request.url).searchParams.get("view");
  if (receipt !== null) {
    const status = acceptBrowserReceipt(request.headers, id, receipt);
    const headers = embedSecurityHeaders([]);
    if (status === 429) headers.set("Retry-After", "60");
    return new Response(null, { status, headers });
  }
  const embed = resolveEmbed(id);
  if (!embed) return unavailable("This widget is unavailable.", 404);

  let analytics: ReturnType<typeof browserAnalyticsDocument> = null;
  try {
    analytics = browserAnalyticsDocument(embed.html, id, embed.origins, request.headers);
  } catch {
    // Analytics must never interrupt delivery of a working widget.
    console.warn("Widget analytics receipt unavailable.");
  }
  const hashes = analytics ? [...embed.scriptHashes, analytics.hash] : embed.scriptHashes;
  const headers = embedSecurityHeaders(embed.origins, hashes, analytics?.frameSource);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(analytics?.html ?? embed.html, { headers });
}
