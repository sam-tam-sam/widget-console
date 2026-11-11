import Link from "next/link";
import type { AnalyticsReport } from "@/lib/analytics-report";
import { countFormat } from "./analytics-metrics";

function VisitorCount({ count }: { count: number | null }) {
  return count === null ? "—" : countFormat.format(count);
}

export function AnalyticsSites({ origins }: { origins: AnalyticsReport["origins"] }) {
  return (
    <section className="console-panel analytics-panel" aria-labelledby="analytics-sites-heading">
      <header className="analytics-panel-heading">
        <h2 id="analytics-sites-heading">Sites</h2>
        <span>{countFormat.format(origins.length)} active</span>
      </header>
      {origins.length === 0 ? (
        <p className="console-empty-note">Sites appear after their first recorded embed load.</p>
      ) : (
        <table className="analytics-table">
          <thead><tr><th scope="col">Approved origin</th><th scope="col">Loads</th><th scope="col">Est. visitor-days</th></tr></thead>
          <tbody>
            {origins.map(({ origin, views, visitorDays }) => (
              <tr key={origin}>
                <th scope="row" title={origin}>{origin.replace(/^https:\/\//, "")}</th>
                <td>{countFormat.format(views)}</td>
                <td><VisitorCount count={visitorDays} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function AnalyticsWidgets({ report }: { report: AnalyticsReport }) {
  const stats = new Map(report.widgets.map((widget) => [widget.widgetId, widget]));
  const rows = Object.entries(report.widgetNames).map(([id, name]) => ({
    id,
    name,
    views: stats.get(id)?.views ?? 0,
    visitorDays: stats.get(id)?.visitorDays ?? null,
  })).sort((a, b) => b.views - a.views || a.name.localeCompare(b.name));

  return (
    <section className="console-panel analytics-panel" aria-labelledby="analytics-widgets-heading">
      <header className="analytics-panel-heading">
        <h2 id="analytics-widgets-heading">Widgets</h2>
        <span>{countFormat.format(rows.length)} total</span>
      </header>
      {rows.length === 0 ? (
        <p className="console-empty-note">Create a widget to start tracking embed activity.</p>
      ) : (
        <table className="analytics-table">
          <thead><tr><th scope="col">Widget</th><th scope="col">Loads</th><th scope="col">Est. visitor-days</th></tr></thead>
          <tbody>
            {rows.map(({ id, name, views, visitorDays }) => (
              <tr key={id}>
                <th scope="row"><Link href={`/admin/analytics/${id}?range=${report.range}`}>{name}</Link></th>
                <td>{countFormat.format(views)}</td>
                <td><VisitorCount count={visitorDays} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
