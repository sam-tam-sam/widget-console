import type { AnalyticsReport } from "@/lib/analytics-report";
import { countFormat } from "./analytics-metrics";

const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const axisCount = new Intl.NumberFormat("en-US", { notation: "compact" });
const dateLabel = (date: string) => dateFormat.format(new Date(date));

export function AnalyticsTrend({ daily }: { daily: AnalyticsReport["daily"] }) {
  const largestDay = Math.max(0, ...daily.map(({ views }) => views));
  const step = Math.max(1, Math.ceil(largestDay / 4));
  const first = daily.at(0)?.date;
  const last = daily.at(-1)?.date;
  const middle = daily[Math.floor(daily.length / 2)]?.date;

  return (
    <section className="console-panel analytics-panel" aria-labelledby="analytics-trend-heading">
      <header className="analytics-panel-heading">
        <h2 id="analytics-trend-heading">Daily activity</h2>
        <span>Embed loads · UTC</span>
      </header>
      {largestDay > 0 && first && middle && last ? (
        <div className="analytics-chart" aria-hidden="true">
          <div className="analytics-scale">
            {[4, 3, 2, 1, 0].map((tick) => <span key={tick}>{axisCount.format(tick * step)}</span>)}
          </div>
          <div className="analytics-plot">
            <div className="analytics-bars">
              {daily.map(({ date, views }) => (
                <div key={date} className="analytics-bar-track" data-latest={date === last || undefined}>
                  <span
                    className="analytics-bar"
                    style={{ height: views > 0 ? `max(2px, ${views / (step * 4) * 100}%)` : 0 }}
                    title={`${dateLabel(date)} · ${countFormat.format(views)} loads`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="analytics-axis">
            <span>{dateLabel(first)}</span>
            <span>{dateLabel(middle)}</span>
            <span>{dateLabel(last)}</span>
          </div>
        </div>
      ) : <p className="analytics-plot-empty">No embed loads in this period.</p>}
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
