import { Activity, Globe2, Users } from "lucide-react";
import type { AnalyticsReport } from "@/lib/analytics-report";

export const countFormat = new Intl.NumberFormat("en-US");

export function AnalyticsMetrics({ report }: { report: AnalyticsReport }) {
  const estimatedViews = report.views - report.publisherViews;
  const historicalViews = estimatedViews - report.browserViews;
  const coverage = estimatedViews > 0 ? report.measuredViews / estimatedViews : 0;
  const coverageLabel = new Intl.NumberFormat("en-US", { style: "percent" }).format(coverage);

  return (
    <dl className="analytics-metrics">
      <div className="analytics-metric analytics-metric-primary">
        <dt><Activity size={17} aria-hidden="true" />Recorded embed loads</dt>
        <dd data-metric="views">{countFormat.format(report.views)}</dd>
        <dd className="analytics-metric-note">{countFormat.format(report.browserViews)} automatic estimates · {countFormat.format(report.publisherViews)} publisher reports · {countFormat.format(historicalViews)} historical estimates</dd>
      </div>
      <div className="analytics-metric">
        <dt><Users size={17} aria-hidden="true" />Estimated visitor-days</dt>
        <dd data-metric="visitor-days">{report.visitorDays === null ? "—" : countFormat.format(report.visitorDays)}</dd>
        <dd className="analytics-metric-note">{report.visitorDays === null ? "No visitor estimate available" : `Visitor signals for ${coverageLabel} of estimated loads`}</dd>
      </div>
      <div className="analytics-metric">
        <dt><Globe2 size={17} aria-hidden="true" />Active sites</dt>
        <dd data-metric="sites">{countFormat.format(report.origins.filter(({ origin }) => origin).length)}</dd>
        <dd className="analytics-metric-note">Approved origins with recorded loads</dd>
      </div>
    </dl>
  );
}
