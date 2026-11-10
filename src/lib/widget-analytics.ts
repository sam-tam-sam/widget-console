import { createHmac, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { trustedCloudflareIp } from "@/lib/client-ip";
import { getDb } from "@/lib/db";

export type AnalyticsRange = 7 | 30 | 90;

type AnalyticsTotals = { views: number; visitorDays: number | null };

export type WidgetAnalyticsSnapshot = AnalyticsTotals & {
  range: AnalyticsRange;
  measuredViews: number;
  daily: (AnalyticsTotals & { date: string })[];
  origins: (AnalyticsTotals & { origin: string })[];
  widgets: (AnalyticsTotals & { widgetId: string })[];
};

export function parseAnalyticsRange(value: string | null | undefined): AnalyticsRange {
  if (value === "30") return 30;
  if (value === "90") return 90;
  return 7;
}

const dayMs = 86_400_000;
const minuteMs = 60_000;
const retentionDays = 90;
const trustedLoadsPerMinute = 12;
const unmeasuredLoadsPerMinute = 60;
const unmeasuredSourceKey = Buffer.alloc(0);
const stores = new WeakMap<DatabaseSync, ReturnType<typeof prepareStore>>();

function utcDate(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

function prepareStore(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS widget_analytics_daily (
      day TEXT NOT NULL,
      widget_id TEXT NOT NULL REFERENCES widget_instances(id) ON DELETE CASCADE,
      origin TEXT NOT NULL,
      views INTEGER NOT NULL,
      measured_views INTEGER NOT NULL,
      PRIMARY KEY (day, widget_id, origin)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS widget_analytics_daily_widget ON widget_analytics_daily(widget_id, day);
    CREATE TABLE IF NOT EXISTS widget_analytics_visitors (
      day TEXT NOT NULL,
      widget_id TEXT NOT NULL,
      origin TEXT NOT NULL,
      visitor_key BLOB NOT NULL,
      PRIMARY KEY (day, widget_id, origin, visitor_key),
      FOREIGN KEY (day, widget_id, origin)
        REFERENCES widget_analytics_daily(day, widget_id, origin) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS widget_analytics_visitors_widget ON widget_analytics_visitors(widget_id, day);
    CREATE TABLE IF NOT EXISTS widget_analytics_keys (
      day TEXT PRIMARY KEY,
      secret BLOB NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS widget_analytics_load_limits (
      window_minute INTEGER NOT NULL,
      widget_id TEXT NOT NULL REFERENCES widget_instances(id) ON DELETE CASCADE,
      origin TEXT NOT NULL,
      source_key BLOB NOT NULL,
      loads INTEGER NOT NULL,
      PRIMARY KEY (window_minute, widget_id, origin, source_key)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS widget_analytics_load_limits_widget ON widget_analytics_load_limits(widget_id);
  `);

  return {
    lastPrunedDate: "",
    lastPrunedWindow: -1,
    secretDate: "",
    secret: undefined as Uint8Array | undefined,
    chargeLoad: db.prepare(`
      INSERT INTO widget_analytics_load_limits (window_minute, widget_id, origin, source_key, loads)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT (window_minute, widget_id, origin, source_key) DO UPDATE SET loads = loads + 1
      WHERE loads < ?
    `),
    upsertViews: db.prepare(`
      INSERT INTO widget_analytics_daily (day, widget_id, origin, views, measured_views)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT (day, widget_id, origin) DO UPDATE SET
        views = views + 1,
        measured_views = measured_views + excluded.measured_views
    `),
    insertVisitor: db.prepare(`
      INSERT INTO widget_analytics_visitors (day, widget_id, origin, visitor_key) VALUES (?, ?, ?, ?)
      ON CONFLICT (day, widget_id, origin, visitor_key) DO NOTHING
    `),
  };
}

function analyticsStore(db: DatabaseSync, now: number) {
  let store = stores.get(db);
  if (!store) {
    store = prepareStore(db);
    stores.set(db, store);
  }
  const today = utcDate(now);
  if (store.lastPrunedDate !== today) {
    db.prepare("DELETE FROM widget_analytics_daily WHERE day < ?").run(utcDate(now - (retentionDays - 1) * dayMs));
    db.prepare("DELETE FROM widget_analytics_keys WHERE day < ?").run(today);
    store.lastPrunedDate = today;
  }
  const window = Math.floor(now / minuteMs);
  if (store.lastPrunedWindow !== window) {
    db.prepare("DELETE FROM widget_analytics_load_limits WHERE window_minute < ?").run(window);
    store.lastPrunedWindow = window;
  }
  return store;
}

function dailySecret(db: DatabaseSync, store: ReturnType<typeof prepareStore>, day: string) {
  if (store.secretDate !== day) {
    db.prepare("INSERT INTO widget_analytics_keys (day, secret) VALUES (?, ?) ON CONFLICT (day) DO NOTHING").run(day, randomBytes(32));
    const row = db.prepare("SELECT secret FROM widget_analytics_keys WHERE day = ?").get(day) as { secret: Uint8Array };
    store.secret = row.secret;
    store.secretDate = day;
  }
  return store.secret;
}

function approvedReferrer(headers: Headers, origins: readonly string[]): string | null {
  const referrer = headers.get("referer");
  if (!referrer) return null;

  try {
    const { origin, protocol } = new URL(referrer);
    return protocol === "https:" && origins.includes(origin) ? origin : null;
  } catch {
    return null;
  }
}

/** Call after resolving an enabled widget iframe. Missing analytics must never block the embed. */
export function recordWidgetEmbedLoad(request: Request, widgetId: string, origins: readonly string[]): void {
  if (request.method !== "GET" || request.headers.get("sec-purpose")?.startsWith("prefetch")) return;
  const origin = approvedReferrer(request.headers, origins);
  if (!origin) return;

  try {
    const now = Date.now();
    const day = utcDate(now);
    const window = Math.floor(now / minuteMs);
    const db = getDb();
    const store = analyticsStore(db, now);
    const ip = trustedCloudflareIp(request.headers);
    const secret = ip ? dailySecret(db, store, day) : undefined;
    const sourceKey = ip && secret
      ? createHmac("sha256", secret).update("analytics-rate\0").update(ip).digest().subarray(0, 16)
      : unmeasuredSourceKey;
    const limit = ip ? trustedLoadsPerMinute : unmeasuredLoadsPerMinute;

    db.exec("BEGIN IMMEDIATE");
    try {
      const charge = store.chargeLoad.run(window, widgetId, origin, sourceKey, limit);
      if (charge.changes > 0) {
        const agent = request.headers.get("user-agent");
        const visitor = ip && secret && agent && agent.length <= 1024
          ? createHmac("sha256", secret).update(day).update("\0").update(ip).update("\0").update(agent).digest().subarray(0, 16)
          : null;
        store.upsertViews.run(day, widgetId, origin, visitor ? 1 : 0);
        if (visitor) store.insertVisitor.run(day, widgetId, origin, visitor);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } catch {
    // The embed must remain available if analytics storage fails.
  }
}

type AnalyticsGroup = AnalyticsTotals & { key: string; measuredViews: number };

function analyticsGroups(
  db: DatabaseSync,
  dimension: "day" | "origin" | "widget_id",
  start: string,
  end: string,
  widgetId?: string,
): AnalyticsGroup[] {
  const where = widgetId ? "day BETWEEN ? AND ? AND widget_id = ?" : "day BETWEEN ? AND ?";
  const args = widgetId ? [start, end, widgetId] : [start, end];
  const counts = db.prepare(`
    SELECT ${dimension} AS key, SUM(views) AS views, SUM(measured_views) AS measuredViews
    FROM widget_analytics_daily WHERE ${where}
    GROUP BY ${dimension} ORDER BY views DESC, key ASC
  `).all(...args) as { key: string; views: number; measuredViews: number }[];
  const visitors = db.prepare(`
    SELECT ${dimension} AS key, COUNT(DISTINCT visitor_key) AS visitorDays
    FROM widget_analytics_visitors WHERE ${where} GROUP BY ${dimension}
  `).all(...args) as { key: string; visitorDays: number }[];
  const visitorCounts = new Map(visitors.map(({ key, visitorDays }) => [key, visitorDays]));
  return counts.map((row) => ({ ...row, visitorDays: visitorCounts.get(row.key) ?? null }));
}

/** The admin caller initializes widget storage before requesting analytics. */
export function getWidgetAnalytics(range: AnalyticsRange, widgetId?: string): WidgetAnalyticsSnapshot {
  const now = Date.now();
  const start = utcDate(now - (range - 1) * dayMs);
  const end = utcDate(now);
  const db = getDb();
  analyticsStore(db, now);
  db.exec("BEGIN");
  try {
    const days = analyticsGroups(db, "day", start, end, widgetId);
    const groupsByDay = new Map(days.map((row) => [row.key, row]));
    const daily = Array.from({ length: range }, (_, index) => {
      const date = utcDate(now - (range - 1 - index) * dayMs);
      const group = groupsByDay.get(date);
      return { date, views: group?.views ?? 0, visitorDays: group?.visitorDays ?? null };
    });
    const measuredViews = days.reduce((total, row) => total + row.measuredViews, 0);
    const views = days.reduce((total, row) => total + row.views, 0);
    const visitorDays = measuredViews > 0 ? days.reduce((total, row) => total + (row.visitorDays ?? 0), 0) : null;
    const origins = analyticsGroups(db, "origin", start, end, widgetId)
      .map(({ key, views, visitorDays }) => ({ origin: key, views, visitorDays }));
    const widgets = widgetId
      ? (views > 0 ? [{ widgetId, views, visitorDays }] : [])
      : analyticsGroups(db, "widget_id", start, end).map(({ key, views, visitorDays }) => ({ widgetId: key, views, visitorDays }));
    db.exec("COMMIT");
    return { range, views, measuredViews, visitorDays, daily, origins, widgets };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
