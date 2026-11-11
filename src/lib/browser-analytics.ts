import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { trustedCloudflareIp } from "@/lib/client-ip";
import { applicationOrigin } from "@/lib/embeds";
import { analyticsSecret, browserPolicyDigest, recordBrowserEmbedLoad } from "@/lib/widget-analytics";
import { escapeHtml } from "@/widgets/html";

const lifetimeMs = 5 * 60_000;
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

// A nested navigation keeps the existing /embed/* iframe delivery policy. It
// carries a short-lived receipt, never a publisher credential or admin cookie
// value. CSP still prevents the outer script running on an unapproved site.
const reportScript = `(() => {
  const target = document.currentScript.dataset.widgetView;
  if (!target || window.top === window) return;
  const frame = document.createElement("iframe");
  frame.hidden = true;
  frame.tabIndex = -1;
  frame.title = "Widget load receipt";
  frame.setAttribute("aria-hidden", "true");
  frame.referrerPolicy = "no-referrer";
  frame.src = target;
  document.body.appendChild(frame);
})();`;
const reportHash = `'sha256-${createHash("sha256").update(reportScript).digest("base64")}'`;

function sourceKey(secret: Buffer, headers: Headers) {
  return createHmac("sha256", secret)
    .update("browser-source\0" + (trustedCloudflareIp(headers) || "unavailable")).digest();
}

/** Issues a receipt without counting the initial (forgeable) document GET. */
export function browserAnalyticsDocument(html: string, id: string, origins: readonly string[], headers: Headers) {
  const app = applicationOrigin();
  if (!app || !origins.length) return null;
  let origin = "";
  const referer = headers.get("referer");
  if (referer) {
    try { origin = new URL(referer).origin; } catch { return null; }
    if (!origins.includes(origin)) return null;
  }
  const end = html.lastIndexOf("</body>");
  if (end < 0) return null;
  const now = Date.now();
  const secret = analyticsSecret(now);
  const payload = Buffer.from(JSON.stringify([1, id, origin, sourceKey(secret, headers).toString("hex"), now, randomUUID(), browserPolicyDigest(origins)])).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  const frameSource = new URL(`/embed/${id}`, app).href;
  const url = `${frameSource}?view=${payload}.${signature}`;
  return {
    html: `${html.slice(0, end)}<script data-widget-view="${escapeHtml(url)}">${reportScript}</script>${html.slice(end)}`,
    hash: reportHash,
    frameSource,
  };
}

export function acceptBrowserReceipt(headers: Headers, linkId: string, token: string): number {
  if (token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return 400;
  const [payload, signature] = token.split(".");
  let decoded: unknown;
  try { decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); } catch { return 400; }
  if (!Array.isArray(decoded) || decoded.length !== 7) return 400;
  const [version, id, origin, source, issuedAt, eventId, policyDigest] = decoded;
  const now = Date.now();
  if (
    version !== 1 || id !== linkId || typeof origin !== "string" || origin.length > 3072 ||
    typeof source !== "string" || !/^[a-f0-9]{64}$/.test(source) ||
    typeof policyDigest !== "string" || !/^[a-f0-9]{64}$/.test(policyDigest) ||
    typeof issuedAt !== "number" || !Number.isSafeInteger(issuedAt) || issuedAt < now - lifetimeMs || issuedAt > now + 30_000 ||
    typeof eventId !== "string" || !uuidPattern.test(eventId)
  ) return 400;

  try {
    const secret = analyticsSecret(issuedAt);
    const expected = createHmac("sha256", secret).update(payload).digest();
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) return 400;
    if (!timingSafeEqual(sourceKey(secret, headers), Buffer.from(source, "hex"))) return 400;
    const currentSecret = analyticsSecret(now);
    const ip = trustedCloudflareIp(headers);
    const visitorKey = ip ? createHmac("sha256", currentSecret)
      .update("browser-visitor\0" + ip + "\0" + (headers.get("user-agent") || "").slice(0, 512)).digest() : undefined;
    const result = recordBrowserEmbedLoad(linkId, origin, policyDigest, eventId, sourceKey(currentSecret, headers), visitorKey, now, issuedAt + lifetimeMs);
    if (result === "unavailable") return 404;
    if (result === "limited") return 429;
    return 204;
  } catch {
    return 503;
  }
}
