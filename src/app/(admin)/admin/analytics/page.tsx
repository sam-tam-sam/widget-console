import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/admin/analytics/analytics-dashboard";
import { AdminShell } from "@/components/admin/shell";
import { getAnalyticsReport } from "@/lib/analytics-report";
import { requireAdmin } from "@/lib/auth";
import { parseAnalyticsRange } from "@/lib/widget-analytics";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const [{ username }, { range }] = await Promise.all([requireAdmin(), searchParams]);
  const report = getAnalyticsReport(parseAnalyticsRange(typeof range === "string" ? range : undefined));

  return (
    <AdminShell username={username} activeSection="analytics">
      <AnalyticsDashboard initial={report} />
    </AdminShell>
  );
}
