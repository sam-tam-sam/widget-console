import { getAdminSession } from "@/lib/auth";
import { getAnalyticsReport } from "@/lib/analytics-report";
import { parseAnalyticsRange } from "@/lib/widget-analytics";
import { getInstance } from "@/lib/widgets";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  if (!await getAdminSession()) {
    return Response.json({ error: "Sign in to view analytics." }, { status: 401, headers });
  }

  const params = new URL(request.url).searchParams;
  const widgetId = params.get("widgetId");
  const widget = widgetId === null ? undefined : getInstance(widgetId);
  if (widget === null) return Response.json({ error: "This widget is unavailable." }, { status: 404, headers });

  return Response.json(getAnalyticsReport(parseAnalyticsRange(params.get("range")), widget), { headers });
}
