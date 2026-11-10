import type { AnalyticsReport } from "@/lib/analytics-report";
import { countFormat } from "./analytics-metrics";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const dateLabel = (date: string) => dateFormat.format(new Date(date));

export function AnalyticsTrend({ daily }: { daily: AnalyticsReport["daily"] }) {
  const largestDay = Math.max(1, ...daily.map(({ views }) => views));
  const hasLoads = daily.some(({ views }) => views > 0);
  const first = daily.at(0)?.date;
  const last = daily.at(-1)?.date;
  const middle = daily[Math.floor(daily.length / 2)]?.date;

  return (
    <section className="console-panel analytics-panel" aria-labelledby="analytics-trend-heading">
      <header className="analytics-panel-heading">
        <h2 id="analytics-trend-heading">Daily activity</h2>
        <span>UTC</span>
      </header>
      <div className="analytics-plot">
        <div className="analytics-bars" aria-hidden="true">
          {daily.map(({ date, views }) => (
            <div key={date} className="analytics-bar-track">
              <span
                className="analytics-bar"
                style={{ height: views > 0 ? `max(3px, ${views / largestDay * 100}%)` : 0 }}
                title={`${dateLabel(date)} · ${countFormat.format(views)} loads`}
              />
            </div>
          ))}
        </div>
        {!hasLoads && <p className="analytics-plot-empty">No embed loads in this period.</p>}
      </div>
      {first && middle && last && (
        <div className="analytics-axis" aria-hidden="true">
          <span>{dateLabel(first)}</span>
          <span>{dateLabel(middle)}</span>
          <span>{dateLabel(last)}</span>
        </div>
      )}
      <details className="console-disclosure analytics-daily-detail">
        <summary>Daily totals</summary>
        <table className="analytics-table">
          <thead><tr><th scope="col">Date (UTC)</th><th scope="col">Loads</th><th scope="col">Est. visitors</th></tr></thead>
          <tbody>
            {daily.map(({ date, views, visitorDays }) => (
              <tr key={date}>
                <th scope="row"><time dateTime={date}>{dateLabel(date)}</time></th>
                <td>{countFormat.format(views)}</td>
                <td>{visitorDays === null ? "—" : countFormat.format(visitorDays)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
