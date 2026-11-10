import { embedSecurityHeaders } from "@/lib/embeds";
import { resolveEmbed } from "@/lib/widgets";

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
  const embed = resolveEmbed(id);
  if (!embed) return unavailable("This widget is unavailable.", 404);

  const headers = embedSecurityHeaders(embed.origins, embed.scriptHashes);
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(embed.html, { headers });
}
