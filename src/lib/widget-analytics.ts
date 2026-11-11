import "server-only";

import type { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { publishAdminChange } from "@/lib/admin-live";
import { getDb } from "@/lib/db";
import { resolveEmbedPolicy } from "@/lib/widgets";

export type AnalyticsRange = 7 | 30 | 90;

type AnalyticsTotals = { views: number; visitorDays: number | null };

export type WidgetAnalyticsSnapshot = AnalyticsTotals & {
  range: AnalyticsRange;
  measuredViews: number;
  publisherViews: number;
  browserViews: number;
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
const publisherLoadsPerMinute = 60;
const publisherSourceKey = Buffer.from([1]);
const stores = new WeakMap<DatabaseSync, ReturnType<typeof prepareStore>>();

function utcDate(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

function prepareStore(db: DatabaseSync) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec(`
    CREATE TABLE IF NOT EXISTS widget_analytics_daily (
      day TEXT NOT NULL,
      widget_id TEXT NOT NULL REFERENCES widget_instances(id) ON DELETE CASCADE,
      origin TEXT NOT NULL,
      views INTEGER NOT NULL,
      measured_views INTEGER NOT NULL,
      publisher_views INTEGER NOT NULL DEFAULT 0,
      browser_views INTEGER NOT NULL DEFAULT 0,
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
    CREATE TABLE IF NOT EXISTS widget_analytics_publisher_events (
      origin TEXT NOT NULL,
      event_id TEXT NOT NULL,
      widget_id TEXT NOT NULL REFERENCES widget_instances(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (origin, event_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS widget_analytics_publisher_events_expiry ON widget_analytics_publisher_events(expires_at);
    CREATE INDEX IF NOT EXISTS widget_analytics_publisher_events_widget ON widget_analytics_publisher_events(widget_id);
    CREATE TABLE IF NOT EXISTS widget_analytics_browser_events (
      event_id TEXT PRIMARY KEY,
      widget_id TEXT NOT NULL REFERENCES widget_instances(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS widget_analytics_browser_events_expiry ON widget_analytics_browser_events(expires_at);
    CREATE INDEX IF NOT EXISTS widget_analytics_browser_events_widget ON widget_analytics_browser_events(widget_id);
    `);
    const column = db.prepare("SELECT 1 FROM pragma_table_info('widget_analytics_daily') WHERE name = 'publisher_views'").get();
    if (!column) db.exec("ALTER TABLE widget_analytics_daily ADD COLUMN publisher_views INTEGER NOT NULL DEFAULT 0");
    const browserColumn = db.prepare("SELECT 1 FROM pragma_table_info('widget_analytics_daily') WHERE name = 'browser_views'").get();
    if (!browserColumn) db.exec("ALTER TABLE widget_analytics_daily ADD COLUMN browser_views INTEGER NOT NULL DEFAULT 0");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return {
    lastPrunedDate: "",
    lastPrunedWindow: -1,
    chargeLoad: db.prepare(`
      INSERT INTO widget_analytics_load_limits (window_minute, widget_id, origin, source_key, loads)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT (window_minute, widget_id, origin, source_key) DO UPDATE SET loads = loads + 1
      WHERE loads < ?
    `),
    upsertViews: db.prepare(`
      INSERT INTO widget_analytics_daily (day, widget_id, origin, views, measured_views, publisher_views)
      VALUES (?, ?, ?, 1, 0, 1)
      ON CONFLICT (day, widget_id, origin) DO UPDATE SET
        views = views + 1,
        publisher_views = publisher_views + 1
    `),
    findPublisherEvent: db.prepare("SELECT 1 FROM widget_analytics_publisher_events WHERE origin = ? AND event_id = ?"),
    insertPublisherEvent: db.prepare(`
      INSERT INTO widget_analytics_publisher_events (origin, event_id, widget_id, expires_at) VALUES (?, ?, ?, ?)
    `),
    findBrowserEvent: db.prepare("SELECT 1 FROM widget_analytics_browser_events WHERE event_id = ?"),
    insertBrowserEvent: db.prepare("INSERT INTO widget_analytics_browser_events VALUES (?, ?, ?)"),
    upsertBrowserViews: db.prepare(`
      INSERT INTO widget_analytics_daily (day, widget_id, origin, views, measured_views, browser_views)
      VALUES (?, ?, ?, 1, ?, 1)
      ON CONFLICT (day, widget_id, origin) DO UPDATE SET
        views = views + 1, measured_views = measured_views + excluded.measured_views,
        browser_views = browser_views + 1
    `),
    insertVisitor: db.prepare("INSERT OR IGNORE INTO widget_analytics_visitors VALUES (?, ?, ?, ?)"),
    getSecret: db.prepare("SELECT secret FROM widget_analytics_keys WHERE day = ?"),
    insertSecret: db.prepare("INSERT OR IGNORE INTO widget_analytics_keys VALUES (?, ?)"),
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
    // Yesterday's key verifies receipts issued shortly before midnight.
    db.prepare("DELETE FROM widget_analytics_keys WHERE day < ?").run(utcDate(now - dayMs));
    store.lastPrunedDate = today;
  }
  const window = Math.floor(now / minuteMs);
  if (store.lastPrunedWindow !== window) {
    db.prepare("DELETE FROM widget_analytics_load_limits WHERE window_minute < ?").run(window);
    db.prepare("DELETE FROM widget_analytics_publisher_events WHERE expires_at < ?").run(now);
    db.prepare("DELETE FROM widget_analytics_browser_events WHERE expires_at < ?").run(now);
    store.lastPrunedWindow = window;
  }
  return store;
}

/** Persistent, daily-rotated secret; never sent to an iframe or publisher. */
export function analyticsSecret(time: number): Buffer {
  const store = analyticsStore(getDb(), Date.now());
  const day = utcDate(time);
  let row = store.getSecret.get(day) as { secret: Uint8Array } | undefined;
  if (!row) {
    store.insertSecret.run(day, randomBytes(32));
    row = store.getSecret.get(day) as { secret: Uint8Array };
  }
  return Buffer.from(row.secret);
}

export function browserPolicyDigest(origins: readonly string[]): string {
  return createHash("sha256").update(JSON.stringify([...origins].sort())).digest("hex");
}

/** Called only after a signed browser receipt has been verified. */
export function recordBrowserEmbedLoad(
  linkId: string,
  origin: string,
  policyDigest: string,
  eventId: string,
  sourceKey: Buffer,
  visitorKey: Buffer | undefined,
  now: number,
  expiresAt: number,
): "accepted" | "unavailable" | "limited" {
  const allowed = (embed: ReturnType<typeof resolveEmbedPolicy>) =>
    embed && (origin ? embed.origins.includes(origin) :
      embed.origins.length > 0 && browserPolicyDigest(embed.origins) === policyDigest);
  if (!allowed(resolveEmbedPolicy(linkId))) return "unavailable";
  const db = getDb();
  const store = analyticsStore(db, now);
  let result: "accepted" | "unavailable" | "limited";
  let changedWidgetId: string | undefined;
  db.exec("BEGIN IMMEDIATE");
  try {
    const embed = resolveEmbedPolicy(linkId);
    if (!embed || !allowed(embed)) {
      result = "unavailable";
    } else if (store.findBrowserEvent.get(eventId)) {
      result = "accepted";
    } else {
      const charge = store.chargeLoad.run(Math.floor(now / minuteMs), embed.widgetId, origin, sourceKey, 60);
      result = charge.changes > 0 ? "accepted" : "limited";
      if (result === "accepted") {
        store.insertBrowserEvent.run(eventId, embed.widgetId, expiresAt);
        store.upsertBrowserViews.run(utcDate(now), embed.widgetId, origin, visitorKey ? 1 : 0);
        if (visitorKey) store.insertVisitor.run(utcDate(now), embed.widgetId, origin, visitorKey);
        changedWidgetId = embed.widgetId;
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  if (changedWidgetId) publishAdminChange("analytics", changedWidgetId);
  return result;
}

/** Accepts only reports from the authenticated publisher endpoint. */
export function recordPublisherEmbedLoad(
  linkId: string,
  origin: string,
  eventId: string,
  now: number,
  expiresAt: number,
): "accepted" | "unavailable" | "limited" {
  // Initialize widget storage before opening the analytics write transaction.
  if (!resolveEmbedPolicy(linkId)?.origins.includes(origin)) return "unavailable";
  const db = getDb();
  const store = analyticsStore(db, now);
  let result: "accepted" | "unavailable" | "limited";
  let changedWidgetId: string | undefined;
  db.exec("BEGIN IMMEDIATE");
  try {
    const embed = resolveEmbedPolicy(linkId);
    if (!embed?.origins.includes(origin)) {
      result = "unavailable";
    } else if (store.findPublisherEvent.get(origin, eventId)) {
      result = "accepted";
    } else {
      const window = Math.floor(now / minuteMs);
      const charge = store.chargeLoad.run(window, embed.widgetId, origin, publisherSourceKey, publisherLoadsPerMinute);
      result = charge.changes > 0 ? "accepted" : "limited";
      if (result === "accepted") {
        store.insertPublisherEvent.run(origin, eventId, embed.widgetId, expiresAt);
        store.upsertViews.run(utcDate(now), embed.widgetId, origin);
        changedWidgetId = embed.widgetId;
      }
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  if (changedWidgetId) publishAdminChange("analytics", changedWidgetId);
  return result;
}

type AnalyticsGroup = AnalyticsTotals & { key: string; measuredViews: number; publisherViews: number; browserViews: number };

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
    SELECT ${dimension} AS key, SUM(views) AS views, SUM(measured_views) AS measuredViews,
      SUM(publisher_views) AS publisherViews, SUM(browser_views) AS browserViews
    FROM widget_analytics_daily WHERE ${where}
    GROUP BY ${dimension} ORDER BY views DESC, key ASC
  `).all(...args) as Omit<AnalyticsGroup, "visitorDays">[];
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
    const publisherViews = days.reduce((total, row) => total + row.publisherViews, 0);
    const browserViews = days.reduce((total, row) => total + row.browserViews, 0);
    const views = days.reduce((total, row) => total + row.views, 0);
    const visitorDays = measuredViews > 0 ? days.reduce((total, row) => total + (row.visitorDays ?? 0), 0) : null;
    const origins = analyticsGroups(db, "origin", start, end, widgetId)
      .map(({ key, views, visitorDays }) => ({ origin: key, views, visitorDays }));
    const widgets = widgetId
      ? (views > 0 ? [{ widgetId, views, visitorDays }] : [])
      : analyticsGroups(db, "widget_id", start, end).map(({ key, views, visitorDays }) => ({ widgetId: key, views, visitorDays }));
    db.exec("COMMIT");
    return { range, views, measuredViews, publisherViews, browserViews, visitorDays, daily, origins, widgets };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
