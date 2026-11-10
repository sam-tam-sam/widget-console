import { isAdminReady } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (await isAdminReady()) return Response.json({ status: "ok" }, { headers });
  } catch {
    // The loopback health probe reports a status without credential or database details.
  }
  return Response.json({ status: "unavailable" }, { status: 503, headers });
}
