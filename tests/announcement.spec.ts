import { expect, test } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { adminOrigin, approvedOrigin, backendOrigin, otherOrigin, startPlatform } from "./platform-server";

test("a scheduled announcement uses its approved slot and preserves the host header", async ({ page, context }) => {
  const credentials = { username: "announcement-owner", password: randomBytes(24).toString("base64url") };
  const platform = await startPlatform(credentials);
  try {
    await page.goto("/sign-in");
    await page.getByLabel("Username", { exact: true }).fill(credentials.username);
    await page.getByLabel("Password", { exact: true }).fill(credentials.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.getByRole("link", { name: "New widget", exact: true }).click();
    await page.getByLabel("Template", { exact: true }).selectOption("announcement");
    await page.getByLabel("Widget name", { exact: true }).fill("Event notice");
    await page.getByRole("button", { name: "Create widget", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/widgets\/[a-f0-9-]+$/);

    const notice = "تسجيل حضور اللقاء القادم متاح الآن";
    const start = new Date(Date.now() - 120_000).toISOString().slice(0, 16);
    const end = new Date(Date.now() + 600_000).toISOString().slice(0, 16);
    await page.getByLabel("Announcement text").fill(notice);
    await page.getByLabel("Icon", { exact: true }).selectOption("calendar");
    await page.getByLabel("Button label", { exact: true }).fill("Register");
    await page.getByLabel("Button URL", { exact: true }).fill("https://example.com/event");
    await page.getByLabel("Mount selector", { exact: true }).fill("#announcement-slot");
    await page.getByLabel("Fixed header selector", { exact: true }).fill("#site-header");
    await page.getByLabel("Start time (UTC)").fill(start);
    await page.getByLabel("End time (UTC)").fill(end);
    await page.getByRole("button", { name: "Save settings", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Settings saved." })).toBeVisible();

    await page.getByRole("link", { name: "Preview", exact: true }).click();
    await expect(page.getByText("Schedule (UTC).", { exact: false })).toContainText(start.replace("T", " "));
    const preview = page.frameLocator('iframe[title="Widget preview"]');
    await expect(preview.getByText(notice)).toBeVisible();
    await preview.getByRole("button", { name: "Close announcement" }).click();
    await expect(page.getByRole("button", { name: "Show announcement preview" })).toBeVisible();

    await page.getByRole("link", { name: "Approved origins", exact: true }).click();
    await page.getByRole("textbox", { name: "Approved origins", exact: true }).fill(approvedOrigin);
    await page.getByRole("button", { name: "Save approved origins" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Approved origins saved." })).toBeVisible();
    await page.getByRole("link", { name: "Embed links", exact: true }).click();
    await page.getByRole("button", { name: "Create embed link", exact: true }).click();
    const link = page.locator("[data-link-id]");
    await expect(link).toHaveCount(1);
    const id = await link.getAttribute("data-link-id");
    expect(id).toBeTruthy();
    await expect(link.getByRole("button", { name: "Copy head script" })).toBeVisible();

    const host = await context.newPage();
    const iframe = host.locator('iframe[title="Announcement"]');
    const content = host.frameLocator('iframe[title="Announcement"]');
    const header = host.locator("#site-header");
    const fixture = `${approvedOrigin}/script/${id}?duplicate=1`;
    for (const width of [320, 390, 1440]) {
      await host.setViewportSize({ width, height: 800 });
      await host.goto(fixture);
      await expect(iframe).toHaveCount(1);
      await expect(content.getByText(notice)).toBeVisible();
      await expect(content.getByRole("link", { name: "Register" })).toHaveAttribute("href", "https://example.com/event");
      expect(await content.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(width);
      await expect.poll(async () => {
        const top = (await header.boundingBox())?.y ?? 0;
        const box = await iframe.boundingBox();
        return Math.abs(top - ((box?.y ?? 0) + (box?.height ?? 0)));
      }).toBeLessThanOrEqual(1);
      await host.evaluate(() => scrollTo(0, 240));
      await expect.poll(async () => (await iframe.boundingBox())?.y).toBe(0);
      await content.getByRole("button", { name: "Close announcement" }).click();
      await expect(iframe).toHaveCount(0);
      await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
    }

    await host.clock.install({ time: new Date(Date.parse(`${start}:00Z`) - 30_000) });
    await host.goto(fixture);
    await host.waitForLoadState("networkidle");
    await expect(iframe).toHaveCount(0);
    await host.clock.fastForward(31_000);
    await expect(content.getByText(notice)).toBeVisible();
    await host.clock.fastForward(Date.parse(`${end}:00Z`) - Date.parse(`${start}:00Z`));
    await expect(iframe).toHaveCount(0);
    await host.close();

    const unavailable = await context.newPage();
    const noBar = unavailable.locator('iframe[title="Announcement"]');
    await unavailable.goto(`${approvedOrigin}/script/${id}?slot=missing`);
    await unavailable.waitForLoadState("networkidle");
    await expect(noBar).toHaveCount(0);
    await expect(unavailable.locator("#offer-trigger")).toBeEnabled();
    await unavailable.goto(`${otherOrigin}/script/${id}`);
    await unavailable.waitForLoadState("networkidle");
    await expect(noBar).toHaveCount(0);

    const requestHeaders = { Host: new URL(adminOrigin).host, "X-Forwarded-Proto": "https" };
    const direct = await context.request.get(`${backendOrigin}/embed/${id}`, { headers: requestHeaders });
    expect(direct.status()).toBe(403);
    const deniedConfig = await context.request.get(`${backendOrigin}/api/embed-config/${id}`, {
      headers: { ...requestHeaders, Origin: otherOrigin },
    });
    expect(deniedConfig.status()).toBe(404);
    expect(deniedConfig.headers()["access-control-allow-origin"]).toBeUndefined();
    // A manually inserted iframe from the unapproved host is also blocked by CSP.
    const blocked = unavailable.waitForEvent("console", { predicate: (entry) => entry.text().includes("frame-ancestors") });
    await unavailable.evaluate((src) => {
      const frame = document.createElement("iframe");
      frame.src = src;
      document.body.append(frame);
    }, `${adminOrigin}/embed/${id}?host=1&parent=${encodeURIComponent(approvedOrigin)}&channel=${randomUUID()}`);
    await blocked;

    await unavailable.route("**/widget-embed/v1.js", (route) => route.abort());
    await unavailable.goto(fixture);
    await unavailable.locator("#host-control").click();
    await expect(noBar).toHaveCount(0);
    await unavailable.unroute("**/widget-embed/v1.js");

    await link.getByText("Manage link", { exact: true }).click();
    await link.getByText("Disable link", { exact: true }).click();
    await link.getByRole("button", { name: "Confirm disable" }).click();
    await expect(link.getByText("Disabled", { exact: true })).toBeVisible();
    await unavailable.goto(fixture);
    await unavailable.waitForLoadState("networkidle");
    await expect(noBar).toHaveCount(0);
  } finally {
    await platform.close();
  }
});
