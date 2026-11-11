import { getWidgetAnalytics, type AnalyticsRange, type WidgetAnalyticsSnapshot } from "@/lib/widget-analytics";
import { publisherAnalyticsEnabled } from "@/lib/publisher-analytics";
import { listInstances } from "@/lib/widgets";
import type { WidgetInstance } from "@/widgets/contracts";

export type AnalyticsReport = WidgetAnalyticsSnapshot & {
  widgetNames: Record<string, string>;
  publisherReportingEnabled: boolean;
  generatedAt: string;
};

export function getAnalyticsReport(range: AnalyticsRange, widget?: WidgetInstance): AnalyticsReport {
  const widgets = widget ? [widget] : listInstances();
  return {
    ...getWidgetAnalytics(range, widget?.id),
    widgetNames: Object.fromEntries(widgets.map(({ id, name }) => [id, name])),
    publisherReportingEnabled: publisherAnalyticsEnabled(),
    generatedAt: new Date().toISOString(),
  };
}
