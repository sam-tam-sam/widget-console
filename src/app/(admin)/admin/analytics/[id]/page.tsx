import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AnalyticsDashboard } from "@/components/admin/analytics/analytics-dashboard";
import { AdminShell } from "@/components/admin/shell";
import { getAnalyticsReport } from "@/lib/analytics-report";
import { requireAdmin } from "@/lib/auth";
import { parseAnalyticsRange } from "@/lib/widget-analytics";
import { getInstance } from "@/lib/widgets";

export const metadata: Metadata = { title: "Widget analytics" };

export default async function WidgetAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const [{ username }, { id }, { range }] = await Promise.all([requireAdmin(), params, searchParams]);
  const widget = getInstance(id);
  if (!widget) notFound();

  const report = getAnalyticsReport(parseAnalyticsRange(typeof range === "string" ? range : undefined), widget);
  return (
    <AdminShell username={username} activeSection="analytics">
      <AnalyticsDashboard key={id} initial={report} widgetId={id} />
    </AdminShell>
  );
}
