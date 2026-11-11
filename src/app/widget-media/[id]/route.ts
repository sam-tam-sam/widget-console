import { readWidgetImage } from "@/lib/widgets";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = readWidgetImage(id);
  const headers = new Headers({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
  if (!image) return new Response(null, { status: 404, headers });

  headers.set("Content-Type", image.content_type);
  return new Response(new Uint8Array(image.bytes), { headers });
}
