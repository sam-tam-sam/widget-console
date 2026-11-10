import { getWidgetAnalytics, type AnalyticsRange, type WidgetAnalyticsSnapshot } from "@/lib/widget-analytics";
import { listInstances } from "@/lib/widgets";
import type { WidgetInstance } from "@/widgets/contracts";

export type AnalyticsReport = WidgetAnalyticsSnapshot & {
  widgetNames: Record<string, string>;
  visitorTrackingEnabled: boolean;
  generatedAt: string;
};

export function getAnalyticsReport(range: AnalyticsRange, widget?: WidgetInstance): AnalyticsReport {
  const widgets = widget ? [widget] : listInstances();
  return {
    ...getWidgetAnalytics(range, widget?.id),
    widgetNames: Object.fromEntries(widgets.map(({ id, name }) => [id, name])),
    visitorTrackingEnabled: process.env.WIDGET_TRUST_CLOUDFLARE === "1",
    generatedAt: new Date().toISOString(),
  };
}
