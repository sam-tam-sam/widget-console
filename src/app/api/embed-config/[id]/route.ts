import { applicationOrigin } from "@/lib/embeds";
import { resolveHostEmbed } from "@/lib/widgets";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = new Headers({ "Cache-Control": "no-store", Vary: "Origin, Sec-Fetch-Site" });
  const origin = request.headers.get("origin") ??
    (request.headers.get("sec-fetch-site") === "same-origin" ? applicationOrigin()?.origin : undefined);
  const { id } = await params;
  const config = origin && resolveHostEmbed(id, origin);
  if (!config || !origin) return new Response(null, { status: 404, headers });

  headers.set("Access-Control-Allow-Origin", origin);
  return Response.json(config, { headers });
}
