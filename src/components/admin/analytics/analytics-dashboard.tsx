"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalyticsReport } from "@/lib/analytics-report";
import { AnalyticsSites, AnalyticsWidgets } from "./analytics-breakdowns";
import { AnalyticsMetrics } from "./analytics-metrics";
import { AnalyticsTrend } from "./analytics-trend";
import { analyticsRefreshSeconds, useAnalytics } from "./use-analytics";
import "./analytics.css";

const ranges = [7, 30, 90] as const;
const updateFormat = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const reportDates = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export function AnalyticsDashboard({ initial, widgetId }: { initial: AnalyticsReport; widgetId?: string }) {
  const { report, range, status, selectRange, refresh } = useAnalytics(initial, widgetId);
  const restricted = status === "unauthorized" || status === "unavailable";
  const heading = widgetId ? report.widgetNames[widgetId] : "Analytics";
  const firstDay = report.daily.at(0)?.date;
  const lastDay = report.daily.at(-1)?.date;

  return (
    <div className="analytics-dashboard">
      {widgetId && (
        <Link href={`/admin/analytics?range=${range}`} className="console-back">
          <ArrowLeft size={16} aria-hidden="true" /> All analytics
        </Link>
      )}
      <header className="console-page-header analytics-header">
        <div>
          <h1>{heading}</h1>
          <p>{widgetId ? "Embed activity for this widget." : "Embed activity across all widgets."}</p>
        </div>
        {widgetId && <Button asChild variant="outline"><Link href={`/admin/widgets/${widgetId}`}>Widget settings</Link></Button>}
      </header>

      <section className="analytics-toolbar" aria-label="Report controls">
        <div className="analytics-period">
          <span>Reporting period</span>
          <strong>{firstDay && lastDay ? reportDates.formatRange(new Date(firstDay), new Date(lastDay)) : `Last ${report.range} days`}</strong>
        </div>
        <div className="analytics-ranges" role="group" aria-label="Date range">
          {ranges.map((days) => (
            <Button
              key={days}
              type="button"
              variant={range === days ? "default" : "ghost"}
              aria-pressed={range === days}
              disabled={restricted}
              onClick={() => selectRange(days)}
            >
              {days} days
            </Button>
          ))}
        </div>
        <div className="analytics-update">
          <span>Last updated <time dateTime={report.generatedAt}>{updateFormat.format(new Date(report.generatedAt))} UTC</time></span>
          <Button type="button" variant="outline" size="icon" aria-label="Refresh analytics" title="Refresh analytics" disabled={restricted || status === "loading"} onClick={refresh}>
            <RefreshCw aria-hidden="true" />
          </Button>
        </div>
      </section>

      {status === "unauthorized" && <p className="analytics-alert" role="alert">Your session ended. <Link href="/sign-in">Sign in again</Link> to view analytics.</p>}
      {status === "unavailable" && <p className="analytics-alert" role="alert">This widget is unavailable. <Link href="/admin/analytics">View all analytics</Link>.</p>}
      {status === "error" && <p className="analytics-alert" role="alert">Could not refresh analytics. Showing the last available {report.range}-day report.</p>}
      {status === "loading" && <p className="analytics-loading" role="status">Updating analytics…</p>}

      {!restricted && (
        <div className="analytics-content" aria-busy={status === "loading"}>
          <AnalyticsMetrics report={report} />
          <div className="analytics-columns">
            <AnalyticsTrend daily={report.daily} />
            <AnalyticsSites origins={report.origins} />
          </div>
          {!widgetId && <AnalyticsWidgets report={report} />}
          <details className="console-disclosure analytics-method">
            <summary>How analytics are counted</summary>
            <p>Embed loads count requests with an approved site as the referrer. Dashboard previews, loads without a referrer, and excess loads during bursts are excluded.</p>
            <p>Estimated visitor-days count distinct visitor signals per UTC day, then add those daily totals. The same visitor can count on different days.</p>
            {!report.visitorTrackingEnabled && <p>Visitor estimates require a trusted Cloudflare connection and WIDGET_TRUST_CLOUDFLARE set to 1.</p>}
            <p>Reports refresh every {analyticsRefreshSeconds} seconds while this page is visible.</p>
          </details>
        </div>
      )}
    </div>
  );
}
