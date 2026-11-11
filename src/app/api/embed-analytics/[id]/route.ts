import { acceptPublisherReport } from "@/lib/publisher-analytics";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const status = acceptPublisherReport(request.headers, id);
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (status === 401) headers.set("WWW-Authenticate", "Bearer");
  if (status === 429) headers.set("Retry-After", "60");
  return new Response(null, { status, headers });
}
