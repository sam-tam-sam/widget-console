import "server-only";

import { timingSafeEqual } from "node:crypto";
import { normalizeOrigins } from "@/lib/embeds";
import { recordPublisherEmbedLoad } from "@/lib/widget-analytics";

const keyPattern = /^[a-f0-9]{64}$/;
const eventIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const eventLifetimeMs = 5 * 60_000;
const clockSkewMs = 30_000;
let configuredKeys: Map<string, Buffer> | undefined;

function publisherKeys() {
  if (configuredKeys) return configuredKeys;
  const keys = new Map<string, Buffer>();
  try {
    const config: unknown = JSON.parse(process.env.WIDGET_ANALYTICS_PUBLISHER_KEYS || "{}");
    if (!config || typeof config !== "object" || Array.isArray(config)) return (configuredKeys = keys);
    const used = new Set<string>();
    for (const [origin, key] of Object.entries(config)) {
      if (normalizeOrigins([origin])[0] !== origin || typeof key !== "string" || !keyPattern.test(key) || used.has(key)) {
        keys.clear();
        break;
      }
      keys.set(origin, Buffer.from(key, "hex"));
      used.add(key);
    }
  } catch {
    keys.clear();
  }
  return (configuredKeys = keys);
}

export function publisherAnalyticsEnabled() {
  return publisherKeys().size > 0;
}

export function acceptPublisherReport(headers: Headers, linkId: string): number {
  const origin = headers.get("x-widget-origin");
  const auth = /^Bearer ([a-f0-9]{64})$/.exec(headers.get("authorization") ?? "");
  const key = origin ? publisherKeys().get(origin) : undefined;
  if (!origin || !auth || !key || !timingSafeEqual(key, Buffer.from(auth[1], "hex"))) return 401;

  const eventId = headers.get("x-widget-event-id") ?? "";
  const timestamp = headers.get("x-widget-event-time") ?? "";
  const now = Date.now();
  const sentAt = Number(timestamp);
  if (
    !eventIdPattern.test(eventId) || !/^[1-9][0-9]{12}$/.test(timestamp) ||
    sentAt < now - eventLifetimeMs || sentAt > now + clockSkewMs
  ) return 400;

  try {
    const result = recordPublisherEmbedLoad(linkId, origin, eventId, now, sentAt + eventLifetimeMs);
    if (result === "limited") return 429;
    if (result === "unavailable") return 404;
    return 204;
  } catch {
    return 503;
  }
}
