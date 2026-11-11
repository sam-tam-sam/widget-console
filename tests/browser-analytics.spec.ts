import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createHmac, randomBytes } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { adminOrigin, approvedOrigin, backendOrigin, otherOrigin, startPlatform } from "./platform-server";

const iframeNavigation = { "Sec-Fetch-Dest": "iframe", "Sec-Fetch-Mode": "navigate" };
const visitorIp = "192.0.2.70";
const endpoint = "/api/admin/widget-analytics";

function requestAt(context: BrowserContext, url: string, headers: Record<string, string> = {}) {
  const address = new URL(url);
  return context.request.get(backendOrigin + address.pathname + address.search, {
    headers: {
      Host: address.host,
      "X-Forwarded-Host": address.host,
      "X-Forwarded-Proto": "https",
      ...headers,
    },
    maxRedirects: 0,
  });
}

async function signIn(page: Page, credentials: { username: string; password: string }) {
  await page.goto("/sign-in");
  await page.getByLabel("Username", { exact: true }).fill(credentials.username);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function report(page: Page, widgetId?: string) {
  return page.evaluate(async (path) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Analytics request failed: ${response.status}`);
    return response.json();
  }, endpoint + (widgetId ? `?widgetId=${widgetId}` : ""));
}

async function receipt(context: BrowserContext, id: string, headers: Record<string, string> = {}) {
  const response = await requestAt(context, `${adminOrigin}/embed/${id}`, {
    ...iframeNavigation,
    Referer: approvedOrigin,
    ...headers,
  });
  expect(response.status()).toBe(200);
  const html = await response.text();
  const url = /data-widget-view="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
  expect(url, "The embed should contain its automatic browser receipt.").toBeTruthy();
  return url!;
}

function receiptResponse(page: Page, id: string) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === `/embed/${id}` && url.searchParams.has("view");
  });
}

async function openEmbedded(page: Page, id: string, origin = approvedOrigin, query = "") {
  const confirmation = receiptResponse(page, id);
  await page.goto(`${origin}/${id}${query}`);
  await expect(page.frameLocator('iframe[title="Embedded fixture"]').getByRole("heading", { name: "Fee Check", exact: true })).toBeVisible();
  const response = await confirmation;
  expect(response.status()).toBe(204);
  const headers = await response.request().allHeaders();
  // Preserve the deployed Cloudflare exception: ordinary iframe GET navigation.
  expect(response.request().method()).toBe("GET");
  expect(headers["sec-fetch-dest"]).toBe("iframe");
  expect(headers["sec-fetch-mode"]).toBe("navigate");
  expect(response.headers()["cache-control"]).toContain("no-store");
  return response.url();
}

test("existing and new embeds count automatically without publisher setup and refresh the dashboard", async ({ page, browser }, testInfo) => {
  const credentials = { username: "browser-analytics-owner", password: randomBytes(24).toString("base64url") };
  const platform = await startPlatform(credentials, { trustCloudflare: true, historicalViews: 3 });
  const visitor = await browser.newContext({
    baseURL: adminOrigin,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { "CF-Connecting-IP": visitorIp },
  });
  try {
    await signIn(page, credentials);
    await page.goto("/admin/analytics");
    const dashboardNavigation = await page.evaluate(() => performance.timeOrigin);
    const loads = page.locator('[data-metric="views"]');
    await expect(loads).toHaveText("3");
    const host = await visitor.newPage();
    const [legacy] = platform.legacy.links;
    let browserViews = 0;

    for (const width of [320, 390, 1280]) {
      await host.setViewportSize({ width, height: 900 });
      await openEmbedded(host, legacy.id);
      browserViews++;
      const frame = host.frameLocator('iframe[title="Embedded fixture"]');
      await expect(frame.locator("body")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
      expect(await frame.locator("html").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
      await frame.locator('[data-action="statement-yes"]').click();
      await expect(frame.locator('[data-panel="sales"]')).toBeVisible();
      expect(await frame.locator("html").evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(width);
      await page.bringToFront();
      await expect(loads).toHaveText(String(3 + browserViews), { timeout: 8_000 });
    }

    const refreshReceipt = receiptResponse(host, legacy.id);
    await host.reload();
    expect((await refreshReceipt).status()).toBe(204);
    browserViews++;
    await page.bringToFront();
    await expect(loads).toHaveText(String(3 + browserViews), { timeout: 8_000 });
    expect(await page.evaluate(() => performance.timeOrigin)).toBe(dashboardNavigation);
    expect(await report(page, platform.legacy.widgetId)).toMatchObject({
      views: 7, browserViews: 4, publisherViews: 0, measuredViews: 4, visitorDays: 1,
    });

    await test.step("a newly created widget also records its first visit", async () => {
      await page.goto("/admin/widgets/new");
      await page.getByLabel("Template", { exact: true }).selectOption("freedom-fee-check");
      await page.getByLabel("Widget name", { exact: true }).fill("Automatic counter widget");
      await page.getByRole("button", { name: "Create widget", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/widgets\/[a-f0-9-]+$/);
      const widgetId = new URL(page.url()).pathname.split("/").at(-1)!;
      await page.getByRole("link", { name: "Approved origins", exact: true }).click();
      await page.getByRole("textbox", { name: "Approved origins", exact: true }).fill(approvedOrigin);
      await page.getByRole("button", { name: "Save approved origins", exact: true }).click();
      await expect(page.getByRole("status").filter({ hasText: "Approved origins saved." })).toBeVisible();
      await page.getByRole("link", { name: "Embed links", exact: true }).click();
      await page.getByRole("button", { name: "Create embed link", exact: true }).click();
      const row = page.locator("[data-link-id]");
      await expect(row).toHaveCount(1);
      const linkId = await row.getAttribute("data-link-id");
      expect(linkId).toBeTruthy();
      await page.goto(`/admin/analytics/${widgetId}`);
      await expect(loads).toHaveText("0");
      await openEmbedded(host, linkId!);
      await page.bringToFront();
      await expect(loads).toHaveText("1", { timeout: 8_000 });
      expect(await report(page, widgetId)).toMatchObject({ views: 1, browserViews: 1, publisherViews: 0 });
      await page.screenshot({ path: testInfo.outputPath("automatic-browser-count.png"), fullPage: true });
    });
  } finally {
    await visitor.close();
    await platform.close();
  }
});

test("browser receipts reject forged loads, bind the source, expire, replay once, and bound writes", async ({ page, browser }) => {
  const credentials = { username: "receipt-test-owner", password: randomBytes(24).toString("base64url") };
  const platform = await startPlatform(credentials, { trustCloudflare: true });
  const visitor = await browser.newContext({
    baseURL: adminOrigin,
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: { "CF-Connecting-IP": visitorIp },
  });
  try {
    await signIn(page, credentials);
    const [link] = platform.legacy.links;
    const pending = await receipt(visitor, link.id);
    expect(await report(page)).toMatchObject({ views: 0, browserViews: 0 });
    expect((await requestAt(visitor, pending)).status()).toBe(403);
    expect((await requestAt(visitor, pending, { ...iframeNavigation, "CF-Connecting-IP": "192.0.2.71" })).status()).toBe(400);
    const tampered = new URL(pending);
    const token = tampered.searchParams.get("view")!;
    const [encodedPayload, signature] = token.split(".");
    tampered.searchParams.set("view", encodedPayload + "." + (signature.startsWith("a") ? "b" : "a") + signature.slice(1));
    expect((await requestAt(visitor, tampered.href, iframeNavigation)).status()).toBe(400);
    expect((await requestAt(visitor, `${adminOrigin}/embed/${link.id}?view=invalid`, iframeNavigation)).status()).toBe(400);

    // Sign an expired fixture with the disposable database's own key. This tests expiry independently of signature rejection.
    const expired = new URL(pending);
    const payload = JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8"));
    const issuedDay = new Date(payload[4]).toISOString().slice(0, 10);
    const expiredAt = Date.now() - 10 * 60_000;
    const expiredDay = new Date(expiredAt).toISOString().slice(0, 10);
    const db = new DatabaseSync(platform.database);
    try {
      const key = db.prepare("SELECT secret FROM widget_analytics_keys WHERE day = ?").get(issuedDay) as { secret: Uint8Array };
      db.prepare("INSERT OR IGNORE INTO widget_analytics_keys (day, secret) VALUES (?, ?)").run(expiredDay, key.secret);
      payload[4] = expiredAt;
      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
      expired.searchParams.set("view", encoded + "." + createHmac("sha256", key.secret).update(encoded).digest("base64url"));
    } finally {
      db.close();
    }
    expect((await requestAt(visitor, expired.href, iframeNavigation)).status()).toBe(400);
    expect(await report(page)).toMatchObject({ views: 0, browserViews: 0 });

    const duplicate = await Promise.all(Array.from({ length: 2 }, () => requestAt(visitor, pending, iframeNavigation)));
    expect(duplicate.map((response) => response.status())).toEqual([204, 204]);
    expect(await report(page)).toMatchObject({ views: 1, browserViews: 1 });

    await test.step("recheck link status and origin approval when accepting a receipt", async () => {
      const revoked = await receipt(visitor, link.id);
      const fixture = new DatabaseSync(platform.database);
      try {
        fixture.prepare("UPDATE widget_embed_links SET enabled = 0 WHERE id = ?").run(link.id);
        expect((await requestAt(visitor, revoked, iframeNavigation)).status()).toBe(404);
        fixture.prepare("UPDATE widget_embed_links SET enabled = 1 WHERE id = ?").run(link.id);
        fixture.prepare("UPDATE widget_instances SET approved_origins_json = ? WHERE id = ?")
          .run(JSON.stringify([otherOrigin]), platform.legacy.widgetId);
        expect((await requestAt(visitor, revoked, iframeNavigation)).status()).toBe(404);
      } finally {
        fixture.prepare("UPDATE widget_embed_links SET enabled = 1 WHERE id = ?").run(link.id);
        fixture.prepare("UPDATE widget_instances SET approved_origins_json = NULL WHERE id = ?").run(platform.legacy.widgetId);
        fixture.close();
      }
      expect(await report(page)).toMatchObject({ views: 1, browserViews: 1 });
    });

    await test.step("unattributed receipts expire when their original approval policy changes", async () => {
      const fixture = new DatabaseSync(platform.database);
      try {
        fixture.prepare("UPDATE widget_instances SET approved_origins_json = ? WHERE id = ?")
          .run(JSON.stringify([approvedOrigin, otherOrigin]), platform.legacy.widgetId);
        const unattributed = await receipt(visitor, link.id, { Referer: "" });
        // Keep another origin approved: a nonempty allowlist alone must not accept this pending receipt.
        fixture.prepare("UPDATE widget_instances SET approved_origins_json = ? WHERE id = ?")
          .run(JSON.stringify([otherOrigin]), platform.legacy.widgetId);
        expect((await requestAt(visitor, unattributed, iframeNavigation)).status()).toBe(404);
      } finally {
        fixture.prepare("UPDATE widget_instances SET approved_origins_json = NULL WHERE id = ?").run(platform.legacy.widgetId);
        fixture.close();
      }
      expect(await report(page)).toMatchObject({ views: 1, browserViews: 1 });
    });

    await test.step("unauthorized framing cannot execute the browser confirmation", async () => {
      const host = await visitor.newPage();
      const confirmationRequests: string[] = [];
      host.on("request", (request) => {
        if (new URL(request.url()).searchParams.has("view")) confirmationRequests.push(request.url());
      });
      const violation = host.waitForEvent("console", { predicate: (entry) => entry.text().includes("frame-ancestors") });
      await host.goto(`${otherOrigin}/${link.id}`);
      await violation;
      expect(confirmationRequests).toEqual([]);
      expect(await report(page)).toMatchObject({ views: 1, browserViews: 1 });
      await host.close();
    });

    const beforeLimit = await report(page);
    const statuses: number[] = [];
    // Enough distinct receipts to cross the per-minute cap even if a minute rolls over during the batch.
    for (let batch = 0; batch < 6; batch++) {
      const receipts = await Promise.all(Array.from({ length: 21 }, () => receipt(visitor, link.id)));
      const responses = await Promise.all(receipts.map((url) => requestAt(visitor, url, iframeNavigation)));
      statuses.push(...responses.map((response) => response.status()));
    }
    expect(statuses.every((status) => status === 204 || status === 429)).toBe(true);
    expect(statuses).toContain(429);
    const accepted = statuses.filter((status) => status === 204).length;
    expect((await report(page)).browserViews).toBe(beforeLimit.browserViews + accepted);
    const freshSource = { "CF-Connecting-IP": "192.0.2.72" };
    const freshReceipt = await receipt(visitor, link.id, freshSource);
    expect((await requestAt(visitor, freshReceipt, { ...iframeNavigation, ...freshSource })).status()).toBe(204);
  } finally {
    await visitor.close();
    await platform.close();
  }
});

test("missing referrer and untrusted IP still allow bounded automatic browser estimates", async ({ page, browser }) => {
  const credentials = { username: "unattributed-test-owner", password: randomBytes(24).toString("base64url") };
  const platform = await startPlatform(credentials);
  const visitor = await browser.newContext({ baseURL: adminOrigin, ignoreHTTPSErrors: true });
  try {
    await signIn(page, credentials);
    const [link] = platform.legacy.links;
    const host = await visitor.newPage();
    const requests: { url: string; referer?: string }[] = [];
    host.on("request", (request) => {
      if (new URL(request.url()).pathname === `/embed/${link.id}`) {
        requests.push({ url: request.url(), referer: request.headers().referer });
      }
    });
    await openEmbedded(host, link.id, approvedOrigin, "?referrer=none");
    expect(requests.find(({ url }) => !new URL(url).searchParams.has("view"))?.referer).toBeUndefined();
    const initial = await report(page);
    expect(initial).toMatchObject({ views: 1, browserViews: 1, publisherViews: 0, measuredViews: 0, visitorDays: null });
    expect(initial.origins).toEqual([expect.objectContaining({ origin: "", views: 1 })]);

    const statuses: number[] = [];
    for (let batch = 0; batch < 6; batch++) {
      const receipts = await Promise.all(Array.from({ length: 21 }, (_, index) => receipt(visitor, link.id, {
        Referer: "",
        // Untrusted IP/user-agent changes must not bypass the aggregate fallback quota.
        "CF-Connecting-IP": `192.0.2.${index + 1}`,
        "User-Agent": `untrusted-source-${batch}-${index}`,
      })));
      const responses = await Promise.all(receipts.map((url) => requestAt(visitor, url, iframeNavigation)));
      statuses.push(...responses.map((response) => response.status()));
    }
    expect(statuses.every((status) => status === 204 || status === 429)).toBe(true);
    expect(statuses).toContain(429);
    expect((await report(page)).browserViews).toBe(1 + statuses.filter((status) => status === 204).length);
  } finally {
    await visitor.close();
    await platform.close();
  }
});
